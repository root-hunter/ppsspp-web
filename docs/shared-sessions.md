# Shared Sessions

Shared Sessions streams an emulator running on the host to browsers in the same
relay room. Guests do not need a game file or a running emulator. The host can
continue playing locally and use its existing Ad Hoc multiplayer connection.
This controls **one PSP instance**: guests do not become separate Ad Hoc players.
Separate PSP players require separate emulator instances and game access.

## Use

1. Save the relay URL, room, nickname and optional access key under Network on
   each device. Enabling Ad Hoc multiplayer is optional for streaming.
2. Open Shared Sessions and select Connect to relay on both devices.
3. Start a game on the host, choose Watch only or Remote play, then Start sharing.
4. Guests choose Watch or Play in the room's session list. The stream opens in
   its own game player; Sessions returns to the dashboard without leaving, and
   Return to stream resumes it. Video starts automatically
   muted, including in private browsing; Enable audio turns on sound with a
   user gesture. Fullscreen expands only the player and preserves the game aspect ratio.
5. In Remote play, the host selects Give control beside one guest. Focus the
   guest video to send keyboard or standard gamepad input. Touch controls provide
   a multi-touch PSP pad and analog directions; touching the video itself sends
   normalized multi-touch events to the host, excluding letterbox bars. Return control to host
   revokes permission immediately. Stop / leave session tears down the stream.

The keyboard map shown below the video follows the default QWERTY PSP bindings;
remote keys use the host's configured keyboard bindings. The guest's standard
controller maps to these keys; analog is currently digital with a dead zone.
Local host controls remain available. Up to four guests can join a publication.
All authenticated clients in the same room can discover and watch a publication;
use separate rooms/relay access keys to limit discovery. Only Remote play permits
a host-assigned guest controller. Watch-only guests never receive input authority.

## Transport and deployment

Deploy the updated Python relay **and** rebuild the Angular shell. The new binary
WebSocket endpoint is `/adhoc/sessions`, alongside the existing Ad Hoc endpoints.
It works without an emulated PRO login, so stream-only guests never start WASM.
Authentication, access revocation, connection limits, heartbeat, output queue
limits and signaling rate limits reuse the relay's existing infrastructure.
Discovery is scoped to the configured room; SDP and ICE are only forwarded
between a publishing host and its current guests. A disconnected host removes
its publication and ends every guest membership.

Each guest gets a WebRTC peer connection with canvas video (30 fps, sender video
budget 2.5 Mbit/s) and actual emulator speaker audio, plus an unordered input
DataChannel without retransmissions. Speaker audio is mirrored into a capture
bus, preserving host playback. The emulator canvas retains its WebGL drawing buffer and uses
synchronized presentation, applied at actual context creation rather than only
through Module options (which SDL builds can ignore). A separate capture canvas
is refreshed from that retained buffer, so frames are also produced when the
game canvas is covered by the dashboard. The player displays connection state and decoded frame counts, and
`window.PPSSPPSharedDiagnostics.snapshot()` exposes media counters without
credentials or SDP. Inputs are allowlisted, contain increasing sequence
numbers and complete held-key snapshots, and are limited to the active controller.
Snapshots recover lost releases; after 600 ms without valid input, held keys and
touches are released. Blur, controller revocation and peer teardown also release input.
Negotiation has a 15-second timeout; a failed peer can leave and rejoin.

The relay distributes the existing `RELAY_STUN_URLS`, `RELAY_TURN_URLS` and
short-lived TURN credentials to stream peers. Configure STUN/TURN as described in
[webrtc-hybrid.md](webrtc-hybrid.md) for clients on different networks. TURN can
carry media and DataChannels through restrictive NATs; there is no video-over-
WebSocket fallback. Use HTTPS/WSS outside localhost. Four guests require four
outgoing encodes/streams, so host upload and CPU capacity affect quality. Browser
background throttling still applies; keep the host tab visible while streaming.

## Verification

```sh
python3 -m unittest discover -s server/tests -v
cd wasm-page && npm test && npm run build
# From the repository root; requires local Chrome and Node with WebSocket support:
node scripts/test-shared-sessions-browser.mjs
# Optional: actual WASM host, using build-wasm-multiplayer and cube.cso:
PPSSPP_TEST_REAL_HOST=1 node scripts/test-shared-sessions-browser.mjs
# Two isolated profiles on an already running local instance (unique test room):
PPSSPP_TEST_ORIGIN=https://127.0.0.1:8081 node scripts/test-shared-sessions-browser.mjs
```

The browser test uses two Chromium pages, a real local relay, synthetic animated
canvas and oscillator audio. It verifies actual WebRTC audio/video tracks and
visible video frames, autoplay with the default browser policy, explicit audio
activation, discovery, explicit control grant, a DataChannel keypress, key release
on revocation, and stream cleanup. The optional real-host mode launches the
Angular app and actual PPSSPP WASM with the cube homebrew fixture, using the
production capture bridge and checking movement while the host is in the
background. The origin override uses the existing server and its selected core
build, with the full Angular app on both sides. These tests do not verify game-specific Ad Hoc
interoperability, physical gamepads, or Internet TURN routing.

## Negotiation diagnostics

A guest starts its connection timeout as soon as Join succeeds, including when
no offer arrives. Offer/answer errors and ICE timeouts remain visible beside the
video. Diagnostics include negotiation phase, ICE gathering state and counts of
local/remote candidates. Host membership and connected peers are counted
separately. A browser producing zero candidates can be constrained by WebRTC
privacy policies or extensions; TURN may be necessary for restricted networks.
The app does not change browser privacy settings.

To test missing signaling without waiting forever:

```sh
PPSSPP_TEST_DROP_OFFER=1 node scripts/test-shared-sessions-browser.mjs
```

The player adapts to desktop, landscape and portrait viewports. Touch controls
are offered only to the assigned Remote play controller; Watch only sessions
cannot send input. The Analog overlay currently maps to digital I/J/K/L keys,
matching the existing remote gamepad behavior. Connection counters are behind
Connection info and the dashboard's Connection details rather than covering play.

For desktop/landscape/portrait previews during the browser test:

```sh
PPSSPP_TEST_REAL_HOST=1 PPSSPP_TEST_SCREENSHOTS=/tmp/shared-player node scripts/test-shared-sessions-browser.mjs
```
