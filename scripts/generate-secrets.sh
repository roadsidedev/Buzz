#!/usr/bin/env bash
# scripts/generate-secrets.sh
# Usage: ./scripts/generate-secrets.sh [EXTERNAL_IP]
#
# M16: COTURN_EXTERNAL_IP is required for a working TURN server.  The previous
# implementation silently fell back to an empty string when the external IP
# detection curl call failed (e.g., offline CI, restricted egress), which
# caused turnserver to start with no external IP — making all WebRTC relaying
# broken without any error message.
#
# Fix: Accept the IP as an optional CLI argument.  If not provided, the script
# requires the caller to set COTURN_EXTERNAL_IP in the environment, or it
# prints a clear fatal error and exits non-zero.

set -euo pipefail

echo "=========================================="
echo "Buzz Secret Generator"
echo "=========================================="
echo ""
echo "# Copy these values to your .env file"
echo "# WARNING: Keep these secrets secure!"
echo ""

echo "# ============================================"
echo "# SECURITY SECRETS (CRITICAL)"
echo "# ============================================"
echo ""

echo "# JWT Secret (for authentication)"
echo "JWT_SECRET=\"$(openssl rand -base64 48)\""
echo ""

echo "# Encryption Secret (for database field-level encryption)"
echo "ENCRYPTION_SECRET=\"$(openssl rand -base64 32)\""
echo ""

echo "# Blind Index Secret (for HMAC address lookups — MUST differ from ENCRYPTION_SECRET)"
echo "BLIND_INDEX_SECRET=\"$(openssl rand -base64 32)\""
echo ""

echo "# ============================================"
echo "# COTURN SECRETS"
echo "# ============================================"
echo ""

echo "# Coturn Secret (for TURN server)"
echo "COTURN_SECRET=\"$(openssl rand -hex 32)\""
echo ""

# Determine external IP — M16: require explicit value rather than silent fallback.
EXTERNAL_IP="${1:-${COTURN_EXTERNAL_IP:-}}"

if [ -z "$EXTERNAL_IP" ]; then
  echo "ERROR: COTURN_EXTERNAL_IP is required but was not provided." >&2
  echo "" >&2
  echo "  Pass it as an argument:" >&2
  echo "    ./scripts/generate-secrets.sh 203.0.113.42" >&2
  echo "" >&2
  echo "  Or export it before running:" >&2
  echo "    COTURN_EXTERNAL_IP=203.0.113.42 ./scripts/generate-secrets.sh" >&2
  echo "" >&2
  echo "  To look it up manually: curl -4 https://ifconfig.me" >&2
  exit 1
fi

echo "# Public IP for TURN server NAT traversal"
echo "COTURN_EXTERNAL_IP=\"${EXTERNAL_IP}\""
echo ""

echo "# ============================================"
echo "# OPTIONAL: LEGACY FALLBACK"
echo "# ============================================"
echo ""

echo "# Jam Webhook Secret (if using fallback)"
echo "# JAM_WEBHOOK_SECRET=\"$(openssl rand -hex 32)\""
echo ""

echo "=========================================="
echo "Done! Copy the output above to your .env file"
echo "=========================================="
