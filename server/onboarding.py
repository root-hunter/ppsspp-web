"""Small HTTP-only bootstrap: public CA download and LAN pairing QR."""
import hashlib
import html
import ipaddress
import re
import ssl
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlsplit


def origin(value):
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname or
            parsed.username or parsed.password or parsed.path not in ('', '/') or
            parsed.query or parsed.fragment):
        raise ValueError('Expected an HTTP(S) origin')
    # Validate the port and restrict host characters before building links.
    parsed.port
    if not re.fullmatch(r'[A-Za-z0-9.\-:\[\]]+', parsed.netloc):
        raise ValueError('Invalid origin host')
    return parsed.scheme + '://' + parsed.netloc


class SetupServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, *, ca_file, https_port, public_origin=''):
        self.ca_file = ca_file
        self.https_port = https_port
        self.public_origin = origin(public_origin) if public_origin else ''
        super().__init__(address, SetupHandler)


class SetupHandler(BaseHTTPRequestHandler):
    def reply(self, body, content_type, *, download=False):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
        if download:
            self.send_header('Content-Disposition', 'attachment; filename="ppsspp-relay-ca.crt"')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path not in ('/setup', '/setup/', '/setup/ca.crt', '/setup/qr.svg'):
            self.send_error(404)
            return
        try:
            with open(self.server.ca_file, 'r', encoding='ascii') as source:
                ca = source.read(65537)
            if len(ca) > 65536 or not re.fullmatch(
                    r'\s*-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*', ca):
                raise ValueError('Expected one public certificate')
            der = ssl.PEM_cert_to_DER_cert(ca)
        except (OSError, ValueError):
            self.send_error(503, 'Local CA is not configured')
            return
        if parsed.path == '/setup/ca.crt':
            self.reply(ca.encode('ascii'), 'application/x-x509-ca-cert', download=True)
            return
        try:
            setup_origin = origin('http://' + self.headers.get('Host', ''))
            host = urlsplit(setup_origin).hostname
            authority = '[' + host + ']' if ':' in host else host
            public = self.server.public_origin or f'https://{authority}:{self.server.https_port}'
            room = parse_qs(parsed.query).get('room', ['public'])[0]
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,32}', room):
                raise ValueError('Invalid room')
        except ValueError:
            self.send_error(400)
            return
        setup_url = setup_origin + '/setup?' + urlencode({'room': room})
        if self.server.public_origin:
            public_host = urlsplit(public).hostname
            public_authority = '[' + public_host + ']' if ':' in public_host else public_host
            setup_port = urlsplit(setup_origin).port or 80
            setup_url = f'http://{public_authority}:{setup_port}/setup?' + urlencode({'room': room})
        if parsed.path == '/setup/qr.svg':
            try:
                svg = subprocess.run(['qrencode', '-t', 'SVG', '-o', '-', '-m', '4', setup_url],
                                     check=True, capture_output=True, timeout=5).stdout
            except (OSError, subprocess.SubprocessError):
                self.send_error(503, 'QR encoder unavailable; use the setup link')
                return
            self.reply(svg, 'image/svg+xml')
            return
        relay = public.replace('https://', 'wss://').replace('http://', 'ws://') + '/adhoc'
        launch = public + '/#' + urlencode({'relay': relay, 'room': room})
        fingerprint = ':'.join(f'{b:02X}' for b in hashlib.sha256(der).digest())
        local = host == 'localhost'
        try:
            local = local or ipaddress.ip_address(host).is_loopback
        except ValueError:
            pass
        hint = ('<p class="notice">To share the QR code, open this page using the computer’s LAN IP address instead of localhost.</p>'
                if local and not self.server.public_origin else '')
        escape = html.escape
        page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect your phone · PPSSPP</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0c1120;color:#e6edf9}
body{max-width:820px;margin:40px auto;padding:0 20px;line-height:1.6}h1{line-height:1.15;font-size:clamp(28px,6vw,42px)}
.tag{color:#74dfc8;font-size:13px;letter-spacing:.12em}main{display:grid;grid-template-columns:1fr 220px;gap:30px}
section,aside{background:#151e30;border:1px solid #2a3850;border-radius:18px;padding:24px}aside{align-self:start;text-align:center}
img{width:100%;background:white;border-radius:8px}a{color:#8edeea;overflow-wrap:anywhere}.button{display:block;text-align:center;padding:12px 16px;border-radius:10px;background:#74dfc8;color:#09221e;text-decoration:none;font-weight:700;margin:16px 0}
li{margin-bottom:20px}ol{padding-left:22px}code{overflow-wrap:anywhere}small{display:block;color:#b4c0d5}details{margin-top:20px}.notice{padding:12px;background:#483b1d;border-radius:8px}
@media(max-width:650px){main{grid-template-columns:1fr}aside{max-width:240px;margin:auto}body{margin-top:24px}}
</style><p class="tag">PPSSPP · LAN MULTIPLAYER</p><h1>Connect your phone</h1>
<p>Connect both devices to the same Wi-Fi network. Complete this setup once on each device.</p>
HINT<main><section><ol><li><strong>Download the network certificate</strong>
<a class="button" href="/setup/ca.crt">Download CA certificate</a><small>This is your relay’s public certificate.</small></li>
<li><strong>Install it on Android</strong><p>Settings → Security → Encryption &amp; credentials → Install a certificate → <b>CA certificate</b>.
Select <code>ppsspp-relay-ca.crt</code>. Menu names may vary by device.</p><small>Android requires your confirmation; the QR code cannot replace it. Only install the CA if this is your relay.</small></li>
<li><strong>Open PPSSPP</strong><p>Close and reopen Chrome after installation, then return here. Your relay and room will be filled in automatically.</p>
<a class="button" href="LAUNCH">Open PPSSPP · room ROOM</a><small>Start the same compatible game version on both devices and use its multiplayer menu.</small></li></ol>
<details><summary>Check certificate and connection</summary><p>Compare this SHA-256 fingerprint with the one shown on your computer:</p><code>FINGERPRINT</code>
<p><a href="HEALTH">Check HTTPS connection</a></p><p>Relay: <code>RELAY</code></p></details></section>
<aside><img src="/setup/qr.svg?QUERY" alt="QR code to open this setup on your phone"><p>Scan with your phone’s camera</p><small><a href="SETUP">SETUP</a></small></aside></main></html>'''
        values = {'HINT': hint, 'LAUNCH': escape(launch, quote=True), 'ROOM': escape(room),
                           'FINGERPRINT': fingerprint, 'HEALTH': escape(public + '/healthz', quote=True),
                           'RELAY': escape(relay), 'QUERY': escape(urlencode({'room': room}), quote=True),
                  'SETUP': escape(setup_url, quote=True)}
        page = re.sub(r'\b(HINT|LAUNCH|ROOM|FINGERPRINT|HEALTH|RELAY|QUERY|SETUP)\b',
                      lambda match: values[match[0]], page)
        self.reply(page.encode('utf-8'), 'text/html; charset=utf-8')
