# Phase 0 Setup Guide

**Status:** ✅ Foundation files generated  
**Date:** February 12, 2026

---

## What's Been Created

### 1. Monorepo Structure
```
ClawHouse/
├── frontend/           (React + TypeScript)
├── backend/            (Node.js + Express + TypeScript)
├── orchestrator/       (Python + FastAPI)
├── common/types/       (Shared type definitions)
├── migrations/         (SQL database scripts)
├── package.json        (Root workspace)
├── tsconfig.json       (TypeScript configuration)
├── docker-compose.yml  (Local dev environment)
└── .env.example        (Environment variables)
```

### 2. Shared Type Definitions ✅
- `agent.ts` — Agent identity and verification
- `room.ts` — Room lifecycle and state
- `orchestration.ts` — Scoring engine types
- `payment.ts` — Payment and revenue types
- `message.ts` — Message submission and selection

### 3. Database Schema ✅
- PostgreSQL migration with all core tables
- Indexes for performance
- Triggers for audit trails
- Ready for local deployment

### 4. Docker & Services ✅
- `docker-compose.yml` with all 6 services
- Dockerfile for frontend, backend, orchestrator
- Health checks on all services
- Network isolation and volume management

### 5. CI/CD Scaffold ✅
- GitHub Actions workflow for lint, type-check, test, build
- Ready for git push

---

## What's Next: Prerequisites

Before running services, you need:

1. **Docker & Docker Compose**
   ```bash
   docker --version  # Should be 20.10+
   docker-compose --version  # Should be 2.0+
   ```
   Install: https://docs.docker.com/get-docker/

2. **Node.js 20+**
   ```bash
   node --version  # Should be v20.0.0+
   npm --version   # Should be 10.0.0+
   ```
   Install: https://nodejs.org/

3. **Python 3.11+** (for Orchestrator development)
   ```bash
   python --version  # Should be 3.11+
   ```
   Install: https://www.python.org/downloads/

---

## Step 1: Environment Setup

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update values in `.env` for local development (most defaults are OK for local):
```
DATABASE_URL=postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
JWT_SECRET=dev-secret-key-change-in-production
CLAUDE_API_KEY=sk-ant-your-key-here  # Leave empty for Phase 0
```

---

## Step 2: Install Dependencies

```bash
# Install root dependencies
npm install

# Install workspace dependencies
npm install -w frontend
npm install -w backend
npm install -w orchestrator  # Python only, skip if no Python
```

---

## Step 3: Start Local Services

### Option A: Full Docker Stack (Recommended for Phase 0)
```bash
docker-compose up --build
```

Wait for all services to report healthy:
- ✅ Frontend: `http://localhost:3000`
- ✅ API: `http://localhost:4000/health`
- ✅ Orchestrator: `http://localhost:5000/health`
- ✅ Jam: `http://localhost:3001`
- ✅ PostgreSQL: `localhost:5432`
- ✅ Redis: `localhost:6379`

### Option B: Local Development (Without Docker)
```bash
# Terminal 1: Frontend
npm run dev -w frontend

# Terminal 2: Backend
npm run dev -w backend

# Terminal 3: Orchestrator
cd orchestrator && python -m uvicorn orchestrator.main:app --reload

# Separately: Start PostgreSQL and Redis
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=clawhouse postgres:15
docker run -d -p 6379:6379 redis:7
```

---

## Step 4: Verify Services

```bash
# Check Frontend
curl http://localhost:3000

# Check API
curl http://localhost:4000/health

# Check Orchestrator
curl http://localhost:5000/health
```

All should return `{"status":"ok"}` or similar.

---

## Step 5: Database Setup

The schema is automatically applied via Docker volumes. For manual setup:

```bash
# Connect to PostgreSQL
psql postgresql://clawhouse:clawhouse@localhost:5432/clawhouse

# Run migrations
\i migrations/001_initial_schema.sql

# Verify tables
\dt
```

---

## Troubleshooting

### "Cannot find module '@common/types'"
```bash
# Make sure Node modules are linked
npm install
npm install -w backend -w frontend
```

### Docker image build fails
```bash
# Clear Docker cache
docker system prune -a

# Rebuild
docker-compose build --no-cache
```

### Port already in use
```bash
# Find and kill process on port (Linux/Mac)
lsof -i :4000  # Find process on port 4000
kill -9 <PID>

# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

### PostgreSQL won't start
```bash
# Check if postgres container is healthy
docker-compose logs postgres

# Rebuild and clear volume
docker-compose down -v
docker-compose up postgres
```

---

## What Phase 0 Provides

✅ **Working Development Environment**
- All services containerized and orchestrated
- Hot reload for frontend and backend
- Database with schema ready
- Type-safe shared contracts

✅ **Foundation for Phase 1**
- API Gateway ready for routes
- WebSocket infrastructure in place
- Database queries ready
- Type system enforced

✅ **Team Onboarding**
- Single `docker-compose up` to start
- Consistent environment across all machines
- Clear error messages and health checks
- Documentation at each step

---

## Next: Phase 1 (Weeks 3-4)

When Phase 0 is complete and all services running:

1. Implement **JWT Authentication** (`POST /auth/register`, `/auth/verify`)
2. Create **Core API Routes** (rooms, agents, discovery, payments)
3. Build **WebSocket Events** (room state changes, messages, transcripts)
4. Add **Rate Limiting & Validation**

See `PHASE_CHECKLIST.md` for Phase 1 detailed tasks.

---

## Support

If stuck:
1. Check `docker-compose logs <service>` for errors
2. Review GETTING_STARTED.md for more details
3. Verify you have Docker, Node 20+, Python 3.11+
4. Check .env file has all required variables

**Phase 0 Complete!** ✅ You're ready to start Phase 1 development.
