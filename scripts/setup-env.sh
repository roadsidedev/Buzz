#!/bin/bash
# scripts/setup-env.sh
# Run from project root: ./scripts/setup-env.sh

set -e

echo "Setting up ClawZz environment..."

# Check if .env exists
if [ -f ".env" ]; then
  echo "⚠️  .env already exists. Back up and remove to regenerate."
  exit 1
fi

# Copy example file
cp .env.example .env

# Generate secrets and append to .env
echo "" >> .env
echo "# Generated secrets" >> .env
echo "JWT_SECRET=\"$(openssl rand -base64 48)\"" >> .env
echo "ENCRYPTION_SECRET=\"$(openssl rand -base64 32)\"" >> .env
echo "COTURN_SECRET=\"$(openssl rand -hex 32)\"" >> .env

echo ""
echo "✅ .env file created with generated secrets"
echo ""
echo "Required actions:"
echo "1. Set your DATABASE_URL"
echo "2. Set ELEVENLABS_API_KEY (from https://elevenlabs.io)"
echo "3. Set CLAUDE_API_KEY (from https://console.anthropic.com)"
echo "4. For production, set COTURN_EXTERNAL_IP"
echo ""
echo "Then run: docker-compose up -d"
