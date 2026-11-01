"""Room-scoped stream discovery and signaling; media never crosses this service."""
import json
import secrets


class SharedSessions:
    # All calls are serialized by AdhocLobby.lock.
    def __init__(self):
        self.clients = {}

    def add(self, client, room, name):
        client.share_id = secrets.token_hex(16)
        client.share_room = room
        client.share_name = name[:48]
        client.share_host = None
        client.share_publication = None
        self.clients[client.share_id] = client

    def ready(self, client, ice):
        client.send_json(dict(type='welcome', id=client.share_id, iceServers=ice))
        self.refresh(client.share_room)

    def refresh(self, room):
        sessions = [dict(id=c.share_id, name=c.share_name, **c.share_publication)
                    for c in self.clients.values() if c.share_room == room and c.share_publication]
        for c in self.clients.values():
            if c.share_room == room:
                c.send_json(dict(type='sessions', sessions=sessions))

    def state(self, host):
        members = [dict(id=c.share_id, name=c.share_name) for c in self.clients.values()
                   if c.share_host == host.share_id]
        message = dict(type='state', host=host.share_id, controller=host.share_publication['controller'], members=members)
        host.send_json(message)
        for c in self.clients.values():
            if c.share_host == host.share_id:
                c.send_json(message)

    def leave(self, client):
        if client.share_publication:
            for c in self.clients.values():
                if c.share_host == client.share_id:
                    c.share_host = None
                    c.send_json(dict(type='ended'))
            client.share_publication = None
        host = self.clients.get(client.share_host)
        client.share_host = None
        if host and host.share_publication:
            if host.share_publication['controller'] == client.share_id:
                host.share_publication['controller'] = None
            host.send_json(dict(type='departed', peer=client.share_id))
            self.state(host)
        self.refresh(client.share_room)

    def remove(self, client):
        self.leave(client)
        self.clients.pop(client.share_id, None)

    def message(self, client, data):
        if len(data) > 49152:
            raise ValueError('shared session message too large')
        try:
            m = json.loads(data)
        except (ValueError, UnicodeError, RecursionError) as exc:
            raise ValueError('invalid shared session JSON') from exc
        if not isinstance(m, dict):
            raise ValueError('invalid shared session message')
        kind = m.get('type')
        for key in ('host', 'peer', 'to'):
            if key in m and m[key] is not None and not isinstance(m[key], str):
                raise ValueError('invalid participant ID')
        if kind == 'publish':
            if m.get('mode') not in ('watch', 'play') or not isinstance(m.get('title'), str):
                raise ValueError('invalid publication')
            self.leave(client)
            client.share_publication = dict(title=m['title'][:100], mode=m['mode'], controller=None)
            client.send_json(dict(type='published', id=client.share_id))
            self.refresh(client.share_room)
        elif kind == 'leave':
            self.leave(client)
            client.send_json(dict(type='ended'))
        elif kind == 'join':
            host = self.clients.get(m.get('host'))
            if not host or host is client or host.share_room != client.share_room or not host.share_publication:
                client.send_json(dict(type='error', message='Session is no longer available'))
                return
            if sum(c.share_host == host.share_id for c in self.clients.values()) >= 4:
                client.send_json(dict(type='error', message='Session is full (4 guests)'))
                return
            self.leave(client)
            client.share_host = host.share_id
            client.send_json(dict(type='joined', host=host.share_id))
            host.send_json(dict(type='guest', peer=client.share_id))
            self.state(host)
        elif kind == 'control':
            publication = client.share_publication
            target = self.clients.get(m.get('peer'))
            if not publication or publication['mode'] != 'play':
                raise ValueError('host control permission required')
            if m.get('peer') is not None and (not target or target.share_host != client.share_id):
                raise ValueError('controller must be a session member')
            publication['controller'] = m.get('peer')
            self.state(client)
        elif kind == 'signal':
            target = self.clients.get(m.get('to'))
            if not target or target.share_room != client.share_room:
                return
            if not ((client.share_publication and target.share_host == client.share_id) or
                    (target.share_publication and client.share_host == target.share_id)):
                return
            payload = m.get('payload')
            if not isinstance(payload, dict) or len(payload) != 1:
                raise ValueError('invalid signaling payload')
            if 'description' in payload:
                d = payload['description']
                if not isinstance(d, dict) or d.get('type') not in ('offer', 'answer') or not isinstance(d.get('sdp'), str):
                    raise ValueError('invalid description')
            elif 'candidate' not in payload or not isinstance(payload['candidate'], (dict, type(None))):
                raise ValueError('invalid candidate')
            target.send_json(dict(type='signal', sender=client.share_id, payload=payload))
        else:
            raise ValueError('unknown shared session message')
