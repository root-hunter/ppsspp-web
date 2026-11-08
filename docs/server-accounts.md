# Private server accounts and shared game library

Implements [issue #6](https://github.com/root-hunter/ppsspp-web/issues/6) for self-hosted instances. Sign in from the **Server** tab before starting PPSSPP. Each account has its own saves, save states and emulator configuration. Games in the server library are available to all authenticated accounts; installing a game downloads a local copy without removing the server original.

Guest saves remain in their existing local profile. Signing in creates a separate profile; export guest saves from **Saves**, sign in, then import and back them up if you want to migrate them. Local game installations remain shared within the browser.

## Enable with Docker Compose

From the repository root:

1. Create a `server-games` directory. Put game images you want to make available there. Supported extensions: ISO, CSO, CHD, PBP, ELF and PRX. Use filenames of up to 204 characters containing letters, numbers, spaces, dots, underscores or hyphens, starting with a letter, number or underscore. Symlinks and subdirectories are excluded. For multi-file homebrew packages, use the existing local ZIP import instead.
2. In `.env`, set:

   ```dotenv
   PPSSPP_ACCOUNT_DATA=/data/accounts
   PPSSPP_SERVER_GAMES_PATH=./server-games
   ```

3. Rebuild and start the instance:

   ```sh
   docker compose up -d --build
   docker compose exec ppsspp-wasm-server python3 account_admin.py alice
   ```

   The command asks for a password twice, without putting it in shell history or process arguments. Passwords require at least 12 characters. Run it once for each friend. Running it again resets the password and revokes that user's sessions while preserving their identity and saves.
4. Open the instance over HTTPS and sign in under **Server**. Use **Refresh** to discover games added by the operator. **Install locally** streams a game into browser storage; select it from **Library** to play.

Accounts are disabled unless `PPSSPP_ACCOUNT_DATA` is configured. The existing relay keys are independent of these accounts. The persistent `/data` volume contains both stores; the library is mounted read-only at `/library`. Keep both when updating containers. Do not commit game images or databases to Git.

For a standalone Python server:

```sh
export PPSSPP_ACCOUNT_DATA=/absolute/private/ppsspp-accounts
export PPSSPP_SERVER_GAMES=/absolute/private/psp-games
python3 server/account_admin.py alice
python3 server/serve.py --https
```

Both directories must be outside the served web and WASM roots; the server rejects a configuration that would expose them as static files. Game files must be readable by the container's UID 10001. Back up the account volume and library separately while the service is stopped, or use SQLite's backup API for a live database backup.

## Save synchronization and conflicts

- Login restores the server snapshot into a dedicated local account profile before launch. Restores are staged in a new directory; a failed write keeps the previous local copy. One previous restored generation is kept locally for recovery.
- The browser backs up the account profile every 30 seconds while PPSSPP is running. **Back up saves now** also flushes live emulator files. Wait for the backup status before closing the browser. Closing a tab or killing the browser can lose changes since the last successful backup.
- The server commits complete snapshots atomically in SQLite. Each update must include the revision it was based on. If two browsers play concurrently, the stale update receives HTTP 409; it cannot replace the newer snapshot. Backup stops and reports the conflict.
- Reload retries connection failures. If both local and server data changed, launch stays blocked. Export the local saves, reload, and use **Restore server saves** to select the server version. This replaces the local snapshot, including deletions, and requires confirmation. Restore and account changes require an emulator reload.
- A returning browser with unsynced local progress can upload it if its server revision is still current. It will not silently discard that progress if the server has changed.
- Browsers supporting Web Locks allow only one running emulator per account in the same browser profile. Close or reload the playing tab before launching another one. On older browsers without Web Locks, use one playing tab per account.
- There is no automatic merge of PSP save files. Export/import lets you recover individual slots before backing up the selected version.

## Deployment and limits

The UI and `/api/account/*` must use the same HTTPS origin. The included full Docker image serves both. GitHub Pages alone has no account backend; a standalone relay must be placed behind a same-origin proxy alongside the web app to provide this feature. The relay deployment's Caddy configuration forwards the API, and its Compose file supports the same optional account and library variables. Provision relay accounts with `docker compose exec relay python3 account_admin.py alice`.

Passwords use salted scrypt; session tokens are random, stored hashed on the server, and expire after seven days. The browser keeps the token in session storage, so a new browser session signs in again. Password resets revoke all account sessions. Ten login attempts per source address are allowed per 15-minute window. Behind a proxy the source address is the proxy, so this limit is shared; apply per-client rate limiting at the trusted edge when needed. Forwarded address headers are deliberately not trusted by the Python server.

Snapshots are limited to 64 MiB of JSON and 10,000 files per account. Invalid paths, duplicate entries, malformed base64, traversal and unauthorized game downloads are rejected. Game downloads and account API responses use `Cache-Control: no-store`; the service worker never caches the account API. ISO transfers stream to OPFS instead of buffering the entire game in JavaScript memory.

There is no public registration, email recovery, browser upload endpoint or per-game sharing ACL. The operator provisions accounts and manages the shared library on disk. All authenticated accounts can read that library. Protect access with HTTPS and keep regular backups of the persistent volume.

## Verification

```sh
python3 -m unittest discover -s server/tests -v
cd wasm-page
npm test
npm run build
cd ..
node scripts/test-accounts-browser.mjs
```

The account integration tests exercise real HTTP requests, per-user isolation, persistent storage reopening, session expiry/revocation, password reset, concurrent writes, stale revisions, input limits and authenticated library access. Runtime tests cover conflict handling, new-browser restore, isolated profiles, failed staged restores and service worker exclusion.
