#!/usr/bin/env python3
"""Create an account or reset its password (also revokes all its sessions)."""
import argparse
import getpass
import os
from accounts import Accounts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', default=os.getenv('PPSSPP_ACCOUNT_DATA'))
    parser.add_argument('name')
    args = parser.parse_args()
    if not args.data:
        parser.error('Set PPSSPP_ACCOUNT_DATA or pass --data')
    password = getpass.getpass('Password (at least 12 characters): ')
    if password != getpass.getpass('Confirm password: '):
        parser.error('Passwords do not match')
    try:
        uid = Accounts(args.data).set_password(args.name, password)
    except ValueError as exc:
        parser.error(str(exc))
    print('Account ready: ' + args.name + ' (' + uid + ')')


if __name__ == '__main__':
    main()
