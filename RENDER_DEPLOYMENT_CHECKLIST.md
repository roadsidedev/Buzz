# Render Deployment Checklist for ClawZz

**Status:** Ready for deployment  
**API Key:** Configured (rnd_ejG4Q1khkRp0zqD07mYkGK4jOoS6)  
**Date:** February 18, 2026

---

## Phase 1: Render Blueprint Deployment ✅

### 1.1 Deploy Services via Blueprint

Use Render's Blueprint feature for one-click deployment:

1. Go to: https://render.com/blueprints
2. Click "New Blueprint"
3. Select "Connect Repository"
4. Choose: `https://github.com/molty-miles/clawzz`
5. Branch: `main`
6. Upload `render.yaml` from root

**Services to be created:**
- ✅ `clawzz-backend` (Node.js, port 3000)
- ✅ `clawzz-orchestrator` (Python, port 8000)
- ⏳ `clawzz-worker` (Node.js background jobs - optional)

### 1.2 What Blueprint Does Automatically

```yaml
Backend Service:
- Runtime: Node.js 20+
- Build: cd backend && npm ci && npm run build
- Start: cd backend && npm start
- Health Check: /health
- Plan: Starter ($7/mo)
- Auto-deploy: Enabled

Orchestrator Service:
- Runtime: Python 3.11+
- Build: cd orchestrator && pip install -r requirements.txt
- Start: cd orchestrator && uvicorn main:app --host 0.0.0.0 --port 8000
- Health Check: /health
- Plan: Starter ($7/mo)
- Auto-deploy: Enabled
```

---

## Phase 2: Manual Environment Variables Setup 🔧

**YOU WILL DO THIS** via Render Dashboard (not automated).

### 2.1 Backend Service Env Variables

Go to: https://dashboard.render.com → `clawzz-backend` → Environment

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Already set |
| `PORT` | `3000` | Already set |
| `DATABASE_URL` | `postgres://...` | Get from Neon (later) |
| `REDIS_URL` | `rediss://...` | Get from Upstash (later) |
| `JWT_SECRET` | *(auto-generated)* | Already set |
| `R2_ACCESS_KEY_ID` | *(your Cloudflare key)* | Add manually |
| `R2_SECRET_ACCESS_KEY` | *(your Cloudflare secret)* | Add manually |
| `R2_ENDPOINT` | `https://your-account.r2.cloudflarestorage.com` | Add manually |
| `R2_BUCKET_NAME` | `clawzz-audio-storage` | Already set |
| `ORCHESTRATOR_URL` | Auto-linked to orchestrator | Auto-generated |
| `ORCHESTRATOR_API_KEY` | *(auto-generated)* | Already set |
| `ELEVENLABS_API_KEY` | *(your API key)* | Add when ready |
| `JAM_API_KEY` | *(your API key)* | Add when ready |
| `X402_MUNCHKIN_KEY` | *(your API key)* | Add when ready |

### 2.2 Orchestrator Service Env Variables

Go to: https://dashboard.render.com → `clawzz-orchestrator` → Environment

| Variable | Value | Notes |
|----------|-------|-------|
| `PYTHON_ENV` | `production` | Already set |
| `PORT` | `8000` | Already set |
| `DATABASE_URL` | `postgres://...` | Get from Neon (later) |
| `REDIS_URL` | `rediss://...` | Get from Upstash (later) |
| `ANTHROPIC_API_KEY` | *(your API key)* | Add manually |
| `BACKEND_URL` | Auto-linked to backend | Auto-generated |
| `BACKEND_API_KEY` | Linked from backend | Auto-generated |

### 2.3 Where to Get API Keys

- **ELEVENLABS_API_KEY**: https://elevenlabs.io/api
- **JAM_API_KEY**: https://jam.systems (if using)
- **X402_MUNCHKIN_KEY**: x402 protocol provider
- **ANTHROPIC_API_KEY**: https://console.anthropic.com/keys (Claude API)
- **R2 Keys**: https://dash.cloudflare.com → R2 → API Tokens

---

## Phase 3: Verify Deployments ✅

### 3.1 Health Checks

Once services are deployed, verify they're running:

```bash
# Backend health check
curl https://clawzz-backend.onrender.com/health

# Orchestrator health check
curl https://clawzz-orchestrator.onrender.com/health
```

Expected responses:
```json
// Backend
{ "status": "healthy" }

// Orchestrator
{ "status": "healthy", "service": "orchestrator" }
```

### 3.2 Logs

Check service logs for any deployment issues:

1. Go to: https://dashboard.render.com
2. Select service → Logs
3. Look for any error messages during build/start

### 3.3 Service Metrics

Monitor resources:

1. Go to service → Metrics
2. Check: CPU, Memory, Request Count
3. Ensure no OOM (Out of Memory) errors

---

## Phase 4: Integration Testing 🧪

Once both services are deployed:

### 4.1 API Gateway Health
```bash
curl -X GET https://clawzz-backend.onrender.com/health
```

### 4.2 Orchestrator Health
```bash
curl -X GET https://clawzz-orchestrator.onrender.com/health
```

### 4.3 Service-to-Service Communication

Backend should be able to reach Orchestrator at:
```
https://clawzz-orchestrator.onrender.com
```

This is automatically configured via the `ORCHESTRATOR_URL` env var.

---

## Current Service URLs (After Deployment)

| Service | URL | Port | Status |
|---------|-----|------|--------|
| Backend | https://clawzz-backend.onrender.com | 3000 | ⏳ Pending |
| Orchestrator | https://clawzz-orchestrator.onrender.com | 8000 | ⏳ Pending |

---

## Troubleshooting

### Build Fails
1. Check logs: https://dashboard.render.com → Service → Logs
2. Common issues:
   - Missing `npm ci` (use instead of `npm install`)
   - TypeScript compilation errors
   - Missing dependencies

### Runtime Errors
1. Check service logs
2. Verify all env variables are set
3. Check database connectivity (once DB is set up)

### Out of Memory (OOM)
1. Upgrade from Starter to Standard plan
2. Or optimize Node/Python memory usage

### Slow Deployments
- First deployment: 5-10 minutes (including build)
- Subsequent: 2-3 minutes (cached layers)

---

## Next Steps (After Deployment)

1. ✅ Blueprint deployment (services created)
2. 🔧 Set env variables manually (you do this)
3. 🗄️ Database setup (Neon) - SKIP FOR NOW
4. 📦 Redis setup (Upstash) - SKIP FOR NOW
5. 🔗 Database migrations - SKIP FOR NOW
6. 🧪 Integration testing
7. 🚀 Production validation

---

## Monitoring & Maintenance

### Daily
- Check service health: https://dashboard.render.com

### Weekly
- Review logs for errors
- Check metrics for anomalies

### Monthly
- Review costs
- Update dependencies
- Run security audit

---

## Cost Summary

| Service | Plan | Cost/Month | Status |
|---------|------|-----------|--------|
| Backend | Starter | $7 | Active |
| Orchestrator | Starter | $7 | Active |
| **Total Compute** | | **$14** | |
| Database | (Neon) | $0-19 | Pending |
| Cache | (Upstash) | $0-20 | Pending |
| Storage | (R2) | $0.015/GB | Pending |
| **Total MVP** | | **$14-50** | |

---

## Important Notes

⚠️ **DO NOT** commit sensitive environment variables to GitHub

✅ **DO** use Render Dashboard to set them (they're encrypted)

🔑 **API Key Security**: Your Render API key is secure and only used to authenticate the MCP server

📋 **Blueprint is definitive**: render.yaml is source of truth for service configuration

---

**Ready to deploy?**

1. Go to https://render.com/blueprints
2. Upload `render.yaml`
3. Click "Deploy"
4. Wait 5-10 minutes for services to build
5. Set env variables manually in dashboard
6. Verify health checks pass

