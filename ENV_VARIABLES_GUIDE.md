# Environment Variables Guide: Self-Hosted Jam Integration

This guide explains how to obtain and configure all environment variables required for the self-hosted Jam audio room integration.

---

## Quick Reference

```bash
# Copy the example file
cp .env.example .env

# Generate all secrets with one command
./scripts/generate-secrets.sh
```

---

## Required Secrets (Must Generate)

### 1. COTURN_SECRET

**Purpose:** Shared secret for TURN server authentication. Used to generate time-limited credentials for WebRTC clients.

**Generate:**

```bash
# Option 1: OpenSSL (recommended)
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: /dev/urandom
head -c 32 /dev/urandom | xxd -p -c 64
```

**Example value:**

```
COTURN_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Where to store:**

- `.env` file (development)
- Environment variables in your hosting platform (production)
- Secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault)

---

### 2. JWT_SECRET

**Purpose:** Secret key for signing JWT authentication tokens.

**Requirements:**

- Minimum 32 characters
- Mix of uppercase, lowercase, numbers, and special characters
- High entropy

**Generate:**

```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 48

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Option 3: Strong password generator
# Use a password manager like 1Password, Bitwarden, or LastPass
# Generate a 48+ character password
```

**Example value:**

```
JWT_SECRET=MyStr0ng!JWT#Secret$With%Good&Entropy*123456789abcdefghijklmnop
```

---

### 3. ENCRYPTION_SECRET

**Purpose:** AES-256 encryption key for encrypting sensitive data in the database (including agent private keys).

**Requirements:**

- Minimum 32 characters
- High entropy

**Generate:**

```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example value:**

```
ENCRYPTION_SECRET=kJ7mN2pQ9rS4tU6vW8xY0zA3bC5dE7fG
```

---

### 4. COTURN_EXTERNAL_IP

**Purpose:** Public IP address of your server for TURN server NAT traversal.

**How to obtain:**

```bash
# Option 1: Check your server's public IP
curl -4 https://ifconfig.me
curl -4 https://api.ipify.org

# Option 2: From your cloud provider
# AWS EC2: Check the instance details or use metadata service
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Google Cloud:
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip

# Azure:
curl -H Metadata:true "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text"
```

**Example value:**

```
COTURN_EXTERNAL_IP=203.0.113.42
```

**Note:** For local development, leave empty or use `127.0.0.1`

---

## Optional Secrets (For External Services)

### 5. JAM_API_KEY (Fallback Only)

**Purpose:** API key for legacy Jam service (fallback when self-hosted fails).

**Status:** Optional - only needed if `JAM_FALLBACK_ENABLED=true`

**How to obtain:**

- Sign up at https://jam.systems
- Go to Account Settings → API Keys
- Generate a new API key

**Example value:**

```
JAM_API_KEY=jam_live_abc123def456ghi789jkl012mno345pqr
```

---

### 6. JAM_WEBHOOK_SECRET (Fallback Only)

**Purpose:** Secret for verifying webhook signatures from legacy Jam service.

**Status:** Optional - only needed if `JAM_FALLBACK_ENABLED=true`

**Generate:**

```bash
openssl rand -hex 32
```

**How to set:**

- Configure in your Jam dashboard under Webhooks
- Must match between Beely and Jam dashboard

---

### 7. ELEVENLABS_API_KEY

**Purpose:** API key for text-to-speech synthesis.

**How to obtain:**

1. Sign up at https://elevenlabs.io
2. Go to Profile → API Keys
3. Create a new API key

**Example value:**

```
ELEVENLABS_API_KEY=xi_abc123def456ghi789jkl012mno345pqr678stu
```

**Pricing:** Free tier available (10,000 characters/month)

---

### 8. CLAUDE_API_KEY / ANTHROPIC_API_KEY

**Purpose:** API key for Claude AI (used in orchestrator for message scoring).

**How to obtain:**

1. Sign up at https://console.anthropic.com
2. Go to API Keys section
3. Create a new API key

**Example value:**

```
CLAUDE_API_KEY=sk-ant-api03-abc123def456ghi789...
```

---

### 9. X402_API_KEY / X402_SECRET_KEY

**Purpose:** API credentials for x402 payment processing.

**How to obtain:**

1. Sign up at x402 platform
2. Get API keys from dashboard

---

### 10. ERC8004_PRIVATE_KEY

**Purpose:** Private key for on-chain agent identity registration.

**Status:** Optional - only needed for on-chain operations

**Generate:**

```bash
# Generate a new Ethereum private key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ SECURITY WARNING:**

- Never commit this to git
- Use a dedicated wallet for this purpose
- Consider using a hardware wallet or secrets manager

---

## Configuration Variables (Non-Secrets)

### Network Configuration

| Variable          | Description             | Default                          | Production Value                          |
| ----------------- | ----------------------- | -------------------------------- | ----------------------------------------- |
| `JAM_HOST`        | Domain for Jam services | `localhost`                      | `your-domain.com`                         |
| `PANTRY_URL`      | Pantry backend URL      | `http://localhost:3003`          | `https://pantry.your-domain.com`          |
| `COTURN_REALM`    | TURN server realm       | `beely-live.vercel.app`                     | `your-domain.com`                         |
| `VITE_PANTRY_URL` | Frontend pantry URL     | `http://localhost:3003/_/pantry` | `https://pantry.your-domain.com/_/pantry` |
| `VITE_STUN_URL`   | STUN server URL         | `stun:localhost:3478`            | `stun:your-domain.com:3478`               |
| `VITE_TURN_URL`   | TURN server URL         | `turn:localhost:3478`            | `turn:your-domain.com:3478`               |

### Database Configuration

| Variable       | Description                  | How to Obtain                                        |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | From your database provider                          |
| `REDIS_URL`    | Redis connection string      | From your Redis provider or `redis://localhost:6379` |

### Blockchain Configuration

| Variable                     | Description                 | Values                      |
| ---------------------------- | --------------------------- | --------------------------- |
| `ERC8004_IDENTITY_ADDRESS`   | Smart contract address      | See below                   |
| `ERC8004_REPUTATION_ADDRESS` | Reputation contract address | See below                   |
| `ERC8004_RPC_URL`            | Blockchain RPC endpoint     | See below                   |
| `ERC8004_NETWORK`            | Network name                | `base-sepolia` or `mainnet` |

**Contract Addresses:**

```
# Base Sepolia (Development/Testnet)
ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
ERC8004_RPC_URL=https://sepolia.base.org

# Base Mainnet (Production)
ERC8004_IDENTITY_ADDRESS=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
ERC8004_REPUTATION_ADDRESS=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
ERC8004_RPC_URL=https://mainnet.base.org
```

---

## Complete .env Example

```bash
# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=development
API_PORT=4000

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://beely:your_password@localhost:5432/beely
REDIS_URL=redis://localhost:6379

# ============================================
# SECURITY - CRITICAL (GENERATE THESE)
# ============================================
JWT_SECRET=<generate-with: openssl rand -base64 48>
ENCRYPTION_SECRET=<generate-with: openssl rand -base64 32>

# ============================================
# SELF-HOSTED JAM STACK
# ============================================
JAM_SELF_HOSTED_ENABLED=true
JAM_FALLBACK_ENABLED=true
PANTRY_URL=http://localhost:3003
JAM_HOST=localhost

# ============================================
# COTURN (STUN/TURN Server)
# ============================================
COTURN_REALM=beely-live.vercel.app
COTURN_SECRET=<generate-with: openssl rand -hex 32>
COTURN_EXTERNAL_IP=              # Leave empty for local dev

# ============================================
# LEGACY JAM (Fallback)
# ============================================
JAM_URL=http://localhost:3001
JAM_API_KEY=                     # Only if using fallback
JAM_WEBHOOK_SECRET=              # Only if using fallback
ENABLE_AUDIO_STREAMING=true

# ============================================
# EXTERNAL SERVICES
# ============================================
ELEVENLABS_API_KEY=<from-elevenlabs-dashboard>
CLAUDE_API_KEY=<from-anthropic-console>

# ============================================
# ERC-8004 (Agent Identity)
# ============================================
ERC8004_IDENTITY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713
ERC8004_RPC_URL=https://sepolia.base.org
ERC8004_NETWORK=base-sepolia

# ============================================
# FRONTEND
# ============================================
VITE_API_URL=http://localhost:4000/api/v1
VITE_WS_URL=ws://localhost:4000
VITE_PANTRY_URL=http://localhost:3003/_/pantry
VITE_STUN_URL=stun:localhost:3478
VITE_TURN_URL=turn:localhost:3478
```

---

## Secret Generation Script

Create this helper script to generate all secrets at once:

```bash
#!/bin/bash
# scripts/generate-secrets.sh

echo "# Generated secrets for Beely"
echo "# Run: ./scripts/generate-secrets.sh"
echo ""

echo "# Security Secrets"
echo "JWT_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_SECRET=$(openssl rand -base64 32)"
echo ""

echo "# Coturn Secret"
echo "COTURN_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# Optional: Legacy Jam Fallback"
echo "JAM_WEBHOOK_SECRET=$(openssl rand -hex 32)"
echo ""

echo "# Your public IP (for COTURN_EXTERNAL_IP):"
echo "# COTURN_EXTERNAL_IP=$(curl -s -4 https://ifconfig.me 2>/dev/null || echo '<check-manually>')"
```

---

## Security Best Practices

### 1. Never Commit Secrets

```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore
```

### 2. Use Different Secrets Per Environment

- Development: Local `.env` file
- Staging: Environment variables in hosting platform
- Production: Secrets manager + environment variables

### 3. Rotate Secrets Regularly

- JWT_SECRET: Every 90 days
- COTURN_SECRET: Every 90 days
- API Keys: When compromised or team member leaves

### 4. Limit Access

- Only DevOps/Lead developers should have production secrets
- Use secrets manager for team access
- Audit access logs

### 5. Use Environment-Specific Values

```bash
# Development
COTURN_EXTERNAL_IP=
JAM_FALLBACK_ENABLED=true

# Production
COTURN_EXTERNAL_IP=203.0.113.42
JAM_FALLBACK_ENABLED=false
```

---

## Platform-Specific Setup

### Docker Compose

```bash
# Create .env file
cp .env.example .env

# Edit with your values
nano .env

# Start services
docker-compose up -d
```

### AWS (ECS/EKS)

```bash
# Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name beely/jwt-secret \
  --secret-string "$(openssl rand -base64 48)"

# Reference in task definition
# ValueFrom: arn:aws:secretsmanager:region:account:secret:beely/jwt-secret
```

### Google Cloud (Cloud Run/GKE)

```bash
# Store in Secret Manager
echo -n "$(openssl rand -base64 48)" | \
  gcloud secrets create jwt-secret --data-file=-

# Reference in Cloud Run
gcloud run services update beely \
  --set-secrets=JWT_SECRET=jwt-secret:latest
```

### Vercel/Netlify (Frontend)

```bash
# Set in dashboard or CLI
vercel env add VITE_PANTRY_URL
vercel env add VITE_STUN_URL
vercel env add VITE_TURN_URL
```

---

## Troubleshooting

### "COTURN_SECRET not set"

```bash
# Check if set
echo $COTURN_SECRET

# Generate and set
export COTURN_SECRET=$(openssl rand -hex 32)
```

### "JWT token verification failed"

```bash
# Ensure JWT_SECRET is consistent across all services
# Same secret must be used for signing and verification
```

### "TURN credentials rejected"

```bash
# Verify COTURN_SECRET matches between:
# 1. .env file
# 2. Coturn container (COTURN_SECRET env var)
# 3. Beely backend (COTURN_SECRET env var)
```

### "Cannot connect to Pantry"

```bash
# Verify PANTRY_URL is correct
curl http://localhost:3003/

# Check if service is running
docker-compose ps pantry
```

---

## Checklist

- [ ] Generate `JWT_SECRET`
- [ ] Generate `ENCRYPTION_SECRET`
- [ ] Generate `COTURN_SECRET`
- [ ] Set `COTURN_EXTERNAL_IP` (production only)
- [ ] Configure `DATABASE_URL`
- [ ] Configure `REDIS_URL`
- [ ] Set `ELEVENLABS_API_KEY` (for TTS)
- [ ] Set `CLAUDE_API_KEY` (for orchestrator)
- [ ] Configure ERC-8004 contract addresses
- [ ] Verify all frontend `VITE_*` URLs
- [ ] Test with `docker-compose up -d`
- [ ] Verify health endpoints

---

## Need Help?

- Check logs: `docker-compose logs -f pantry`
- Test TURN: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
- Verify secrets loaded: `docker-compose exec backend env | grep SECRET`
