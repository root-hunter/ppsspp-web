#!/usr/bin/env bash
set -euo pipefail

: "${RELAY_IMAGE:?Missing published image digest}"
: "${RELAY_DOMAIN:?Set the RELAY_DOMAIN GitHub variable}"
: "${ACME_EMAIL:?Set the ACME_EMAIL GitHub variable}"

# Only accept a DNS name, without scheme, path or port. Keep .env single-line.
[[ "$RELAY_DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ && "$RELAY_DOMAIN" == *.* ]]
[[ "$ACME_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]
[[ "$RELAY_IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]

[[ "${RELAY_AUTH_MODE:-open}" == open || "${RELAY_AUTH_MODE:-open}" == keys ]] || {
  echo 'RELAY_AUTH_MODE must be open or keys.' >&2
  exit 1
}

# Store ICE settings as literal single-quoted dotenv values. Reject delimiters
# before writing so optional CI configuration cannot inject another setting.
for ice_setting in RELAY_STUN_URLS RELAY_TURN_URLS RELAY_TURN_SECRET; do
  ice_value="${!ice_setting:-}"
  [[ "$ice_value" != *$'\n'* && "$ice_value" != *$'\r'* && "$ice_value" != *"'"* ]] || {
    echo "$ice_setting must be single-line and contain no single quote." >&2
    exit 1
  }
done
[[ "${RELAY_TURN_TTL:-3600}" =~ ^[0-9]{1,6}$ ]] || {
  echo 'RELAY_TURN_TTL must be an integer.' >&2
  exit 1
}

docker info > /dev/null
docker compose version

# Persistent configuration survives Actions workspace cleanup and host reboots.
deploy_dir="$HOME/ppsspp-relay"
mkdir -p "$deploy_dir"
cp "$(dirname "$0")/compose.yml" "$deploy_dir/compose.yml"
cp "$(dirname "$0")/Caddyfile" "$deploy_dir/Caddyfile"
umask 077
printf 'RELAY_IMAGE=%s\nRELAY_DOMAIN=%s\nACME_EMAIL=%s\n' \
  "$RELAY_IMAGE" "$RELAY_DOMAIN" "$ACME_EMAIL" > "$deploy_dir/.env"

printf 'RELAY_AUTH_MODE=%s\n' "${RELAY_AUTH_MODE:-open}" >> "$deploy_dir/.env"
for ice_setting in RELAY_STUN_URLS RELAY_TURN_URLS RELAY_TURN_SECRET; do
  printf "%s='%s'\n" "$ice_setting" "${!ice_setting:-}" >> "$deploy_dir/.env"
done
printf 'RELAY_TURN_TTL=%s\n' "${RELAY_TURN_TTL:-3600}" >> "$deploy_dir/.env"

cd "$deploy_dir"
compose=(docker compose --project-name ppsspp-relay --env-file .env -f compose.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
# Validate Caddy before replacing the running containers.
"${compose[@]}" run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Recreate Caddy too so edits to its bind-mounted configuration take effect.
"${compose[@]}" up -d --no-build --force-recreate --remove-orphans --wait --wait-timeout 120

# Check public TLS as well as the relay container's internal health check.
for attempt in {1..30}; do
  if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 \
    "https://$RELAY_DOMAIN/healthz"; then
    printf '\nRelay ready: wss://%s/adhoc\n' "$RELAY_DOMAIN"
    exit 0
  fi
  sleep 5
done
"${compose[@]}" ps
"${compose[@]}" logs --tail 80
echo 'Public HTTPS health check failed; inspect DNS, certificates and firewall rules.' >&2
exit 1
