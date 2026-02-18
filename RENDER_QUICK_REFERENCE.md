# Render Deployment Quick Reference Card

## TL;DR - Deploy in 3 Steps

### Step 1: Click Deploy
```
https://render.com/deploy?repo=https://github.com/roadsidedev/ClawZz&branch=main
```

### Step 2: Wait (5-10 min)
Watch the build logs. Services will show "Live" when ready.

### Step 3: Set Env Variables
Go to each service in dashboard → Environment → Add missing variables

---

## Services Being Deployed

| Service | Runtime | Port | Cost/Month |
|---------|---------|------|-----------|
| Backend | Node.js 20+ | 3000 | $7 |
| Orchestrator | Python 3.11+ | 8000 | $7 |

---

## Pre-Set Environment Variables

These are automatically configured in `render.yaml`:

```
Backend:
  NODE_ENV = production
  API_PORT = 3000
  JWT_SECRET = (auto-generated)
  ORCHESTRATOR_URL = (auto-linked)
  ORCHESTRATOR_API_KEY = (auto-generated)

Orchestrator:
  PYTHON_ENV = production
  PORT = 8000
  BACKEND_URL = (auto-linked)
  BACKEND_API_KEY = (auto-linked)
```

---

## You Must Add These (In Dashboard)

### Backend Service
| Variable | Where to Get | Type |
|----------|------------|------|
| DATABASE_URL | Neon | Secret |
| REDIS_URL | Upstash | Secret |
| R2_ACCESS_KEY_ID | Cloudflare | Secret |
| R2_SECRET_ACCESS_KEY | Cloudflare | Secret |
| R2_ENDPOINT | Cloudflare | Public |
| ELEVENLABS_API_KEY | ElevenLabs | Secret |
| JAM_API_KEY | Jam | Secret |
| X402_MUNCHKIN_KEY | x402 | Secret |

### Orchestrator Service
| Variable | Where to Get | Type |
|----------|------------|------|
| DATABASE_URL | Neon | Secret |
| REDIS_URL | Upstash | Secret |
| ANTHROPIC_API_KEY | Console.anthropic.com | Secret |
| OPENAI_API_KEY | OpenAI | Secret |

---

## After Deployment

### Verify Services Are Running
```bash
curl https://clawzz-backend.onrender.com/health
curl https://clawzz-orchestrator.onrender.com/health
```

### View Logs
- Backend: https://dashboard.render.com → clawzz-backend → Logs
- Orchestrator: https://dashboard.render.com → clawzz-orchestrator → Logs

### Update Env Variables
- Backend: https://dashboard.render.com → clawzz-backend → Environment
- Orchestrator: https://dashboard.render.com → clawzz-orchestrator → Environment

---

## Service URLs

After deployment:
```
Backend:       https://clawzz-backend.onrender.com
Orchestrator:  https://clawzz-orchestrator.onrender.com
```

---

## Important URLs

| Purpose | URL |
|---------|-----|
| Deploy | https://render.com/deploy?repo=https://github.com/roadsidedev/ClawZz&branch=main |
| Dashboard | https://dashboard.render.com |
| Docs | https://render.com/docs |
| Status | https://status.render.com |

---

## Troubleshooting

### Services won't build
- Check logs (Logs tab)
- Usually npm/pip issues
- See RENDER_DEPLOY_STEPS.md section 7

### Services keep crashing
- Check Logs tab for errors
- Verify env variables are set
- Usually missing DATABASE_URL/REDIS_URL

### Slow after deployment
- Upgrade from Starter to Standard
- Check Metrics tab for bottlenecks

---

## Build Commands

**Backend:**
```bash
cd backend && npm ci && npm run build
```

**Orchestrator:**
```bash
cd orchestrator && pip install -r requirements.txt
```

---

## Start Commands

**Backend:**
```bash
cd backend && npm start
```

**Orchestrator:**
```bash
cd orchestrator && python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
```

---

## Cost Summary

```
Starter Plans: $14/month
├── Backend: $7/month
└── Orchestrator: $7/month

Later (not included):
├── Database (Neon): $0-19/month
├── Cache (Upstash): $0-20/month
└── Storage (R2): $0.015/GB
```

---

## Files You'll Need

| File | Purpose |
|------|---------|
| render.yaml | Blueprint configuration |
| RENDER_DEPLOYMENT_SUMMARY.md | Quick reference |
| RENDER_DEPLOY_STEPS.md | Step-by-step guide |
| RENDER_DEPLOYMENT_CHECKLIST.md | Detailed checklist |

---

## One-Minute Checklist

- [ ] Both services show "Live" (green status)
- [ ] No errors in build logs
- [ ] Health check endpoints respond
- [ ] Can add env variables in dashboard
- [ ] Services auto-redeploy when env vars change

---

## Auto-Deploy on Push

Enabled for both services. When you push to `main`:
1. Render detects push
2. Runs build command
3. Runs start command
4. Health check passes
5. New version goes live

No downtime deployment.

---

## Support

- **Render Docs:** https://render.com/docs
- **Status:** https://status.render.com
- **Our Guide:** RENDER_DEPLOY_STEPS.md (troubleshooting section)

---

**Ready to deploy?**

Go to: https://render.com/deploy?repo=https://github.com/roadsidedev/ClawZz&branch=main
