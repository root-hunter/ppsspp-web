# Browser Ad Hoc multiplayer

The browser path uses the existing PSP Ad Hoc HLE, with its socket operations routed through WSS to the Python relay. Matching remains PSP/HLE matching over PDP; this is not input synchronization. Gameplay compatibility must be established with a real game, separately from transport tests.

## Audit and reuse

Checked core: `0dbfaca62a8a924abc2c5dd5dd0733b668e5e68a`, branch `wasm`. There is no release tag on this checkout (`git describe --always --tags` returns the SHA). WebAssembly uses SDL, WebGL2, SIMD, shared memory and an existing pthread pool. The original SDL path ran rendering and NativeFrame on the browser main thread. With WASM_THREADED_ADHOC=ON (default), WLAN-enabled sessions now run NativeFrame on an existing Emscripten pthread; WebGL submission and WebSocket delivery stay on the browser main thread. The friend-finder also uses a pthread. Networking-disabled sessions retain the original path. No extra browser worker framework was added.

Actual checked-out networking locations:

- `Core/HLE/sceNetAdhoc.cpp`: Ad Hoc initialization, **Adhocctl is in this file too**, PDP/PTP, group operations, socket wait requests and PSP timeout/error handling.
- `Core/HLE/proAdhoc.cpp` / `.h`: PRO lobby login, peer/IP/MAC resolution, friend-finder thread and shared networking helpers.
- `Core/HLE/sceNetAdhocMatching.cpp`: PSP matching, using PDP. The relay does not replace its state machine.
- `Core/HLE/proAdhocServer.cpp`: native built-in PRO server, left available for native builds.
- `ext/aemu_postoffice`: upstream native relay client and reference server, retained.
- `server/serve.py` and the former runtime `installSockFSAdhocRelay`: existing Python PRO/PU1/PT1 relay and SOCKFS hooks formed the starting point.

The existing HLE already schedules blocking PSP calls through socket requests and PSP thread waits. Browser sockets themselves must stay nonblocking. The old Python server had no group authorization on data forwarding, allowed MAC impersonation in query strings, reused virtual IPs after 253 users, accepted unbounded frames, and wrote frames concurrently without serialization. The old browser hook routed the PRO control connection to the PTP connector, did not assign a useful local virtual address, ignored disconnects and accumulated unbounded pending data. Settings forced the page hostname and a separate port, overriding custom endpoints. These paths were replaced or repaired, not the PSP HLE.

Native adapter discovery, UDP broadcasting, listening TCP sockets, UPnP and direct PRO TCP cannot operate as native networking in a browser. `AdhocSocket.h` explicitly marks HLE sockets on the main thread after `socket()`. SOCKFS hooks only handle marked sockets; other emulator networking retains its normal backend. Native builds call the same ordinary `socket()` without browser code. Browser local-IP discovery uses the relay's virtual address and never probes Google's DNS via a WebSocket.

Recent upstream sources were inspected at [PRO networking](https://github.com/hrydgard/ppsspp/blob/master/Core/HLE/proAdhoc.cpp) and [Ad Hoc HLE](https://github.com/hrydgard/ppsspp/blob/master/Core/HLE/sceNetAdhoc.cpp). They retain the PRO peer model and native postoffice branches used here. This change does not import unrelated upstream changes. The [postoffice design](https://github.com/Kethen/aemu_postoffice/blob/main/design.md) also separates discovery from data and uses MAC/port endpoints. Its native TCP handshake and accept-socket protocol differ from PU1/PT1 WebSocket framing. **Native desktop/Android clients cannot connect to this browser relay without an adapter.** Native PPSSPP/postoffice builds remain unchanged.

## Launch and use

Core source edits live in the submodule checkout. A matching patch is included at `patches/ppsspp-wasm-adhoc.patch` so the changes are preserved independently of an uncommitted submodule pointer. On a fresh checkout of the pinned core, apply it once with `git -C deps/ppsspp-wasm apply ../../patches/ppsspp-wasm-adhoc.patch`; do not reapply it to the already modified checkout. Commit/publish the core changes separately before advancing the parent repository's submodule pointer.

Build the core using the existing `make wasm-release` path and then:

```sh
docker compose up --build -d
```

The single container serves the Angular application, mounted WASM assets and `/adhoc` WSS on port 8081. It does not need game files, save data or a database. The WASM root is mounted read-only. `WASM_ROOT` can select a different checkout/build directory. The normal application expects `build-wasm-release/` or `build-wasm/` under that root.

Open `https://your-host:8081`, enable networking in Network, leave the discovered WSS URL or enter a complete `wss://host[:port]/adhoc` URL, choose the same room on both clients, and save **before starting PPSSPP**. Use distinct browser profiles or independent tabs; identity persists across reloads within a tab. Duplicate MACs in a room are rejected, rather than silently replacing a player. Nickname and MAC are applied to PPSSPP's INI along with WLAN enablement, disabled UPnP/native postoffice and the established port offset.

The Network panel shows a text status and colored indicator. Green means the game is registered with the relay; blue means a recent connection check passed but no game connection is active. Amber indicates a connection/check in progress, red indicates a failure or offline device, and gray indicates disabled, unchecked or disconnected networking. Checks refresh every 30 seconds while the Network panel is visible and multiplayer is enabled. A successful check closes its temporary socket and never claims the game is connected. Connection controls and player identity are under **Player identity & connection controls**; detailed protocol information is under **Technical diagnostics**.

The room adds isolation around the game's actual PRO game ID and eight-byte PSP group; it does not force or rewrite game-created groups. Enter the game's native multiplayer menus to create and discover sessions. Live diagnostics reflect control registration, actual game/group packets, peers, PDP counts, PTP socket states, queue bytes/depth, measured heartbeat RTT and errors. The Check connection button checks WebSocket reachability and access-key acceptance only. Disconnect closes real core transports. Reconnect queues a request on the core friend-finder thread to close the old control connection, report disconnection and log in again. Rejoin through the game's multiplayer menu. Mid-match resumption is not implemented. Settings changes require restarting PPSSPP.

When connecting from another LAN device, use the server machine's LAN address in the relay URL, for example `wss://192.168.10.172:8081/adhoc` (replace the example IP with the server's current address). `localhost` on the other device refers to that device, and Docker bridge addresses such as `172.30.0.1` in the logs are not the address to configure. Both players must use the same relay and room. First open `https://<server-LAN-IP>:8081/healthz` on each device to check reachability and resolve any certificate warning for your local server. A successful health check verifies HTTP availability; the Network Check connection button separately verifies the WebSocket upgrade.

The container generates a self-signed certificate for local testing in its TLS volume. Local-network permission does not establish certificate trust. For internet deployment use a trusted certificate or terminate TLS at a reverse proxy. HTTP/WS is permitted for local development; HTTPS pages require WSS. Example reverse proxy:

```nginx
location / {
    proxy_pass https://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 90s;
    proxy_buffering off;
}
```

Keep the application's COOP/COEP/CORP response headers. A proxy path prefix can be included in the configured endpoint when the proxy strips that prefix. Only port 8081 needs publishing. The optional legacy separate-port listener uses the same v1 authentication/framing; it is not native TCP compatibility.

### Invitations and optional relay authentication

In **Network → Play with friends · QR & invitation**, create a QR or copy the link after entering the relay URL, room and optional session key. Invitations use the current application URL, including its Pages base path; use a hostname reachable by friends, not localhost. Scan with a phone camera, the built-in camera scanner, or upload a QR image. Pasting an invitation link works without camera access. Generation and image decoding happen locally in the browser.

Opening/importing an invitation enables networking and saves relay and room, while preserving each player's nickname and MAC. It does not launch a game. Restart PPSSPP if already running, load the same game version, then host/join inside the game's multiplayer menu. Changing saved settings requires restarting the emulator.

Set `RELAY_AUTH_MODE=keys` on the server to require individually issued credentials on every control and data WebSocket upgrade. The default `open` mode allows public access. An invalid mode prevents startup. Keys mode with no issued credentials permits no clients. The persistent `/data/relay-auth.sqlite3` database stores only SHA-256 hashes of random 256-bit secrets, user labels, IDs, creation/expiry times and revocation timestamps.

Manage credentials locally inside the container (use service `ppsspp-wasm-server` for local Compose, `relay` for production):

```sh
docker compose exec relay python3 relay_admin.py issue --user alice --ttl-hours 168
docker compose exec relay python3 relay_admin.py issue --user bob
docker compose exec relay python3 relay_admin.py list
docker compose exec relay python3 relay_admin.py revoke KEY_ID
```

`issue` displays the plaintext key only once. Give each user their own key and enter it in the client's **Session key** field. `list` never exposes secrets. `revoke` blocks new upgrades and closes that user's existing control/data sockets within approximately one second; other users stay connected. Expiry has the same effect. Invalid/missing credentials receive HTTP 401. Data sockets also need the credential used by their control connection. Database failures fail closed. Keep the `relay-auth` volume across container upgrades. For production configure the `RELAY_AUTH_MODE` GitHub environment variable to `keys`; local Compose reads `.env`.

The key is kept in browser session storage, separate from the ephemeral per-browser capability, with an in-memory fallback if browser storage is unavailable. Check **Include my session key** only when you intend to share your credential; by default invitations share relay and room only. A keyless invitation preserves your existing personal key for the same relay and clears it when switching relays. When included, the key is placed in the URL fragment (not the initial HTTP request); importing removes the fragment from the address bar. An invitation grants access as the user whose key it contains: issue a separate key per friend when independent revocation is needed. Keys travel in the WSS upgrade query, so keep TLS enabled and avoid proxy logging of query strings. Room names remain grouping settings. There is no HTTP administration endpoint; CLI access requires access to the container host.

The old certificate setup service and its separate HTTP port have been removed. Certificate trust must be configured on each client before WSS use.

### Android certificate trust on a LAN

`ERR_CERT_AUTHORITY_INVALID` means the browser does not trust the relay's certificate issuer. The generated self-signed certificate is intended for initial local testing. For Android LAN use, issue a server certificate with the server's LAN IP in its Subject Alternative Names and install its local CA certificate on each client device. [mkcert](https://github.com/FiloSottile/mkcert#mobile-devices) supports this workflow. Store local CA material under the ignored `server/local-ca/` directory; keep `rootCA-key.pem` and server private keys private. Transfer only the public CA certificate (`rootCA.pem`, optionally renamed to `ppsspp-relay-ca.crt`) to the phone.

On Android, use Settings → Security → Encryption & credentials → Install a certificate → CA certificate (labels vary by device; see [Google's instructions](https://support.google.com/pixelphone/answer/2844832)). Restart the browser, then open `https://<server-LAN-IP>:8081/healthz` and verify that certificate validation succeeds before testing WSS. Other clients also need to trust this CA. If the LAN IP changes, reissue the server certificate for the new IP; the existing CA can still be used. The active Compose certificate and key live in the persistent `relay-tls` volume at `/certs/cert.pem` and `/certs/key.pem`, not in the checkout's `server/cert.pem` and `server/key.pem`.

Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PPSSPP_PORT` | 8081 | Published HTTPS port (Compose) |
| `WASM_ROOT` | `./deps/ppsspp-wasm` | Read-only core assets mount |
| `RELAY_AUTH_MODE` | `open` | `open` for public access, `keys` for per-user credentials |
| `RELAY_AUTH_DB` | `/data/relay-auth.sqlite3` | Persistent credential database |
| `RELAY_MAX_CONNECTIONS` | 512 | Maximum simultaneous connections, including incomplete upgrades |
| `RELAY_TIMEOUT` | 60 | Idle socket timeout, seconds |
| `RELAY_LATENCY_MS` | 0 | Artificial delay per forwarded message, development only |
| `RELAY_JITTER_MS` | 0 | Uniform +/- jitter, clamped to nonnegative delay |

`/healthz` returns relay protocol version 1. Logs are JSON for registration, groups and connection errors, with no packet logging or administrative API. SIGTERM closes live and incomplete connections and joins handlers. WebSocket compression is never negotiated.

## Wire protocol and scheduling

All upgrades require subprotocol `binary`, `v=1`, a random 128-bit capability (`token`) and, for control, a room. Data sockets must present the same capability and MAC as a logged-in control connection. Capabilities are ephemeral, never stored in the INI and not a substitute for user authentication or private-room access controls. In `RELAY_AUTH_MODE=keys`, every upgrade also requires `session_key`. On an open relay, rooms are accessible to anyone who knows the room name.

- `/adhoc`: existing packed PRO control packets, including 144-byte login, 9-byte connect, scan, disconnect, chat and ping. Login yields a transport-only `PA1` + four network-order IPv4 bytes. The adapter consumes this acknowledgement and exposes only real PRO notifications to the HLE. Virtual IPv4 addresses are internal aliases for registered PSP MACs.
- `/adhoc/udp`: `PU1`, one-byte ASCII host length, host, big-endian uint16 port, then a complete datagram. Source metadata is reconstructed by the relay from the registered owner, never trusted from the packet. Broadcast `255.255.255.255` reaches matching ports in the same room/game/group, excluding the sender.
- `/adhoc/tcp-listen`: multiplexed `PT1`, kind byte, big-endian uint32 connection ID. Kind 1 adds source host length/host/port; kind 2 carries stream bytes; kind 3 closes the connection. IDs belong to a single authenticated listener.
- `/adhoc/tcp-connect`: source port and virtual destination in the upgrade query; raw binary stream payload after upgrade. Upgrade succeeds only with an authorized, available listener. Closing either endpoint closes its counterpart. The PSP/core controls listen/accept/send/receive semantics.
- Control `PR1` + float64 monotonic timestamp is echoed for transport RTT, consumed before HLE delivery. WebSocket ping/pong keeps idle data sockets alive independently of rendering.

Socket creation and proxying use the existing Emscripten pthread configuration. Socket operations on the browser main thread install callbacks, move bounded packets and perform zero-timeout polls. The WLAN emulation worker can wait for GPU fences and native frame pacing; GLRenderManager drains its queue without waiting on the browser thread. Networking-disabled sessions retain inline queue draining. Connection attempts return EINPROGRESS, empty reads return EAGAIN, congestion returns EAGAIN, close/errors propagate to the HLE. A 10-second browser connection watchdog catches an unresponsive upgrade. The core's PSP timeout and retry scheduling remain authoritative.

Masked WebSocket fragments are reassembled within the same bounded message limit, with ping/pong allowed between fragments. Maximum PSP payload is 65,535 bytes; frame limit is payload plus 64 bytes of metadata. Outbound buffers are bounded by 256 frames and 1 MiB per server connection; browser receive buffers by 256 packets and 1 MiB. Browser WebSocket bufferedAmount is capped at 1 MiB. Slow server recipients are disconnected; browser producers get EAGAIN instead of silent drops or unlimited growth. Each connection has its own ordered writer; one recipient cannot block routing under the lobby lock. Artificial jitter does not reorder a connection's messages.

WSS runs over TCP: loss can delay later datagrams on a single PDP socket, and multiplexed PTP accepts share their listener's WSS connection. Separate socket connections avoid serializing all gameplay traffic globally. No claim of internet fighting-game latency is made from loopback tests. Heartbeat RTT includes both relay queues; the browser report's CDP echo measurements additionally include automation and polling overhead.

## Automated validation

```sh
make test-multiplayer
npm --prefix wasm-page test
npm --prefix wasm-page run build:pages
node scripts/test-network-invites-browser.mjs
```

For the actual WASM test probe (kept out of normal builds):

```sh
make -C deps/ppsspp-wasm wasm-release-config WASM_RELEASE_BUILD_DIR=build-wasm-multiplayer
emcmake cmake -S deps/ppsspp-wasm -B deps/ppsspp-wasm/build-wasm-multiplayer -DWASM_ADHOC_TESTS=ON
cmake --build deps/ppsspp-wasm/build-wasm-multiplayer -j6
docker compose up --build -d
PPSSPP_TEST_ORIGIN=https://127.0.0.1:8081 make test-multiplayer-browser
```

The browser script uses Chromium's DevTools Protocol and Node's built-in WebSocket, avoiding an additional test dependency. `CHROME`, `PPSSPP_TEST_ORIGIN`, `PPSSPP_TEST_BUILD` and `PPSSPP_TEST_REPORT` are configurable. It creates two isolated contexts, loads the full compiled PPSSPP core in each and calls the C++ socket probe, which uses the same `CreateAdhocSocket` boundary as the HLE. It checks PRO login/group/peer bytes received through WASM, virtual identity, real WSS, PDP echo/broadcast/order/boundaries, EAGAIN, PTP listen/accept/bidirectional traffic and close. It does **not** execute a PSP game, game matching callbacks or an entire `sceNetAdhoc*` syscall sequence. The small public harness fails if probe exports are absent in a normal build.

The server tests use real TCP and masked binary WebSocket frames with no third-party Python packages. Unit tests exercise the actual browser adapter's codec, route selection, backpressure, receive limits and failures. See `multiplayer-validation.md` for results and unverified acceptance criteria.

## Tekken 6 validation checklist

Use two legally obtained dumps of the same compatible region/revision; do not put them in the relay container or repository. No Tekken assets are supplied by this feature.

1. Start the container and confirm its health check is healthy. Open the application in two independent browser profiles/devices over trusted HTTPS.
2. Enable networking, configure the same relay/room, distinct MACs and recognizable nicknames; save and launch the same Tekken 6 version.
3. Enter native multiplayer mode on each. Verify live core login and matching game IDs; establish two WSS connections without a second certificate/port prompt.
4. Create/advertise a session on A. Scan on B, verify A's nickname/MAC, join and confirm the same game-created group and one peer on each side.
5. Complete the game's matching/connection flow and reach character selection on both. Record PDP counters and PTP states as used by that version of the game.
6. Select characters, start Versus, play to completion without a network error, then start and finish a rematch.
7. Leave multiplayer and verify peer removal and endpoint cleanup. Re-enter to verify reconnect; also interrupt the relay and verify an error rather than an emulator hang.
8. Repeat across two internet connections. Record browser/core versions, region/revision, network RTT, packet/queue diagnostics and any disconnect. Repeat with `RELAY_LATENCY_MS=30 RELAY_JITTER_MS=10` for development conditions.
9. Disable networking, restart PPSSPP and verify the existing single-player flow with a legal game.

Real Tekken discovery, character selection and combat were exercised locally in two visible hardware-accelerated Chrome windows. See the validation report for measured speed and the remaining complete-match, rematch and WAN checks. Transport tests alone do not establish those results.

## Browser multiplayer pacing

When WLAN is enabled, SDL pumps the Emscripten loop every 4 ms to drain ready render tasks and service browser events. NativeFrame runs on a pthread; native display timing and worker sleeps pace the PSP. The single-thread fallback retains a nonblocking clock gate. The scheduler checks the actual Emscripten timing mode, because SDL swap interval changes can otherwise silently restore RAF after initial configuration. WASM_THREADED_ADHOC=OFF selects the older main-thread emulation path for diagnosis.

The default web multiplayer profile disables lag-sync sleeps and frame skipping. The earlier experiment that ended a host slice on an empty PDP receive was removed: socket wait scheduling and would-block results remain in the existing HLE, while the browser can now receive messages independently of emulation.

The WASM GL queue caches uniform values per linked program and location. It suppresses only byte-identical repeats with the same setter kind and size; signed zero, NaN payloads, vector lengths, matrix elements and program changes are preserved. Relinking clears the cache. Native GL builds do not use this cache. In the live Tekken experiment, over 95% of float/matrix uploads were redundant, and suppressing them brought combat to 60 drawn FPS with packets and buttons active. The compiled implementation and regression test are described in the validation report.

Earlier adaptive-skipping measurements around 60 VPS did not establish full-speed Tekken simulation. The user reported severe lag after that version; those intermediate results are retained in the report as history. Networking disabled and the custom performance profile do not receive the multiplayer timing override.

Two additional real-game fixes are relevant: the browser control connection bypasses native AI_ADDRCONFIG DNS resolution for its internal address (the browser resolves the configured WSS URL); and relay heartbeat scheduling is independent of outbound traffic, preventing a busy receive-only PDP socket from expiring after 60 seconds.
