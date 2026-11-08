# RetroAchievements in the web build

The Achievements tab uses PPSSPP's existing rcheevos client. The core identifies
PSP games, reads emulated memory each frame, submits unlocks and leaderboards,
reconnects, and displays its native achievement notifications. The dashboard
shows the current game's core achievement set, unlock state, points and measured
progress. It does not award achievements from game filenames or shell events.

## Build and setup

Rebuild the WASM core as well as the Angular shell:

```sh
make wasm-release
make app-build
make serve-only
```

The source changes include `deps/ppsspp-wasm` (the core submodule). When sharing
this work, commit/publish those changes in the submodule and update the parent's
pinned revision. An old WASM binary cannot provide the new bridge; the tab reports
that an updated build is required.

1. Open **Achievements**, enable RetroAchievements and save settings.
2. Start PPSSPP without selecting a game, then reopen the web dashboard and sign
   in. The dashboard services sign-in even while its menu pauses the native loop.
3. Start a supported game from the PPSSPP browser. For subsequent launches the
   core restores the account token from the current browser profile.
4. Return to the PPSSPP browser before signing out, changing the account or
   changing Hardcore. Restart the game after changing the account or mode.

Hardcore is opt-in in the web shell. Restrictions on state loading, cheats and
slowdown are enforced by the existing PPSSPP core. The tab distinguishes the
configured option from Hardcore being active for an identified game. Game
recognition depends on the exact image/hash supported by RetroAchievements.
Unsupported games can still be played without achievements.

## Gateway and static hosting

The Python web server and relay image expose `/api/retroachievements`. The WASM
HTTP request manager uses asynchronous Emscripten Fetch instead of native sockets.
XHR creation/cancellation occurs on the browser thread, including when WLAN
emulation runs on a worker that does not yield to a JavaScript event loop.
Completed responses are processed by the native request manager.

When serving the app with the Python server, leave Gateway URL empty. For GitHub
Pages or another static host, configure the full HTTPS URL of an updated relay,
for example `https://relay.example/api/retroachievements`, before starting PPSSPP.
The relay must be reachable from the browser. There is no automatic third-party
credential gateway. Direct HTTP is accepted only for loopback development.

The gateway accepts form POSTs to the fixed RetroAchievements `dorequest.php`
endpoint and GETs for PNG badges, game images and user pictures on the fixed media
host. It rejects arbitrary destinations, redirects, URL credentials and API query
strings. Request bodies are limited to 64 KiB; responses to 8 MiB, with a 30-second
upstream timeout. CORS allows static hosts without cookies or credentialed CORS.
API and image responses use `no-store`; the service worker bypasses all API routes.

Use a gateway you trust: the password and login token pass through that server
on their way to RetroAchievements. The gateway does not persist them or log
request bodies/query strings. The native bridge publishes only public account
and game state. The password field is cleared after sign-in; PPSSPP stores the
login token in its local secret file. That file is excluded from exported save
bundles, Google Drive saves and private-server account synchronization. Replacing
a synchronized save snapshot preserves the existing browser-local token. A fresh
browser must sign in separately.

## Validation

```sh
npm --prefix wasm-page test
npm --prefix wasm-page run build
python3 -m unittest discover -s server/tests
node scripts/test-retroachievements-browser.mjs
```

The browser test uses a simulated native bridge to verify the actual rendered
UI, password clearing, paused-loop polling, unsaved settings, in-game locks,
safe text rendering and the local gateway's rejection of unsupported hosts.
Gateway tests mock RetroAchievements responses and cover authentication errors,
CORS, size limits, redirects and network failures. The modified request manager
and achievements source have also passed an Emscripten syntax compilation.

A live RetroAchievements login, an actual in-game unlock, token re-login after a
reload, Hardcore restrictions during play, badge downloads and loss/recovery of
network access still require verification with a rebuilt core and a real account
and supported game. The source checks and simulated bridge test do not establish
that end-to-end result. No account credentials or supported game were available
for that verification in this implementation session.

References: [rcheevos integration](https://github.com/RetroAchievements/rcheevos/wiki/rc_client-integration)
and [Emscripten Fetch](https://emscripten.org/docs/api_reference/fetch.html).
