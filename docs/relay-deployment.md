# Public relay on Oracle

The `wasm-pages.yml` workflow builds the Pages application and the relay image
in separate GitHub-hosted jobs. The relay image is published to
`ghcr.io/<owner>/<repository>/relay` with `sha-<commit>` and `latest` tags,
for both `linux/amd64` and `linux/arm64` (Oracle Ampere).
Deployments use the immutable digest returned by that build.

Pushes to `wasm`, and manual workflow runs selecting `wasm`, publish and deploy
the relay. Pull requests run the Python tests and Docker build on GitHub-hosted
runners only. The Oracle job uses `runs-on: self-hosted` and starts as soon as
the relay image is ready; it does not depend on the longer WASM build.
Concurrent relay deployments are serialized.

## Oracle prerequisites

1. Install Docker Engine, the Docker Compose v2 plugin (supporting `up --wait`),
   Bash and curl on the Oracle Linux host. The runner account must have access
   to the Docker daemon without interactive sudo.
2. Register a Linux GitHub Actions runner for this repository with the
   `self-hosted` label and install it as a service. Ensure this label selects
   the intended Oracle machine; if the repository has other self-hosted
   runners, add a dedicated label to the workflow's `runs-on` selector.
3. Point a public DNS hostname, e.g. `relay.example.com`, at the instance's
   public IP. Any AAAA record must also point to a working IPv6 listener.
4. Allow inbound TCP 80 and 443 in the Oracle VCN security list/NSG and host
   firewall. Optionally allow UDP 443 for HTTP/3. These ports must be free on
   the host. The relay's ports 8081 and 27312 are not published.
5. Allow outbound HTTPS for GHCR, GitHub Actions and ACME certificate issuance.

## GitHub configuration

Create the `oracle-relay` GitHub environment and set these Actions variables
there (repository variables also work):

| Variable | Example | Purpose |
| --- | --- | --- |
| `RELAY_DOMAIN` | `relay.example.com` | Public DNS hostname, without scheme, path or port |
| `ACME_EMAIL` | `admin@example.com` | Certificate authority contact email |

The workflow uses its automatic `GITHUB_TOKEN`: `packages: write` in the build
job and `packages: read` in the deploy job. No registry PAT is needed for a
package created by this repository. If the GHCR package already exists, grant
this repository Actions access to it in the package settings. Configure any
desired deployment branch restrictions on the `oracle-relay` environment.

No local `.env` or LAN certificate is copied to Oracle. The workflow writes its
deployment configuration to `~/ppsspp-relay` under the runner account, then runs
`docker compose pull` and `docker compose up -d --no-build --wait`. Registry
credentials use a temporary Actions Docker configuration and login-action
logs out in its post step. Docker restart policies bring containers back after
a host reboot, provided Docker itself starts at boot.

## HTTPS and client configuration

Caddy terminates HTTPS/WSS on 443, obtains a publicly trusted certificate and
renews it automatically. Its `/data` and `/config` directories use persistent
Docker volumes. Keep these volumes between deployments. TCP 80 serves the
HTTP redirect and ACME validation. This uses Caddy's
[automatic HTTPS](https://caddyserver.com/docs/automatic-https) and native
[WebSocket reverse proxy support](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Set the browser multiplayer relay URL to `wss://relay.example.com/adhoc`.
Check `https://relay.example.com/healthz`: it should return
`{"status":"ok","relay_protocol":1}` with a valid certificate. The deployment
job checks this public HTTPS endpoint after checking internal container health.
Failed checks fail the job and leave the containers available for inspection;
there is no automatic rollback.

The production image contains only the Python relay server. The web application
and WASM remain on GitHub Pages. Caddy forwards `/adhoc`, `/adhoc/*` and
`/healthz`; other routes return 404. The existing root `docker-compose.yml`
continues to provide the LAN web server.

## Operations and rollback

From the Oracle runner account:

```sh
cd ~/ppsspp-relay
docker compose -p ppsspp-relay ps
docker compose -p ppsspp-relay logs --tail 100
```

To roll back, replace `RELAY_IMAGE` in `~/ppsspp-relay/.env` with a previously
published `ghcr.io/<owner>/<repository>/relay@sha256:<digest>`, authenticate to
GHCR if the package is private, and run:

```sh
docker compose -p ppsspp-relay pull
docker compose -p ppsspp-relay up -d --no-build --wait
```

Deployments replace the single relay instance and disconnect active games.
Rooms and connections are held in memory and clients must reconnect. Relay
limits default to 512 connections and a 60-second timeout; optional
`RELAY_MAX_CONNECTIONS` and `RELAY_TIMEOUT` values can be added to the Compose
environment file for manual operation (the next workflow deployment rewrites
that file).

### Optional per-user authentication

Set the `RELAY_AUTH_MODE` variable in the `oracle-relay` GitHub environment to `keys` and run the deployment workflow. The default `open` allows public access. An empty key database in `keys` mode denies everyone until an administrator issues credentials. The `relay-auth` named volume persists the hashed credential database across deployments.

On the server, run these commands from `$HOME/ppsspp-relay`:

```sh
docker compose --project-name ppsspp-relay exec relay python3 relay_admin.py issue --user alice --ttl-hours 168
docker compose --project-name ppsspp-relay exec relay python3 relay_admin.py issue --user bob
docker compose --project-name ppsspp-relay exec relay python3 relay_admin.py list
docker compose --project-name ppsspp-relay exec relay python3 relay_admin.py revoke KEY_ID
```

The plaintext key is shown only at issuance. Give each user their own key; they enter it in Network before testing or launching. Invitations omit the personal credential by default; selecting **Include my session key** shares access as that user. Revoking or expiring a key blocks further access and disconnects its active sockets without interrupting other users. Database errors deny access. Back up the protected `relay-auth` volume and restrict container/host access: the CLI is the administration boundary, with no public management endpoint.
