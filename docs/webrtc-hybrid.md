# Hybrid WebRTC multiplayer

The default **Automatic** connection mode uses an unordered, non-retransmitting
WebRTC DataChannel for PDP datagrams whenever a peer connection is available.
PRO lobby/control, discovery and PTP byte streams retain their existing WSS
connections. **Network → Player identity & connection controls → Connection
mode → Relay only** disables WebRTC. Save and restart PPSSPP to apply changes.
The emulator core does not require rebuilding. Rebuild/publish both the web shell
and Python relay to enable WebRTC; an older relay remains usable via WSS.

## Routing and fallback

Every PDP socket retains its authenticated WSS endpoint. During ICE negotiation,
without browser WebRTC support, on an older relay, or after optional signaling
fails, datagrams continue over WSS. A connected, open DataChannel carries a
datagram once; it is not simultaneously sent on WSS. Disconnected ICE, failed
connections, full RTC buffers and oversized messages use WSS. Failure does not
raise a game transport error unless the required WSS transport also fails.
Packets already accepted by the unreliable DataChannel may be lost during a
failure; they are not replayed. This follows PDP/UDP semantics.

Negotiation has a ten-second deadline. Failed peer connections stay on WSS until
membership changes or the game reconnects, preventing repeated negotiation during
play. Failed signaling stays on WSS for the current control session. An ICE
connection in the temporary `disconnected` state can resume RTC when it returns
to `connected` without closing its DataChannel.

Broadcasts use the relay unless at least one recipient is RTC-ready. Mixed
broadcasts fan out once per discovered peer: RTC for ready peers and WSS unicast
for the others. Relay capacity is checked before fanout. Legacy peers remain
reachable, and the sender is excluded. The ordinary relay path handles unknown
destinations and loopback.

If a channel fails synchronously after a broadcast has already reached another
recipient and WSS cannot take the remaining packet, that recipient is counted in
`rtc.dropped`. The adapter does not return EAGAIN for the already delivered
broadcast, which would cause duplicate delivery when the caller retries it.

One RTCPeerConnection per peer multiplexes all local PDP ports through negotiated
DataChannel ID 0, label `ppsspp-pdp-v1`, with `ordered: false` and
`maxRetransmits: 0`. The lexicographically lower virtual IP offers SDP. Trickle
ICE is serialized with SDP; early ICE candidates wait for the remote description.
The adapter caps peer connections at 16, pending ICE candidates at 256 and RTC
buffered data at 64 KiB per channel. Extra peers use WSS. Messages including the
eight-byte header must fit both the negotiated SCTP limit and 16 KiB; larger
PSP datagrams, up to the existing 65,535-byte payload limit, use WSS intact.
This avoids application-level fragmentation and its reassembly/reliability cost.

PTP remains on WSS, including accepted streams whose listener fd has closed.
Migrating a live reliable byte stream between SCTP and WSS would require explicit
sequence numbers, acknowledgement/replay and deduplication. This implementation
does not change PTP's ordering or loss guarantees.

## Authorization and wire extension

`/adhoc/signal` is an optional binary WebSocket endpoint under relay protocol 1.
Its upgrade requires the registered control capability, MAC and matching user
credential, exactly like data endpoints. SDP/ICE never enter the PRO HLE stream.
The endpoint uses UTF-8 JSON inside binary messages:

- Server `hello`: version 1 and `iceServers` for the authenticated client.
- Server `peers`: local membership `session` and peer `{ip, session}` entries.
- Client `signal`: destination `to`, local `session`, `targetSession`, and exactly
  one of `description` or `candidate` (including null end-of-candidates).
- Server `signal`: authoritative `sender`, both sessions and the selected payload.

The relay forwards signaling only within the same room, product ID and PSP
group. Membership epochs change on leave/rejoin and signaling replacement;
stale SDP/ICE cannot establish a new authorized link. Signals are capped at
48 KiB, with a 256-message burst and 64 messages/second replenishment. Existing
server queue, heartbeat and credential-revocation rules also cover signaling.
Losing control, leaving a group or receiving peer departure closes RTC locally.
Closing optional signaling removes its peer memberships and falls back to WSS.

RTC data is `PD1`, big-endian uint16 source port, big-endian uint16 destination
port, one reserved zero byte and the complete payload. Sender identity comes from
the authenticated peer link, never from a claimed source IP inside the packet.
Receive delivery requires a current discovered peer and a bound PDP destination;
the existing bounded receive queues and socket error handling still apply.
P2P data bypasses the Python relay, so the relay cannot inspect or enforce each
individual data packet. Standard peer-to-peer ICE can disclose network addresses
to authorized players.

## ICE and TURN deployment

Both Compose files pass these optional environment variables to the relay:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RELAY_STUN_URLS` | empty | Comma-separated `stun:` / `stuns:` URLs |
| `RELAY_TURN_URLS` | empty | Comma-separated `turn:` / `turns:` URLs |
| `RELAY_TURN_SECRET` | empty | Shared secret matching a TURN server using REST authentication |
| `RELAY_TURN_TTL` | 3600 | Credential lifetime in seconds, clamped to 60–86400 |

No third-party STUN or TURN service is contacted by default. Empty ICE settings
allow host candidates, useful on LAN; WSS covers unsuccessful direct connections.
For internet traversal, configure an existing STUN/TURN deployment, for example:

```dotenv
RELAY_STUN_URLS=stun:turn.example.org:3478
RELAY_TURN_URLS=turn:turn.example.org:3478?transport=udp,turns:turn.example.org:5349?transport=tcp
RELAY_TURN_SECRET=<same-secret-as-the-TURN-server>
RELAY_TURN_TTL=3600
```

The relay issues expiring `expiry:user` usernames and base64 HMAC-SHA1
credentials compatible with coturn's `use-auth-secret` / `static-auth-secret`.
It never sends the shared secret to the browser. TURN URLs and secret must be
configured together. Credentials are issued when signaling connects; after their
lifetime a TURN connection may fall back to WSS. Reconnect the game to obtain
fresh credentials. In open relay authentication mode anyone able to register can
obtain temporary TURN credentials; use keys mode for a protected deployment.

Compose does not provision a TURN server. Its listener and relay allocation UDP
ports must be reachable independently of the HTTPS reverse proxy. Caddy's HTTP/3
port does not provide TURN. WSS fallback needs only the existing HTTPS endpoint.
TURN retains a relay hop, so it does not guarantee better latency than WSS.

## Diagnostics and validation

The Network status shows connected WebRTC peers, identifying TURN routes once
ICE statistics are available. Technical diagnostics include `rtc.state`, peer
connection/channel state, selected `direct`/`turn` route, ICE RTT, queue bytes,
RTC send/receive counts, WSS send counts, fallback count and the last optional RTC
error and late-failure drop count. Existing `rttMs` remains the browser-to-relay heartbeat; RTC RTT is the
selected candidate pair's RTT and is sampled every five seconds. Neither measures
game input latency.

```sh
npm --prefix wasm-page test
python3 -m unittest discover -s server/tests -v
npm --prefix wasm-page run build:pages
PPSSPP_TEST_ORIGIN=https://127.0.0.1:8081 \
  PPSSPP_TEST_TRANSPORT=hybrid \
  PPSSPP_TEST_REPORT=/tmp/webrtc-hybrid-browser.json \
  node scripts/test-multiplayer-browser.mjs
```

The browser script defaults to `PPSSPP_TEST_TRANSPORT=websocket` for the legacy
regression suite. Hybrid mode requires a working local direct ICE connection.
It verifies real WASM socket operations, bidirectional DataChannel traffic,
broadcast, larger-datagram WSS fallback, forced peer-connection failure, continued
WSS traffic and the PTP listener lifetime regression. Its `browserRttMs` benchmark
runs 100 sequential 64-byte echoes entirely inside the browsers through real
WASM sockets; CDP only starts and collects the result. Hybrid mode repeats that
benchmark over WSS after forced RTC failure. `cdpInclusiveRttMs` retains the older
automation-inclusive measurement and must not be mixed with these samples.

Local Chromium tests validate the transport, not game compatibility or WAN
performance. Actual gameplay, two physical devices, mobile browsers, Firefox,
packet loss/jitter and real TURN allocations remain separate validation work.
See [WebRTC API](https://www.w3.org/TR/webrtc/),
[RFC 8831](https://www.rfc-editor.org/rfc/rfc8831.html) and
[coturn configuration](https://github.com/coturn/coturn/blob/master/README.turnserver).
