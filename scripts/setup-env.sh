#!/usr/bin/env bash
# scripts/setup-env.sh
# Run from project root: ./scripts/setup-env.sh
#
# M15: Added `set -euo pipefail` so any failure (openssl, cp, chmod) aborts
# the script immediately rather than silently producing a broken .env file.
# The output file is created with mode 600 (owner read/write only) before
# secrets are written so a world-readable window never exists.

set -euo pipefail

echo "Setting up Buzz environment..."

# Check if .env exists
if [ -f ".env" ]; then
  echo "ERROR: .env already exists. Back up and remove it to regenerate." >&2
  exit 1
fi

if [ ! -f ".env.example" ]; then
  echo "ERROR: .env.example not found. Run from the project root directory." >&2
  exit 1
fi

# Copy example file
cp .env.example .env

# Restrict permissions BEFORE writing any secrets so no world-readable
# window exists on multi-user systems (M15).
chmod 600 .env

# Generate and append secrets.
# Each openssl invocation is on its own line so a failure on any one of them
# aborts the whole script (set -e) without corrupting the partial file.
JWT_SECRET=$(openssl rand -base64 48)
ENCRYPTION_SECRET=$(openssl rand -base64 32)
BLIND_INDEX_SECRET=$(openssl rand -base64 32)
COTURN_SECRET=$(openssl rand -hex 32)

cat >> .env <<EOF

# Generated secrets — do NOT commit this file
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_SECRET="${ENCRYPTION_SECRET}"
BLIND_INDEX_SECRET="${BLIND_INDEX_SECRET}"
COTURN_SECRET="${COTURN_SECRET}"
EOF

echo ""
echo "✅ .env file created with generated secrets (mode 600)"
echo ""
echo "Required actions:"
echo "1. Set your DATABASE_URL"
echo "2. Set ELEVENLABS_API_KEY (from https://elevenlabs.io)"
echo "3. Set CLAUDE_API_KEY (from https://console.anthropic.com)"
echo "4. For production, set COTURN_EXTERNAL_IP"
echo ""
echo "Then run: docker-compose up -d"
