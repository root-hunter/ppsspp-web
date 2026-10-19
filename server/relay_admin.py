#!/usr/bin/env python3
"""Local-only relay credential management. No HTTP administration endpoint."""
import argparse
from datetime import datetime, timezone
import json
import os
import sqlite3
from relay_auth import KeyStore


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', default=os.getenv('RELAY_AUTH_DB', '/data/relay-auth.sqlite3'))
    commands = parser.add_subparsers(dest='command', required=True)
    issue = commands.add_parser('issue', help='Create a key; plaintext is displayed only once')
    issue.add_argument('--user', required=True)
    issue.add_argument('--ttl-hours', type=float)
    commands.add_parser('list', help='List key IDs, owners and validity, never secrets')
    revoke = commands.add_parser('revoke', help='Revoke a key and disconnect its active sockets')
    revoke.add_argument('id')
    args = parser.parse_args()
    try:
        store = KeyStore(args.db)
        store.initialize()
        if args.command == 'issue':
            key_id, key = store.issue(args.user, args.ttl_hours)
            print(json.dumps({'id': key_id, 'user': args.user, 'session_key': key}))
        elif args.command == 'revoke':
            if not store.revoke(args.id):
                parser.exit(1, 'Unknown or already revoked key ID\n')
            print('Revoked ' + args.id)
        else:
            now = datetime.now(timezone.utc).timestamp()
            for key_id, user, created, expires, revoked in store.list():
                status = 'revoked' if revoked is not None else 'expired' if expires is not None and expires <= now else 'active'
                print(json.dumps({'id': key_id, 'user': user, 'status': status,
                                  'created': created, 'expires': expires}))
    except (ValueError, OSError, sqlite3.Error) as exc:
        parser.exit(1, str(exc) + '\n')


if __name__ == '__main__':
    main()
