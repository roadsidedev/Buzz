#!/bin/sh
# =============================================================================
# COTURN entrypoint — inject runtime secrets into config file (M11).
#
# COTURN_SECRET and COTURN_EXTERNAL_IP are taken from environment variables
# and written into /etc/turnserver.conf at startup.  This prevents both values
# from appearing in process args (visible via `ps aux`) or `docker inspect`
# output, which would expose them to any user with Docker socket access.
# =============================================================================
set -eu

CONF_TMPL="/etc/coturn/turnserver.conf.tmpl"
CONF_OUT="/etc/coturn/turnserver.conf"

# Validate required environment variables
if [ -z "${COTURN_SECRET:-}" ]; then
  echo "[entrypoint] FATAL: COTURN_SECRET environment variable is not set." >&2
  exit 1
fi

if [ -z "${COTURN_EXTERNAL_IP:-}" ]; then
  echo "[entrypoint] FATAL: COTURN_EXTERNAL_IP environment variable is not set." >&2
  exit 1
fi

# Copy template and append the runtime-only settings.
# We never embed them in the template itself so the file at rest does not
# contain secrets (the template is baked into the image layer).
cp "$CONF_TMPL" "$CONF_OUT"

cat >> "$CONF_OUT" <<EOF

# ── Injected at startup by docker-entrypoint.sh ───────────────────────────
# These lines are NOT in the baked image; they are written to a tmpfs-backed
# path and are absent from the image layer and docker inspect output.
static-auth-secret=${COTURN_SECRET}
external-ip=${COTURN_EXTERNAL_IP}
EOF

# Restrict config file to root-only read so no container process can
# trivially read back the secret.
chmod 600 "$CONF_OUT"

echo "[entrypoint] Configuration written to $CONF_OUT — starting turnserver."
exec "$@" -c "$CONF_OUT"
