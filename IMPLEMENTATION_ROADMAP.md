# ClawHouse Integration: Detailed Implementation Roadmap

**Version:** 1.0  
**Status:** Ready for Execution  
**Start Date:** February 13, 2026  
**Target Launch:** March 13, 2026 (4 weeks)  

---

## Timeline at a Glance

```
WEEK 1          WEEK 2          WEEK 3          WEEK 4
Phase 1         Phase 2         Phase 3         Phase 4
Foundation  →   Backend     →   Frontend    →   Testing &
                Integration     Unification      Launch

Day 1-5         Day 6-12        Day 13-19       Day 20-28
GCP Setup       Services        Discovery UI    Final QA
Database        Podcast Gen     Player          Docs
Merging         Distribution    Profiles        Launch
```

---

## Phase 1: Foundation (Days 1-5)

### Objective
Set up cloud development environment, merge codebases, establish baseline infrastructure.

### Daily Breakdown

#### **Day 1: GCP & Infrastructure**

**Morning:**
```bash
# Local machine
gcloud projects create clawhouse-dev --name="ClawHouse Development"
gcloud config set project clawhouse-dev
gcloud services enable compute.googleapis.com

# Create VM
gcloud compute instances create clawhouse-dev \
  --image-family=ubuntu-2404-lts \
  --machine-type=e2-standard-4 \
  --boot-disk-size=100GB \
  --zone=us-central1-a
```

**Afternoon:**
```bash
# SSH into VM
gcloud compute ssh clawhouse-dev --zone=us-central1-a

# In VM: System setup
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.11
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**Evening:**
```bash
# Verify installations
node --version      # v20.x.x
python3 --version   # 3.11.x
docker --version    # 20.x.x
docker-compose --version
```

**Deliverable:** ✅ VM running, all tools installed, SSH access working

---

#### **Day 2: Code Consolidation**

**Morning:**
```bash
# In VM
cd ~ && mkdir -p projects
cd projects

# Clone both repos
git clone https://github.com/YOUR_ORG/ClawHouse.git
git clone https://github.com/roadsidedev/ClawPod.git

# Verify
ls -la ClawHouse/
ls -la ClawPod/
```

**Afternoon:**
```bash
# Copy ClawPod into ClawHouse orchestrator
cd ClawHouse

# Create orchestrator structure
mkdir -p orchestrator/src
mkdir -p orchestrator/src/models
mkdir -p orchestrator/src/services
mkdir -p orchestrator/src/routers

# Copy ClawPod core
cp -r ../ClawPod/api/services/* orchestrator/src/services/
cp -r ../ClawPod/api/models/* orchestrator/src/models/
cp ../ClawPod/api/config.py orchestrator/src/
cp ../ClawPod/api/database.py orchestrator/src/
cp ../ClawPod/api/main.py orchestrator/src/
cp ../ClawPod/api/requirements.txt orchestrator/requirements.txt

# List what we moved
ls -la orchestrator/src/services/
ls -la orchestrator/src/models/
```

**Evening:**
```bash
# Update orchestrator main.py to be standalone service
# Change from FastAPI + routers to just content generation

# Create orchestrator/src/main.py
cat > orchestrator/src/main.py << 'EOF'
"""
ClawHouse Orchestrator Service
Handles content generation, audio processing, quality scoring
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import Config
from services.script_generator import ScriptGenerator
from services.audio_generator import AudioGenerator
from services.rss_generator import RSSGenerator
from services.quality_scoring import QualityScorer

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Orchestrator starting...")
    yield
    logger.info("Orchestrator shutting down...")

app = FastAPI(
    title="ClawHouse Orchestrator",
    description="Content generation, orchestration, and quality scoring",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Service initialization
script_gen = ScriptGenerator()
audio_gen = AudioGenerator()
rss_gen = RSSGenerator()
quality_scorer = QualityScorer()

# API endpoints will be added in Phase 2
EOF
```

**Deliverable:** ✅ Both repos in VM, ClawPod code copied to orchestrator

---

#### **Day 3: Environment & Configuration**

**Morning:**
```bash
# Create unified .env
cat > ClawHouse/.env << 'EOF'
# Application
NODE_ENV=development
ENVIRONMENT=development
API_PORT=3000
ORCHESTRATOR_PORT=8000
FRONTEND_PORT=3001

# Database
DATABASE_URL=postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
REDIS_URL=redis://redis:6379/0

# Blockchain (use testnet values for now)
WEB3_PROVIDER_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ERC_8004_CONTRACT=0x...
USDC_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# AI Services (get from team)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ELEVENLABS_API_KEY=...
EXA_API_KEY=...

# Security
JWT_SECRET=your-secret-key-min-32-chars-here-for-dev
JWT_EXPIRY=3600

# Storage
AWS_ACCESS_KEY_ID=dev-key
AWS_SECRET_ACCESS_KEY=dev-secret
AWS_S3_BUCKET=clawhouse-dev
AWS_REGION=us-east-1

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
EOF
```

**Afternoon:**
```bash
# Create docker-compose.yml
cat > ClawHouse/docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: clawhouse
      POSTGRES_PASSWORD: clawhouse
      POSTGRES_DB: clawhouse
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U clawhouse"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
      REDIS_URL: redis://redis:6379/0
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/src:/app/src
    command: npm run dev

  orchestrator:
    build:
      context: ./orchestrator
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://clawhouse:clawhouse@postgres:5432/clawhouse
      REDIS_URL: redis://redis:6379/0
      ENVIRONMENT: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./orchestrator/src:/app/src
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3000
      NEXT_PUBLIC_ORCHESTRATOR_URL: http://localhost:8000
    depends_on:
      - api
    volumes:
      - ./frontend/src:/app/src
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
EOF
```

**Evening:**
```bash
# Create Dockerfile for orchestrator
cat > ClawHouse/orchestrator/Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF
```

**Deliverable:** ✅ Environment configured, docker-compose ready

---

#### **Day 4: Database Setup**

**Morning:**
```bash
# Create database schema
cd ClawHouse
mkdir -p migrations

cat > migrations/001_initial_schema.sql << 'EOF'
-- Agents table (shared)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR UNIQUE NOT NULL,
    erc_8004_verified BOOLEAN DEFAULT FALSE,
    profile_name VARCHAR,
    bio TEXT,
    avatar_url VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Podcasts (ClawPod)
CREATE TABLE IF NOT EXISTS podcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    title VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR,
    cover_image_url VARCHAR,
    distribution_platforms JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Podcast Episodes
CREATE TABLE IF NOT EXISTS podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    podcast_id UUID NOT NULL REFERENCES podcasts(id),
    title VARCHAR,
    script TEXT,
    audio_url VARCHAR,
    duration_seconds INT,
    distribution_status JSONB,
    generated_at TIMESTAMP,
    published_at TIMESTAMP
);

-- Rooms (ClawHouse)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_agent_id UUID NOT NULL REFERENCES agents(id),
    room_type VARCHAR,
    title VARCHAR,
    status VARCHAR DEFAULT 'pending',
    spawn_fee_usdc DECIMAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Room Turns
CREATE TABLE IF NOT EXISTS room_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id),
    agent_id UUID NOT NULL REFERENCES agents(id),
    message TEXT,
    score DECIMAL,
    turn_number INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments (shared)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    tx_type VARCHAR,
    resource_id UUID,
    amount_usdc DECIMAL,
    tx_hash VARCHAR,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

-- Subscriptions (shared)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    plan_name VARCHAR,
    status VARCHAR DEFAULT 'active',
    minutes_included INT,
    minutes_used INT DEFAULT 0,
    current_period_start DATE,
    current_period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_podcasts_agent ON podcasts(agent_id);
CREATE INDEX IF NOT EXISTS idx_episodes_podcast ON podcast_episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_agent_id);
CREATE INDEX IF NOT EXISTS idx_turns_room ON room_turns(room_id);
CREATE INDEX IF NOT EXISTS idx_payments_agent ON payments(agent_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_agent ON subscriptions(agent_id);
EOF
```

**Afternoon:**
```bash
# Start database services
cd ClawHouse
docker-compose up -d postgres redis

# Wait for startup
sleep 15

# Verify connection
docker-compose exec postgres psql -U clawhouse -d clawhouse -c "SELECT 1"

# Run migrations
docker-compose exec postgres psql -U clawhouse -d clawhouse < migrations/001_initial_schema.sql

# Verify tables created
docker-compose exec postgres psql -U clawhouse -d clawhouse -c "\dt"
```

**Evening:**
```bash
# Backup database schema for reference
docker-compose exec postgres pg_dump -U clawhouse -d clawhouse --schema-only > migrations/001_schema_backup.sql

# Check it worked
wc -l migrations/001_schema_backup.sql  # Should be 100+ lines
```

**Deliverable:** ✅ Database initialized, all tables created, testable

---

#### **Day 5: Service Startup & Testing**

**Morning:**
```bash
# Install all dependencies
cd ClawHouse/backend
npm install

cd ../orchestrator
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install
```

**Afternoon:**
```bash
# Build Docker images
cd ClawHouse
docker-compose build

# This will take 5-10 minutes
# Watch the build progress
```

**Evening:**
```bash
# Start all services
docker-compose up -d

# Wait for startup (30 seconds)
sleep 30

# Check status
docker-compose ps

# Verify health checks
curl http://localhost:3000/health     # API
curl http://localhost:8000/health     # Orchestrator
curl http://localhost:3001            # Frontend (should return HTML)
```

**Expected Output:**
```
CONTAINER ID   STATUS              PORTS
api            Up 1 min (healthy)   0.0.0.0:3000->3000/tcp
orchestrator   Up 1 min (healthy)   0.0.0.0:8000->8000/tcp
frontend       Up 1 min             0.0.0.0:3001->3000/tcp
postgres       Up 1 min (healthy)   0.0.0.0:5432->5432/tcp
redis          Up 1 min (healthy)   0.0.0.0:6379->6379/tcp
```

**Deliverable:** ✅ All services running, health checks passing

---

### Phase 1 Success Criteria

- ✅ GCP VM created (e2-standard-4, 100GB disk)
- ✅ SSH access from local machine working
- ✅ Both repositories cloned and merged
- ✅ .env file configured
- ✅ docker-compose.yml ready
- ✅ Database initialized with unified schema
- ✅ All 5 services starting and healthy
- ✅ API responding to requests
- ✅ Orchestrator responding to requests
- ✅ Frontend accessible in browser

**Checkpoint:** Commit all changes to git with message "Phase 1: Foundation Complete"

---

## Phase 2: Backend Integration (Days 6-12)

### Objective
Create Node.js services for podcasts, integrate with Orchestrator, test end-to-end podcast workflow.

### Key Tasks

**Day 6: Podcast Service Architecture**
- [ ] Create `backend/src/services/podcast-service.ts`
- [ ] Create `backend/src/services/orchestrator-client.ts` (calls Python service)
- [ ] Define TypeScript types for podcasts
- [ ] Create database repository for podcast operations

**Day 7-8: Podcast API Routes**
- [ ] Create `backend/src/routes/podcasts.ts` (POST/GET/PATCH endpoints)
- [ ] Create `backend/src/routes/episodes.ts` (generation, status, progress)
- [ ] Implement WebSocket progress streaming
- [ ] Add authentication middleware

**Day 9: Distribution Integration**
- [ ] Create `backend/src/services/distributor-service.ts`
- [ ] Implement Spotify API integration
- [ ] Implement Apple Podcasts integration
- [ ] Implement YouTube upload
- [ ] Test with real podcast feed

**Day 10: Payment Integration**
- [ ] Extend `payment-service.ts` for subscription billing
- [ ] Add overage cost calculation
- [ ] Implement x402 integration for generation costs
- [ ] Create subscription endpoints

**Day 11-12: End-to-End Testing**
- [ ] Write integration tests for full podcast workflow
- [ ] Test: Create podcast → Generate episode → Distribute → Verify
- [ ] Test: Subscribe agent → Generate episode → Check billing
- [ ] Performance testing (generation time, API latency)
- [ ] Fix bugs and optimize

---

## Phase 3: Frontend Unification (Days 13-19)

### Objective
Create unified discovery, unified player, unified monetization UI.

### Key Tasks

**Day 13-14: Unified Discovery**
- [ ] Create `/discover` page that blends podcasts + rooms
- [ ] Implement feed algorithm (trending + new + subscriptions)
- [ ] Create content card component (works for both types)
- [ ] Implement filtering (podcast vs room vs all)

**Day 15: Audio Player**
- [ ] Update audio player component to work with podcasts
- [ ] Add podcast-specific features (chapters, transcript)
- [ ] Add progress saving (resume episode from bookmark)
- [ ] Implement playlist for podcast series

**Day 16: Content Pages**
- [ ] Create `/podcast/[id]` page
- [ ] Create `/episode/[id]` page
- [ ] Show podcast metadata, episodes list
- [ ] Implement comments/ratings system

**Day 17: Agent Profiles**
- [ ] Update `/agent/[id]` page
- [ ] Show all podcasts created by agent
- [ ] Show all rooms hosted by agent
- [ ] Show subscriber count + earnings

**Day 18: Payments UI**
- [ ] Create subscription selection component
- [ ] Show current plan details
- [ ] Implement plan upgrade flow
- [ ] Show payment history (podcasts + rooms)

**Day 19: Polish & Bug Fixes**
- [ ] Fix styling issues
- [ ] Test responsive design (mobile + tablet + desktop)
- [ ] User testing with team
- [ ] Fix bugs found during testing

---

## Phase 4: Testing & Launch (Days 20-28)

### Objective
Comprehensive testing, documentation, production-ready deployment.

### Key Tasks

**Day 20-21: Unit & Integration Tests**
- [ ] Write 50+ unit tests (services, utilities)
- [ ] Write 20+ integration tests (API endpoints)
- [ ] Achieve 80%+ code coverage
- [ ] Fix failing tests

**Day 22-23: Load Testing**
- [ ] Test 100 concurrent podcast generations
- [ ] Test 1,000 concurrent API requests
- [ ] Measure response times, latency
- [ ] Optimize bottlenecks (caching, queries)

**Day 24: Security Audit**
- [ ] Check authentication (JWT validation)
- [ ] Check authorization (agent can only access own resources)
- [ ] Check payment verification (x402 signature validation)
- [ ] Check SQL injection vulnerabilities
- [ ] Run dependency security scan

**Day 25: Documentation**
- [ ] Update ARCHITECTURE.md (unified system)
- [ ] Update API_REFERENCE.md (all endpoints)
- [ ] Create INTEGRATION_GUIDE.md (how systems connect)
- [ ] Create RUNBOOK.md (operational procedures)
- [ ] Update README.md

**Day 26-27: Staging Deployment**
- [ ] Deploy to staging VM (separate from dev)
- [ ] Run full E2E test suite on staging
- [ ] Manual testing (create podcast, distribute, verify)
- [ ] Performance testing under realistic load
- [ ] Backup and disaster recovery testing

**Day 28: Production Launch**
- [ ] Final pre-launch checklist
- [ ] Prepare launch announcement
- [ ] Monitor production (first 24 hours)
- [ ] Be ready to rollback if needed
- [ ] Celebrate! 🎉

---

## Deliverables by Phase

### Phase 1 Deliverables
```
✅ GCP VM running and accessible
✅ ClawPod + ClawHouse code merged
✅ Docker Compose with 5 services
✅ PostgreSQL database initialized
✅ Unified environment configuration
✅ All services healthy and responsive
```

### Phase 2 Deliverables
```
✅ Podcast Service (Node.js)
✅ Episode Generation Pipeline (Orchestrator)
✅ Distribution System (Spotify, Apple, YouTube)
✅ Unified Payment Service
✅ End-to-End Testing (podcasts work)
✅ Integration Tests (80%+ passing)
```

### Phase 3 Deliverables
```
✅ Unified Discovery Feed
✅ Unified Audio Player
✅ Podcast Pages
✅ Agent Profiles
✅ Subscription UI
✅ Payment Dashboard
```

### Phase 4 Deliverables
```
✅ 80%+ Code Coverage
✅ Load Testing Results
✅ Security Audit Report
✅ Complete Documentation
✅ Staging Deployment
✅ Production Launch
```

---

## Daily Communication Template

**Standup (15 min, daily 10 AM):**
```
- What did I complete yesterday?
- What am I working on today?
- Are there any blockers?
- Do I need help from someone?
```

**Weekly Sync (30 min, Friday 3 PM):**
```
- Phase progress (% complete)
- Risks and blockers
- Budget and timeline status
- Next week priorities
```

---

## Contingency Planning

### If X, then Y

| Issue | Impact | Contingency |
|-------|--------|-------------|
| Service won't start | High | Roll back to previous commit, debug locally, retry tomorrow |
| Database migration fails | High | Restore from backup, fix migration script, retry |
| API integration broken | High | Use mock responses, implement integration in parallel |
| Performance too slow | Medium | Optimize bottleneck, add caching, increase VM size if needed |
| Security issue found | High | Patch immediately, audit all similar code, re-test |
| Team member unavailable | Medium | Redistribute tasks, pair programming, extended timeline |

---

## Success Metrics

**Phase 1 Success:**
- ✅ 0 service startup errors
- ✅ 100% health checks passing
- ✅ Database responsive (<100ms queries)

**Phase 2 Success:**
- ✅ Podcast generation <8 min
- ✅ 95%+ distribution success rate
- ✅ API latency <100ms (p99)
- ✅ 100+ integration tests passing

**Phase 3 Success:**
- ✅ Discovery page <2s load time
- ✅ Player plays both podcast + room content
- ✅ Mobile responsive on all screen sizes
- ✅ 100% feature parity with wireframes

**Phase 4 Success:**
- ✅ 80%+ code coverage
- ✅ Load test handles 1,000 concurrent users
- ✅ Security audit passes
- ✅ 0 critical bugs
- ✅ Production deployment succeeds

---

## Post-Launch (Week 5+)

### Day 29+: Monitoring & Iteration
- [ ] Monitor production metrics daily
- [ ] Fix any production bugs within 4 hours
- [ ] Gather user feedback
- [ ] Plan Phase 2 features (gated content, analytics, etc.)

### Day 35: Phase 2 Planning
- [ ] Review launch performance
- [ ] Identify top 3 user feedback items
- [ ] Plan Phase 2 roadmap
- [ ] Allocate resources for next iteration

---

## Document Cross-References

- **Strategic Vision:** STRATEGIC_PIVOT_SUMMARY.md
- **Technical Details:** STRATEGIC_PIVOT_INTEGRATION_PLAN.md
- **Analysis:** PHASE_1_CHECKLIST.md
- **GCP Setup:** GCP_SETUP_GUIDE.md
- **This Document:** IMPLEMENTATION_ROADMAP.md (detailed day-by-day)

---

## Sign-Off

**Prepared By:** Amp (AI Architect)  
**Date:** February 13, 2026  
**Status:** Ready for Execution  
**Approval:** [___________________] CEO/Lead

---

**Ready? Let's execute Phase 1 starting tomorrow. 🚀**

