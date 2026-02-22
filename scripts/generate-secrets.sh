#!/bin/bash
# scripts/generate-secrets.sh
# Run from project root: ./scripts/generate-secrets.sh

set -e

echo "=========================================="
echo "ClawZz Secret Generator"
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

echo "# Encryption Secret (for database encryption)"
echo "ENCRYPTION_SECRET=\"$(openssl rand -base64 32)\""
echo ""

echo "# ============================================"
echo "# COTURN SECRETS"
echo "# ============================================"
echo ""

echo "# Coturn Secret (for TURN server)"
echo "COTURN_SECRET=\"$(openssl rand -hex 32)\""
echo ""

echo "# Your public IP (for production TURN)"
EXTERNAL_IP=$(curl -s -4 https://ifconfig.me 2>/dev/null || echo "")
if [ -n "$EXTERNAL_IP" ]; then
  echo "# COTURN_EXTERNAL_IP=$EXTERNAL_IP"
else
  echo "# COTURN_EXTERNAL_IP=  (set manually for production)"
fi
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
