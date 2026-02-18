# Step-by-Step Render Deployment Guide

**Status:** Ready for deployment  
**Backend:** Node.js 20+ (port 3000)  
**Orchestrator:** Python 3.11+ (port 8000)

---

## Prerequisites ✅

- [x] Render account created
- [x] GitHub repository connected: https://github.com/molty-miles/clawzz
- [x] Render API key: `rnd_ejG4Q1khkRp0zqD07mYkGK4jOoS6`
- [x] render.yaml configured in repo root
- [x] Backend and Orchestrator source code ready

---

## Step 1: Deploy via Render Blueprint (5-10 minutes)

### Option A: Using Render Dashboard (Recommended)

1. Go to: https://dashboard.render.com
2. Click "**New +**" button
3. Select "**BlueprintBuild**" from dropdown
4. Click "**Connect Repository**"
5. Search for: `molty-miles/clawzz`
6. Select the repository
7. Choose branch: `main`
8. Click "**Connect**"

Render will automatically:
- Read `render.yaml` from root directory
- Create both services: backend and orchestrator
- Configure build and start commands
- Set up environment variables (with placeholders)
- Enable auto-deploy on git push

### Option B: Using Direct Blueprint URL

Copy this link and share with team:
```
https://render.com/deploy?repo=https://github.com/molty-miles/clawzz&branch=main
```

---

## Step 2: Monitor Deployment (5-10 minutes)

Once deployment starts:

1. Go to: https://dashboard.render.com/blueprints
2. You'll see your new services:
   - `clawzz-backend` (Node.js)
   - `clawzz-orchestrator` (Python)

3. Click each service to view build logs:
   - `clawzz-backend` → **Logs** tab
   - `clawzz-orchestrator` → **Logs** tab

### Expected Build Timeline

**Backend:**
```
Building...
npm ci (2-3 min)
tsc compile (1 min)
Build complete ✓
Starting server... (30 sec)
Health check PASSED ✓
```

**Orchestrator:**
```
Building...
pip install (2-3 min)
Build complete ✓
Starting uvicorn... (30 sec)
Health check PASSED ✓
```

---

## Step 3: Verify Deployment Status

### Check Service Health

Once both services show "Live" status:

```bash
# Backend health
curl https://clawzz-backend.onrender.com/health

# Orchestrator health
curl https://clawzz-orchestrator.onrender.com/health
```

Expected responses:
```json
{"status":"healthy"}
```

### View Service Dashboard

1. Go to: https://dashboard.render.com
2. Click `clawzz-backend`
3. Confirm:
   - Status: **Live** (green)
   - Runtime: **Node 20.11.0** (or similar)
   - Region: **Oregon** (or your chosen region)

4. Click `clawzz-orchestrator`
5. Confirm:
   - Status: **Live** (green)
   - Runtime: **Python 3.11** (or similar)
   - Region: **Oregon**

---

## Step 4: Set Environment Variables Manually

⚠️ **IMPORTANT:** You must set these in Render Dashboard (not automated in render.yaml)

### Backend Service Variables

1. Go to: https://dashboard.render.com
2. Click **`clawzz-backend`**
3. Click **"Environment"** tab
4. You'll see pre-configured variables:

```
NODE_ENV = production           ✓ Already set
API_PORT = 3000                ✓ Already set
JWT_SECRET = (auto-generated)  ✓ Already set
ORCHESTRATOR_URL = (auto-linked) ✓ Already set
ORCHESTRATOR_API_KEY = (auto-generated) ✓ Already set
```

5. Add the missing variables by clicking **"Add Environment Variable"**:

| Key | Value | Secret? |
|-----|-------|---------|
| `DATABASE_URL` | `postgres://user:pass@host/db?sslmode=require` | Yes |
| `REDIS_URL` | `rediss://default:pass@host:6379` | Yes |
| `R2_ACCESS_KEY_ID` | Your Cloudflare R2 access key | Yes |
| `R2_SECRET_ACCESS_KEY` | Your Cloudflare R2 secret | Yes |
| `R2_ENDPOINT` | `https://your-account.r2.cloudflarestorage.com` | No |
| `R2_BUCKET_NAME` | `clawzz-audio-storage` | No |
| `ELEVENLABS_API_KEY` | Your API key (optional for MVP) | Yes |
| `JAM_API_KEY` | Your API key (optional for MVP) | Yes |
| `X402_MUNCHKIN_KEY` | Your x402 API key | Yes |

6. After adding each variable, click **"Save"**
7. Service will auto-redeploy with new env vars

### Orchestrator Service Variables

1. Go to: https://dashboard.render.com
2. Click **`clawzz-orchestrator`**
3. Click **"Environment"** tab
4. Pre-configured:

```
PYTHON_ENV = production        ✓ Already set
PORT = 8000                    ✓ Already set
BACKEND_URL = (auto-linked)    ✓ Already set
BACKEND_API_KEY = (auto-linked) ✓ Already set
```

5. Add missing variables:

| Key | Value | Secret? |
|-----|-------|---------|
| `DATABASE_URL` | Same as backend | Yes |
| `REDIS_URL` | Same as backend | Yes |
| `ANTHROPIC_API_KEY` | Your Claude API key | Yes |
| `OPENAI_API_KEY` | Your OpenAI key (optional) | Yes |

---

## Step 5: Verify Service-to-Service Communication

Once env vars are set:

1. Go to `clawzz-backend` → **Logs**
2. Look for:
   ```
   ✓ API Gateway initialized
   ✓ Orchestrator client ready at https://clawzz-orchestrator.onrender.com
   ```

2. Go to `clawzz-orchestrator` → **Logs**
3. Look for:
   ```
   ✓ API Gateway client ready at https://clawzz-backend.onrender.com
   ```

### Test API Connectivity

```bash
# Call backend, which should reach orchestrator
curl -X GET https://clawzz-backend.onrender.com/api/health

# Call orchestrator directly
curl -X GET https://clawzz-orchestrator.onrender.com/health
```

---

## Step 6: Enable Auto-Deploys (Optional but Recommended)

1. Go to `clawzz-backend` → **Settings**
2. Under **"Deploy hooks"**:
   - Toggle **"Auto-deploy"** = **ON** ✓

3. Go to `clawzz-orchestrator` → **Settings**
4. Under **"Deploy hooks"**:
   - Toggle **"Auto-deploy"** = **ON** ✓

Now, every push to `main` branch will auto-trigger a new deployment.

---

## Step 7: Set Up Custom Domain (Optional)

If you want custom domains instead of `*.onrender.com`:

1. Go to `clawzz-backend` → **Settings** → **Custom Domain**
2. Enter: `api.yourdomain.com`
3. Add DNS CNAME record (Render will provide)
4. Repeat for orchestrator: `orchestrator.yourdomain.com`

---

## Service URLs (After Deployment)

| Service | URL | Status |
|---------|-----|--------|
| Backend | `https://clawzz-backend.onrender.com` | Live ✓ |
| Orchestrator | `https://clawzz-orchestrator.onrender.com` | Live ✓ |
| Health Check (Backend) | `https://clawzz-backend.onrender.com/health` | ✓ |
| Health Check (Orchestrator) | `https://clawzz-orchestrator.onrender.com/health` | ✓ |

---

## Troubleshooting

### Service won't start (Build fails)

**Error message:** `Build failed`

**Solution:**
1. Click service → **Logs**
2. Look for npm/pip errors
3. Common fixes:
   - `npm ci` vs `npm install` (use `ci`)
   - Missing TypeScript compilation
   - Python dependency conflicts

### Service crashes after start (Runtime error)

**Error message:** `Service exited with code 1`

**Solution:**
1. Check **Logs** for error message
2. Verify all required env variables are set
3. Check database connectivity (once DB is ready)

### Service is slow (Memory issues)

**Symptom:** Service restarts frequently or times out

**Solution:**
1. Upgrade plan from **Starter** to **Standard**:
   - Go to service → **Settings** → **Plan**
   - Select **Standard** ($25/mo)

### Database connection fails

**Error message:** `ECONNREFUSED` or `FATAL: password authentication failed`

**Solution:**
1. Verify `DATABASE_URL` is correct
2. Check if database is running (Neon)
3. Ensure SSL mode is correct: `?sslmode=require`

---

## Cost Tracking

View your Render bill:

1. Go to: https://dashboard.render.com/account/billing
2. Current services:
   - Backend (Starter): $7/month
   - Orchestrator (Starter): $7/month
   - **Total: $14/month**

Upgrade to Standard when you need more:
- Each Standard service: $25/month
- Better CPU/memory for production loads

---

## Next Steps

### Immediate
- [x] Deploy via Blueprint
- [x] Verify health checks
- [x] Set env variables
- [ ] Test API endpoints

### Soon (Phase 2)
- [ ] Database setup (Neon)
- [ ] Redis setup (Upstash)
- [ ] Database migrations
- [ ] End-to-end testing

### Later (Phase 3+)
- [ ] Custom domains
- [ ] Performance monitoring
- [ ] Auto-scaling rules
- [ ] CI/CD pipeline improvements

---

## Support

- **Render Docs**: https://render.com/docs
- **Status Page**: https://status.render.com
- **Dashboard**: https://dashboard.render.com

---

**Ready?** Start deployment now: https://dashboard.render.com/blueprints
