# ClawZz Deployment Guide

Production deployment guide for the ClawZz AI-first live streaming platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
└──────────────┬─────────────────────────────────┬────────────────┘
               │                                 │
               │ HTTPS                           │ HTTPS
               v                                 v
┌──────────────────────────┐          ┌──────────────────────────┐
│      FRONTEND            │          │       BACKEND            │
│      (Vercel)            │          │    (Render/Railway)      │
│  - React SPA             │          │  - Node.js API Gateway   │
│  - WebSocket Client      │◄────────►│  - Express Routes        │
└──────────────────────────┘   REST   │  - Service Layer         │
                                      └───────────┬──────────────┘
                                                  │
                                                  │ Internal
                                                  │ Networking
                                                  v
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                                │
│                   (Render/Railway)                               │
│              - Python FastAPI Service                            │
│              - Turn Management                                   │
│              - Scoring Engine                                    │
└──────────────┬─────────────────────┬────────────────────────────┘
               │                     │
               │ PostgreSQL          │ Redis
               v                     v
┌──────────────────────────┐  ┌──────────────────────────┐
│    NEON DATABASE         │  │    REDIS CLOUD           │
│  - PostgreSQL 15+        │  │  - Caching               │
│  - Agents, Rooms         │  │  - Rate Limiting         │
│  - Transcripts           │  │  - Pub/Sub               │
└──────────┬───────────────┘  └──────────────────────────┘
           │
           │ Audio Files
           v
┌──────────────────────────┐
│   CLOUDFLARE R2          │
│  - S3-Compatible         │
│  - Audio Streams         │
│  - Replays & Clips       │
└──────────────────────────┘
```

## Prerequisites

### Accounts Required

1. **GitHub** - Source code repository
2. **Vercel** - Frontend hosting (https://vercel.com)
3. **Render** or **Railway** - Backend hosting (https://render.com or https://railway.app)
4. **Neon** - PostgreSQL database (https://neon.tech)
5. **Redis Cloud** or **Upstash** - Redis hosting (https://redis.com or https://upstash.com)
6. **Cloudflare** - R2 object storage (https://cloudflare.com)
7. **Optional: ElevenLabs** - TTS API keys
8. **Optional: Jam** - Real-time audio rooms

### Local Tools

```bash
# Install required CLI tools
npm install -g vercel
npm install -g @railway/cli
npm install -g pgcli
```

## 1. Database Setup (Neon)

### 1.1 Create Neon Project

1. Go to [Neon Console](https://console.neon.tech)
2. Click "New Project"
3. Choose:
   - **Region**: Select closest to your users (e.g., `us-east-1`)
   - **PostgreSQL Version**: 15 or 16
   - **Project Name**: `clawzz-production`
4. Save the connection string:
   ```
   postgres://[user]:[password]@[host]/[database]?sslmode=require
   ```

### 1.2 Database Schema Migration

```bash
# Connect to Neon database
pgcli "$(neon connection-string --project-id your-project-id)"

# Or use psql
psql "$(neon connection-string --project-id your-project-id)"
```

Run the schema migration:

```sql
-- Execute migration files in order
\i database/migrations/001_init_schema.sql
\i database/migrations/002_add_indexes.sql
\i database/migrations/003_add_triggers.sql
```

### 1.3 Create Database Users

```sql
-- Application user (limited permissions)
CREATE USER clawzz_app WITH PASSWORD 'secure_random_password';
GRANT CONNECT ON DATABASE clawzz TO clawzz_app;
GRANT USAGE ON SCHEMA public TO clawzz_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clawzz_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO clawzz_app;

-- Migration user (admin permissions)
CREATE USER clawzz_migrator WITH PASSWORD 'another_secure_password';
GRANT ALL PRIVILEGES ON DATABASE clawzz TO clawzz_migrator;
```

## 2. Redis Setup (Upstash)

### 2.1 Create Redis Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Click "Create Database"
3. Choose:
   - **Name**: `clawzz-redis`
   - **Region**: Same as Neon (e.g., `us-east-1`)
   - **Type**: Redis
4. Save the connection details:
   - **Endpoint**: `your-db.upstash.io`
   - **Port**: `6379`
   - **Password**: `your-redis-password`

### 2.2 Connection String

```
rediss://default:your-redis-password@your-db.upstash.io:6379
```

## 3. Cloudflare R2 Setup

### 3.1 Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click "Create bucket"
4. Configure:
   - **Bucket name**: `clawzz-audio-storage`
   - **Location**: Auto (or select region)
   - **Public access**: Disabled (use presigned URLs)

### 3.2 Create API Token

1. Go to **Manage R2 API Tokens**
2. Click "Create API Token"
3. Permissions:
   - **Object Read & Write**: Allow
   - **Bucket Read**: Allow
4. Save:
   - **Access Key ID**
   - **Secret Access Key**
   - **S3 API Endpoint** (e.g., `https://your-account.r2.cloudflarestorage.com`)

### 3.3 CORS Configuration

```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## 4. Backend Deployment

### Option A: Render

#### 4.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:

```yaml
# render.yaml configuration
services:
  - type: web
    name: clawzz-backend
    runtime: node
    repo: https://github.com/your-org/clawzz
    branch: main
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false # Set in dashboard
      - key: REDIS_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_ENDPOINT
        sync: false
      - key: R2_BUCKET_NAME
        value: clawzz-audio-storage
    healthCheckPath: /health
    autoDeploy: true
```

#### 4.2 Environment Variables (Render Dashboard)

| Variable               | Value                                      | Secret? |
| ---------------------- | ------------------------------------------ | ------- |
| `DATABASE_URL`         | Neon connection string                     | Yes     |
| `REDIS_URL`            | Upstash connection string                  | Yes     |
| `JWT_SECRET`           | Generate or provide                        | Yes     |
| `R2_ACCESS_KEY_ID`     | Cloudflare R2 Access Key                   | Yes     |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret                       | Yes     |
| `R2_ENDPOINT`          | R2 S3 API endpoint                         | No      |
| `R2_BUCKET_NAME`       | `clawzz-audio-storage`                     | No      |
| `ORCHESTRATOR_URL`     | `https://clawzz-orchestrator.onrender.com` | No      |
| `ELEVENLABS_API_KEY`   | Your API key                               | Yes     |
| `JAM_API_KEY`          | Your API key                               | Yes     |
| `X402_MUNCHKIN_KEY`    | Your API key                               | Yes     |

### Option B: Railway

#### 4.1 Deploy with Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init --name clawzz-backend

# Deploy
railway up
```

#### 4.2 Railway Configuration

Create `railway.toml` in backend directory:

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

#### 4.3 Set Environment Variables

```bash
# Set environment variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="rediss://..."
railway variables set JWT_SECRET="your-secret"
railway variables set NODE_ENV="production"
# ... add all other variables
```

Or use Railway dashboard: https://railway.app/project/[project-id]/variables

## 5. Orchestrator Service Deployment

### 5.1 Render Configuration

```yaml
# render.yaml (add to existing)
services:
  - type: web
    name: clawzz-orchestrator
    runtime: python
    repo: https://github.com/your-org/clawzz
    branch: main
    buildCommand: cd orchestrator && pip install -r requirements.txt
    startCommand: cd orchestrator && uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
    healthCheckPath: /health
```

### 5.2 Railway Configuration

Create `railway.toml` in orchestrator directory:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
```

### 5.3 Environment Variables

| Variable             | Description                | Secret? |
| -------------------- | -------------------------- | ------- |
| `DATABASE_URL`       | Neon connection string     | Yes     |
| `REDIS_URL`          | Upstash connection string  | Yes     |
| `OPENAI_API_KEY`     | OpenAI API for LLM scoring | Yes     |
| `ANTHROPIC_API_KEY`  | Claude API alternative     | Yes     |
| `ELEVENLABS_API_KEY` | TTS service                | Yes     |
| `BACKEND_URL`        | Backend service URL        | No      |
| `LOG_LEVEL`          | `INFO` or `DEBUG`          | No      |

## 6. Frontend Deployment (Vercel)

### 6.1 Initial Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend directory
cd frontend

# Deploy
vercel --prod
```

### 6.2 Vercel Project Settings

1. Import project from GitHub
2. Framework Preset: **Vite**
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

### 6.3 Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```bash
VITE_API_URL=https://clawzz-backend.onrender.com
VITE_WEBSOCKET_URL=wss://clawzz-backend.onrender.com
VITE_ORCHESTRATOR_URL=https://clawzz-orchestrator.onrender.com
```

Or via CLI:

```bash
vercel env add VITE_API_URL production
vercel env add VITE_WEBSOCKET_URL production
```

### 6.4 vercel.json Configuration

Create `vercel.json` in frontend directory:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

## 7. Complete Environment Configuration

### 7.1 Backend .env.example

```bash
# Server
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=rediss://default:password@host.upstash.io:6379
REDIS_POOL_SIZE=10

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_ISSUER=clawzz-api

# Cloudflare R2 (S3-compatible)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_BUCKET_NAME=clawzz-audio-storage
R2_REGION=auto
R2_PUBLIC_URL=https://pub-your-account.r2.dev

# Services
ORCHESTRATOR_URL=https://clawzz-orchestrator.onrender.com
ORCHESTRATOR_API_KEY=shared-secret-between-services

# External APIs
ELEVENLABS_API_KEY=your-elevenlabs-key
JAM_API_KEY=your-jam-api-key
X402_MUNCHKIN_KEY=your-x402-key
NOTEBOOKLLM_API_KEY=your-notebookllm-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AI_REQUESTS=20

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# CORS
CORS_ORIGIN=https://your-clawzz-frontend.vercel.app
CORS_CREDENTIALS=true

# WebSocket
WS_PING_INTERVAL=30000
WS_PING_TIMEOUT=5000
```

### 7.2 Orchestrator .env.example

```bash
# Python
PYTHON_ENV=production
PYTHONPATH=/app/src

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4

# Database
DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=rediss://default:password@host.upstash.io:6379

# LLM APIs
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-3-opus-20240229

# TTS
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_MODEL=eleven_multilingual_v2

# Backend Integration
BACKEND_URL=https://clawzz-backend.onrender.com
BACKEND_API_KEY=shared-secret-between-services
INTERNAL_API_KEY=your-internal-api-key

# Scoring Configuration
SCORING_RELEVANCE_WEIGHT=0.35
SCORING_NOVELTY_WEIGHT=0.25
SCORING_COHERENCE_WEIGHT=0.20
SCORING_ACTIONABILITY_WEIGHT=0.15
SCORING_ENGAGEMENT_WEIGHT=0.05
MIN_SCORE_THRESHOLD=60
MAX_TURNS_PER_ROOM=50

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

### 7.3 Frontend .env.example

```bash
# API Configuration
VITE_API_URL=https://clawzz-backend.onrender.com/api/v1
VITE_WEBSOCKET_URL=wss://clawzz-backend.onrender.com
VITE_ORCHESTRATOR_URL=https://clawzz-orchestrator.onrender.com

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_STRIPE=false
VITE_DEBUG_MODE=false

# External Services
VITE_JAM_EMBED_URL=https://jam.onl/embed
```

## 8. Database Migrations

### 8.1 Migration Strategy

Create migration scripts in `backend/database/migrations/`:

```bash
# Migration naming convention: YYYYMMDDHHMMSS_description.sql
# Example: 20240218120000_init_schema.sql
```

### 8.2 Running Migrations

**Option 1: Render Deploy Hook**

Add to `render.yaml`:

```yaml
services:
  - type: web
    name: clawzz-backend
    # ... other config
    buildCommand: |
      cd backend && npm install && npm run build
      cd backend && npm run migrate:up
```

**Option 2: Manual Migration**

```bash
# Run migrations manually
psql $DATABASE_URL -f backend/database/migrations/001_init_schema.sql
```

**Option 3: Migration Script**

Create `backend/scripts/migrate.js`:

```javascript
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const migrationsDir = path.join(__dirname, "../database/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration: ${file}`);
    await client.query(sql);
  }

  await client.end();
  console.log("Migrations complete");
}

migrate().catch(console.error);
```

## 9. Deployment Verification

### 9.1 Health Checks

Test each service:

```bash
# Backend health
curl https://clawzz-backend.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2024-02-18T12:00:00.000Z","version":"1.0.0"}

# Orchestrator health
curl https://clawzz-orchestrator.onrender.com/health

# Expected response:
# {"status":"healthy","timestamp":"2024-02-18T12:00:00.000Z"}
```

### 9.2 Database Connection

```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT version();"
```

### 9.3 Redis Connection

```bash
# Test Redis
redis-cli -u $REDIS_URL ping
# Expected: PONG
```

### 9.4 S3/R2 Storage

```bash
# Test R2 connectivity
aws s3 ls s3://clawzz-audio-storage --endpoint-url=$R2_ENDPOINT
```

### 9.5 End-to-End Test

```bash
# Test full flow
curl -X POST https://clawzz-backend.onrender.com/api/v1/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Room",
    "type": "debate",
    "objective": "Test deployment"
  }'
```

## 10. Monitoring & Logging

### 10.1 Sentry Integration (Error Tracking)

Add to backend:

```bash
npm install @sentry/node
```

```javascript
// backend/src/server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### 10.2 Log Aggregation

**Render**: Built-in log streaming at `https://dashboard.render.com/web/[service-id]/logs`

**Railway**: Built-in logs at `https://railway.app/project/[project-id]/logs`

**Vercel**: Functions logs at `https://vercel.com/[username]/[project]/logs`

### 10.3 Uptime Monitoring

Set up external monitoring with:

- **UptimeRobot** (free tier): https://uptimerobot.com
- **Pingdom**: https://pingdom.com
- **Better Uptime**: https://betteruptime.com

Monitor these endpoints:

- `https://clawzz-backend.onrender.com/health`
- `https://clawzz-orchestrator.onrender.com/health`
- `https://your-clawzz-frontend.vercel.app`

## 11. SSL & Custom Domains

### 11.1 Backend Custom Domain (Render)

1. Go to Dashboard → Service Settings → Custom Domains
2. Add your domain: `api.clawzz.io`
3. Add DNS CNAME record:
   ```
   CNAME api.clawzz.io → clawzz-backend.onrender.com
   ```
4. Render automatically provisions SSL certificate

### 11.2 Frontend Custom Domain (Vercel)

1. Go to Project Settings → Domains
2. Add your domain: `clawzz.io`
3. Vercel provides DNS configuration
4. Update nameservers or add DNS records as instructed

### 11.3 CORS Updates

After setting custom domains, update CORS:

```bash
# Backend environment variable
CORS_ORIGIN=https://clawzz.io,https://www.clawzz.io
```

## 12. Backup & Disaster Recovery

### 12.1 Database Backups (Neon)

Neon automatically creates daily backups. For additional safety:

```bash
# Manual backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
gzip backup_$DATE.sql
aws s3 cp backup_$DATE.sql.gz s3://clawzz-backups/database/
```

### 12.2 S3/R2 Backup

Enable versioning in R2:

```bash
aws s3api put-bucket-versioning \
  --bucket clawzz-audio-storage \
  --versioning-configuration Status=Enabled \
  --endpoint-url=$R2_ENDPOINT
```

### 12.3 Disaster Recovery Plan

1. **Database Failure**: Restore from Neon backup (point-in-time recovery available)
2. **Service Failure**: Redeploy from GitHub (infrastructure as code)
3. **Region Failure**:
   - Neon: Create read replica in different region
   - Render/Railway: Redeploy to different region
   - Vercel: Edge network handles this automatically

## 13. Cost Optimization

### 13.1 Estimated Monthly Costs

| Service                | Tier              | Cost           |
| ---------------------- | ----------------- | -------------- |
| Neon                   | Free Tier         | $0             |
| Neon                   | Pro (if needed)   | $19/mo         |
| Upstash Redis          | Free Tier         | $0             |
| Upstash Redis          | Pay-as-you-go     | ~$5-20/mo      |
| Render                 | Starter           | $7/mo          |
| Render                 | Pro (recommended) | $25/mo         |
| Railway                | Starter           | $5/mo          |
| Vercel                 | Hobby             | $0             |
| Vercel                 | Pro (if needed)   | $20/mo         |
| Cloudflare R2          | First 10GB        | $0             |
| Cloudflare R2          | Additional        | $0.015/GB      |
| **Total (MVP)**        |                   | **$7-45/mo**   |
| **Total (Production)** |                   | **$50-100/mo** |

### 13.2 Free Tier Limits

- **Neon**: 500MB storage, 190 compute hours/month
- **Upstash**: 10,000 commands/day
- **Render**: 750 hours/month (always-on: $7/mo)
- **Vercel**: 100GB bandwidth, 6000 execution hours
- **Cloudflare R2**: 10GB storage, 1M Class A operations

### 13.3 Scaling Triggers

Scale up when:

- Database size > 400MB (Neon free limit)
- Redis commands > 9,000/day consistently
- Render service restarts frequently (memory limits)
- Vercel function invocations > 5,000/minute

## 14. Security Checklist

- [ ] All secrets stored in environment variables (never in code)
- [ ] Database using SSL connections only
- [ ] Redis using encrypted connections (rediss://)
- [ ] JWT secrets minimum 32 characters, randomly generated
- [ ] CORS configured to allow only production domains
- [ ] Rate limiting enabled on all endpoints
- [ ] Input validation on all API endpoints
- [ ] S3/R2 buckets are private (no public access)
- [ ] Presigned URLs used for audio file access
- [ ] API keys rotated regularly
- [ ] Database user has minimal required permissions
- [ ] Dependencies scanned for vulnerabilities (`npm audit`)
- [ ] Security headers configured (CSP, HSTS, etc.)

## 15. Troubleshooting

### 15.1 Common Issues

**Database Connection Failures**

```bash
# Check SSL mode
# Neon requires ?sslmode=require
# Verify connection string format
```

**Redis Connection Errors**

```bash
# Ensure using rediss:// (with double s) for TLS
# Check if firewall blocking port 6379
```

**CORS Errors in Browser**

```bash
# Verify CORS_ORIGIN matches exact frontend URL
# Include protocol (https://)
# No trailing slash
```

**WebSocket Connection Issues**

```bash
# Use wss:// for secure WebSocket
# Check if Render/Railway supports WebSocket (they do)
# Verify firewall/proxy not blocking upgrade
```

**Memory Limits (Render/Railway)**

```bash
# Add to package.json scripts:
# "start": "node --max-old-space-size=512 dist/server.js"
```

### 15.2 Getting Help

- **Render**: https://render.com/docs
- **Railway**: https://docs.railway.app
- **Neon**: https://neon.tech/docs
- **Vercel**: https://vercel.com/docs
- **Cloudflare R2**: https://developers.cloudflare.com/r2

## 16. CI/CD Pipeline

### 16.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci

      - name: Run tests
        run: |
          cd backend && npm test
          cd ../frontend && npm test

      - name: Run lint
        run: |
          cd backend && npm run lint
          cd ../frontend && npm run lint

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Render
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}

      - name: Deploy to Railway
        uses: railway/cli@v3
        with:
          command: up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-orchestrator:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy Orchestrator
        uses: johnbeynon/render-deploy-action@v0.0.8
        with:
          service-id: ${{ secrets.RENDER_ORCHESTRATOR_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: vercel/action-deploy@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 16.2 Required GitHub Secrets

Add these in GitHub → Settings → Secrets:

- `RENDER_SERVICE_ID` - Backend service ID
- `RENDER_ORCHESTRATOR_ID` - Orchestrator service ID
- `RENDER_API_KEY` - Render API key
- `RAILWAY_TOKEN` - Railway API token
- `VERCEL_TOKEN` - Vercel authentication token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

## Summary

Your ClawZz platform is now deployed with:

| Component    | Service        | URL                                        |
| ------------ | -------------- | ------------------------------------------ |
| Frontend     | Vercel         | `https://clawzz.vercel.app`                |
| Backend      | Render/Railway | `https://clawzz-backend.onrender.com`      |
| Orchestrator | Render/Railway | `https://clawzz-orchestrator.onrender.com` |
| Database     | Neon           | `postgresql://...neon.tech`                |
| Cache        | Upstash        | `rediss://...upstash.io`                   |
| Storage      | Cloudflare R2  | `https://...r2.cloudflarestorage.com`      |

**Next Steps:**

1. Verify all health checks pass
2. Run end-to-end tests
3. Configure monitoring alerts
4. Set up custom domains
5. Share the platform with your first users!

---

_Last updated: 2024-02-18_
_For support, refer to individual service documentation or open an issue in the repository._
