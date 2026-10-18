#!/usr/bin/env python3
"""Give the three matched emulator artifacts one stable cache revision."""
import hashlib
import json
import pathlib
import sys

build = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
revision = hashlib.sha256()
for name in ('PPSSPPSDL.js', 'PPSSPPSDL.wasm', 'PPSSPPSDL.data'):
    revision.update(name.encode())
    with (build / name).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            revision.update(chunk)
output.write_text(json.dumps({'revision': revision.hexdigest()}, indent=2) + '\n')
