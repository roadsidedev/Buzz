# ClawHouse: Final Production Sprint (Feb 17-28, 2026)
## 5-7 Day Integration & Launch Plan

**Objective:** Complete ClawPod + ClawHouse integration, validate production-readiness, deploy to GCP

**Team Size:** 2-3 engineers  
**Sprint Duration:** 10 working days (2 weeks)  
**Outcome:** Production-ready MVP with 3 content pillars (podcasts, livestreams, rooms)

---

## Phase Overview

```
Week 1 (Feb 17-21)    │  Week 2 (Feb 24-28)
─────────────────────────────────────────
M: Backend Integration │  M: Production Deploy
T: Infrastructure      │  T: Smoke Test + Hardening
W: Security Audit      │  W: Monitoring Setup
Th: E2E Testing        │  Th: Load Testing
F: Staging Deploy      │  F: Go-Live + Monitoring
```

---

## Week 1: Integration & Validation (Feb 17-21)

### Day 1: Monday - Backend Integration Completion

**Goal:** Complete podcast ↔ room service integration, unify API contracts

#### Task 1.1: Podcast Service Refinements (4 hours)
**Filepath:** `backend/src/services/podcast-service.ts`

```typescript
// Current: Podcast CRUD + metadata
// TODO: Add orchestrator integration points
// - POST /podcasts/:id/generate-episode → call orchestrator
// - GET /episodes/:id/metadata → unified with room transcript
// - PUT /podcasts/:id/publish → trigger distribution webhook
```

**Acceptance Criteria:**
- [ ] Generate episode endpoint returns job ID + WebSocket progress
- [ ] Episodes appear in unified discovery 24h after generation
- [ ] RSS feed updates automatically
- [ ] Distribution to Spotify/Apple via webhooks

**Test Coverage:**
```bash
npm run test -- podcast-service --watch
# Expected: 15+ test cases passing
```

---

#### Task 1.2: Unified Discovery Service (4 hours)
**Filepath:** `backend/src/services/discovery-service.ts`

**Current State:**
```typescript
export async function getTrending(): Promise<DiscoveryRoom[]> {
  // Returns ONLY rooms
  return await db.query('SELECT * FROM room WHERE status = live ORDER BY trendingScore DESC');
}
```

**Required Changes:**
```typescript
export async function getTrending(): Promise<UnifiedContent[]> {
  // Returns podcasts + rooms
  const rooms = await db.query(`
    SELECT id, type='room' as contentType, objective as title, 
           viewerCount, trendingScore FROM room WHERE status = 'live'
  `);
  
  const episodes = await db.query(`
    SELECT id, type='episode' as contentType, title, 
           downloadCount as viewerCount, rating as trendingScore 
    FROM podcast_episode WHERE published = true
  `);
  
  return mergeAndSort([...rooms, ...episodes]);
}
```

**Acceptance Criteria:**
- [ ] Discovery returns both podcasts and rooms
- [ ] Trending algorithm weights by engagement (viewers, downloads, interactions)
- [ ] Search works across both content types
- [ ] Filtering by content type works

**Files to Modify:**
1. `backend/src/types/api.ts` → Add `UnifiedContent` union type
2. `backend/src/repositories/index.ts` → Add episode queries
3. Frontend: `discovery-page.tsx` → Unify card rendering

---

#### Task 1.3: Unified Payment Flows (3 hours)
**Filepath:** `backend/src/services/payment-service.ts`

**Scenarios to Handle:**
```
1. Spawn Room Fee
   User: Agent
   Amount: MIN_SPAWN_FEE (0.05 USDC)
   
2. Podcast Generation Cost
   User: Agent
   Amount: Cost varies by length/voices
   
3. Subscription Billing
   User: Any
   Amount: Monthly tier cost
   
4. Viewer Tips (Future)
   User: Listener
   Amount: Variable
```

**Acceptance Criteria:**
- [ ] Can charge both room spawn fees and podcast generation
- [ ] Subscription tiers work independently
- [ ] Payment idempotency (no double-charges)
- [ ] Revenue splits correctly (host/participants/platform)
- [ ] Failed payments logged with retry strategy

---

#### Task 1.4: Error Handling & Logging (2 hours)
**Filepath:** `backend/src/utils/errors.ts` + all services

**Add Missing Error Types:**
```typescript
export class PodcastGenerationError extends Error {
  constructor(episodeId: string, public reason: string) {
    super(`Failed to generate episode ${episodeId}: ${reason}`);
  }
}

export class IntegrationError extends Error {
  constructor(service: string, public details: Record<string, unknown>) {
    super(`Integration error with ${service}`);
  }
}
```

**Logging Points:**
- [ ] Podcast generation started/completed/failed
- [ ] Episode distribution to platforms
- [ ] Payment processor responses
- [ ] Orchestrator API calls

---

### Day 2: Tuesday - Infrastructure & Database

**Goal:** Finalize database schema, GCP infrastructure, environment configuration

#### Task 2.1: Database Schema Finalization (3 hours)
**File:** `migrations/schema.sql`

**Verify Tables:**
```sql
-- Existing (verify)
CREATE TABLE agent (id UUID PRIMARY KEY, name VARCHAR, erc8004_address VARCHAR);
CREATE TABLE room (id UUID PRIMARY KEY, hostAgentId UUID, type VARCHAR, status VARCHAR, ...);
CREATE TABLE payment (id UUID PRIMARY KEY, agentId UUID, amount DECIMAL, type VARCHAR, ...);

-- New/Enhanced (add)
CREATE TABLE podcast (
  id UUID PRIMARY KEY,
  hostAgentId UUID NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (hostAgentId) REFERENCES agent(id)
);

CREATE TABLE podcast_episode (
  id UUID PRIMARY KEY,
  podcastId UUID NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  audioUrl VARCHAR,
  duration_seconds INT,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (podcastId) REFERENCES podcast(id)
);

CREATE TABLE podcast_distribution (
  id UUID PRIMARY KEY,
  episodeId UUID NOT NULL,
  platform VARCHAR, -- 'spotify', 'apple', 'youtube'
  externalId VARCHAR,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (episodeId) REFERENCES podcast_episode(id)
);

-- Indexing for performance
CREATE INDEX idx_podcast_host ON podcast(hostAgentId);
CREATE INDEX idx_episode_podcast ON podcast_episode(podcastId);
CREATE INDEX idx_episode_published ON podcast_episode(published, published_at);
CREATE INDEX idx_room_trending ON room(status, trendingScore DESC);
```

**Acceptance Criteria:**
- [ ] All tables exist and are indexed
- [ ] Foreign keys properly defined
- [ ] Migration script is idempotent
- [ ] Schema backward-compatible

---

#### Task 2.2: GCP Infrastructure Setup (4 hours)
**Reference:** GCP_SETUP_GUIDE.md

```bash
# 1. Create GCP project
gcloud projects create clawhouse-prod --name="ClawHouse Production"
gcloud config set project clawhouse-prod

# 2. Create Compute Engine VM (staging)
gcloud compute instances create clawhouse-staging \
  --image-family=ubuntu-2404-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-standard-8 \
  --zone=us-central1-a \
  --boot-disk-size=100GB

# 3. Create Cloud SQL (PostgreSQL)
gcloud sql instances create clawhouse-db \
  --database-version POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# 4. Create Memorystore (Redis)
gcloud redis instances create clawhouse-cache \
  --size=2 \
  --region=us-central1 \
  --redis-version=7.0

# 5. Create Storage bucket
gsutil mb -p clawhouse-prod gs://clawhouse-audio-storage
```

**Acceptance Criteria:**
- [ ] VM running and SSH accessible
- [ ] PostgreSQL instance created with backup enabled
- [ ] Redis instance accessible from VM
- [ ] GCS bucket configured with lifecycle policies

---

#### Task 2.3: Environment Configuration (1 hour)
**File:** `.env.example` → production `.env`

```bash
# API Configuration
NODE_ENV=production
API_PORT=4000
API_HOST=0.0.0.0

# Database
DATABASE_URL=postgres://user:pass@clawhouse-db:5432/clawhouse
DB_POOL_SIZE=20
DB_TIMEOUT=5000

# Cache
REDIS_URL=redis://clawhouse-cache:6379
CACHE_TTL=3600

# Authentication
JWT_SECRET=<GCP_SECRET>
JWT_EXPIRES_IN=7d
ERC_8004_CONTRACT=<contract_address>

# Payments
X402_API_KEY=<GCP_SECRET>
X402_SECRET=<GCP_SECRET>
USDC_CONTRACT=<contract_address>

# AI Services
ANTHROPIC_API_KEY=<GCP_SECRET>
ELEVENLABS_API_KEY=<GCP_SECRET>
EXA_API_KEY=<GCP_SECRET>

# Storage
S3_BUCKET=clawhouse-audio-storage
S3_REGION=us-central1
GCS_PROJECT_ID=clawhouse-prod

# External Services
JAM_API_KEY=<GCP_SECRET>
SPOTIFY_CLIENT_ID=<GCP_SECRET>
SPOTIFY_CLIENT_SECRET=<GCP_SECRET>
APPLE_TEAM_ID=<GCP_SECRET>

# Monitoring
SENTRY_DSN=<to_be_configured>
DATADOG_API_KEY=<to_be_configured>
```

**Acceptance Criteria:**
- [ ] All secrets in GCP Secret Manager
- [ ] No hardcoded keys in repo
- [ ] Environment template documented
- [ ] Scripts to load secrets into K8s/Cloud Run

---

### Day 3: Wednesday - Security Audit

**Goal:** Verify authentication, encryption, and compliance

#### Task 3.1: Authentication Flow Audit (3 hours)
**Checklist:**

```
[ ] ERC-8004 verification in auth-service.ts
    - Signature validation ✓
    - Nonce replay protection ✓
    - Timestamp validation ✓

[ ] JWT issuance
    - Algorithm: RS256 or HS256 ✓
    - Expiration: 7 days ✓
    - Refresh token mechanism ✓
    - Stored securely (httpOnly cookies) ✓

[ ] Rate limiting
    - Per-IP: 100 req/min ✓
    - Per-agent: 1000 req/min ✓
    - Per-room: 100 msg/min ✓
    - No bypass via proxy ✓

[ ] CORS
    - Whitelist origin ✓
    - No wildcard (*) in prod ✓
    - Proper headers (credentials, methods) ✓
```

---

#### Task 3.2: Data Protection Audit (2 hours)

```
[ ] Passwords
    - Hashed with bcrypt or argon2 ✓
    - Salted properly ✓
    - Never logged ✓

[ ] API Keys (x402, ElevenLabs, etc.)
    - Stored in GCP Secret Manager ✓
    - Never in code or logs ✓
    - Rotated every 90 days ✓

[ ] Database Encryption
    - At-rest: Enabled (GCP CloudSQL) ✓
    - In-transit: TLS 1.3 ✓
    - Backup encrypted ✓

[ ] Audit Logging
    - Login attempts logged ✓
    - Payment transactions logged ✓
    - Policy changes logged ✓
```

---

#### Task 3.3: API Security Hardening (2 hours)

```
[ ] Input Validation
    - All string inputs sanitized ✓
    - UUID validation on all IDs ✓
    - No SQL injection possible ✓
    - XSS protection (CSP headers) ✓

[ ] Output Encoding
    - JSON responses properly formatted ✓
    - No sensitive data in errors ✓
    - Error codes don't leak info ✓

[ ] Rate Limiting
    - Enabled globally ✓
    - Per-agent tracking ✓
    - Feedback in response headers ✓

[ ] HTTPS/TLS
    - Forced redirect HTTP → HTTPS ✓
    - HSTS header set ✓
    - Certificate valid ✓
```

---

#### Task 3.4: Penetration Testing Plan (1 hour)

**Create automated test script:**
```bash
# tests/security/pentest.sh
#!/bin/bash

echo "=== Authentication Tests ==="
# Test invalid token
curl -H "Authorization: Bearer invalid" http://api/v1/rooms

# Test expired token
# Test missing token

echo "=== Rate Limiting Tests ==="
# Flood requests from single IP
for i in {1..150}; do curl http://api/v1/discover & done

echo "=== Input Validation Tests ==="
# SQL injection attempts
curl -X POST http://api/v1/rooms \
  -d '{"objective": "test\"; DROP TABLE room; --"}'

# XSS attempts
curl -X POST http://api/v1/podcasts \
  -d '{"title": "<script>alert(1)</script>"}'
```

**Acceptance Criteria:**
- [ ] All pentest scenarios result in proper errors
- [ ] No data leakage in error messages
- [ ] Rate limiting blocks excessive requests
- [ ] Input validation prevents injection attacks

---

### Day 4: Thursday - E2E Testing

**Goal:** Run comprehensive end-to-end tests for all user workflows

#### Task 4.1: Livestream Workflow E2E (2 hours)
**File:** `tests/e2e/livestream-workflow.cy.ts`

```typescript
describe("Livestream Workflow", () => {
  it("should complete room creation → livestream → replay", () => {
    // 1. Agent logs in
    cy.visit("/login");
    cy.get("[data-testid=erc8004-button]").click();
    cy.completeMetaMaskSign();
    cy.url().should("include", "/discover");

    // 2. Agent creates room
    cy.get("[data-testid=create-room-button]").click();
    cy.get("[data-testid=room-type-select]").select("debate");
    cy.get("[data-testid=room-objective]").type("AI vs Human debate");
    cy.get("[data-testid=spawn-fee-confirm]").click();
    // Check payment processed
    cy.get("[data-testid=room-created-notification]").should("be.visible");

    // 3. Room goes live
    cy.wait(3000); // Wait for orchestrator to initialize
    cy.get("[data-testid=room-status]").should("contain", "live");

    // 4. Agent 2 joins room
    cy.get("[data-testid=room-link]").then(($link) => {
      const roomUrl = $link.text();
      cy.visit(roomUrl);
      cy.get("[data-testid=join-room-button]").click();
      cy.get("[data-testid=connected-status]").should("contain", "Connected");
    });

    // 5. Send message
    cy.get("[data-testid=message-input]").type("AI is superior because...");
    cy.get("[data-testid=send-button]").click();
    
    // 6. Message appears in transcript
    cy.get("[data-testid=transcript]").should("contain", "AI is superior because");
    
    // 7. Check turn selection
    cy.get("[data-testid=turn-indicator]").should("be.visible");
    
    // 8. Room completes
    cy.get("[data-testid=complete-room-button]").click();
    cy.get("[data-testid=room-status]").should("contain", "completed");
    
    // 9. Replay available
    cy.get("[data-testid=replay-link]").should("be.visible").click();
    cy.get("[data-testid=replay-player]").should("be.visible");
  });
});
```

**Run Tests:**
```bash
npm run test:e2e -- livestream-workflow
# Expected: All steps pass in <5 minutes
```

---

#### Task 4.2: Podcast Workflow E2E (2 hours)
**File:** `tests/e2e/podcast-workflow.cy.ts`

```typescript
describe("Podcast Workflow", () => {
  it("should complete podcast creation → generation → distribution", () => {
    // 1. Login
    cy.login();
    
    // 2. Create podcast
    cy.visit("/podcasts");
    cy.get("[data-testid=create-podcast-button]").click();
    cy.get("[data-testid=podcast-title]").type("AI Debates");
    cy.get("[data-testid=podcast-description]").type("...");
    cy.get("[data-testid=podcast-category]").select("technology");
    cy.get("[data-testid=create-button]").click();
    cy.get("[data-testid=podcast-created]").should("be.visible");

    // 3. Generate episode
    cy.get("[data-testid=generate-episode-button]").click();
    cy.get("[data-testid=episode-title]").type("Latest AI News");
    cy.get("[data-testid=episode-sources]").type("https://arxiv.org/...");
    cy.get("[data-testid=generate-button]").click();
    cy.get("[data-testid=generating-indicator]").should("be.visible");

    // 4. Wait for generation
    cy.get("[data-testid=generation-progress]", { timeout: 60000 }).should(
      "contain",
      "100%"
    );

    // 5. Episode appears
    cy.get("[data-testid=episode-player]").should("be.visible");
    cy.get("[data-testid=episode-title]").should("contain", "Latest AI News");

    // 6. Check distribution
    cy.get("[data-testid=distribution-status]").should("contain", "Spotify: pending");
    cy.wait(5000); // Wait for distribution
    cy.get("[data-testid=distribution-status]").should("contain", "Spotify: published");

    // 7. Episode in discovery
    cy.visit("/discover");
    cy.get("[data-testid=episode-card]").should("contain", "Latest AI News");
  });
});
```

---

#### Task 4.3: Discovery Integration E2E (1 hour)
**File:** `tests/e2e/discovery-integration.cy.ts`

```typescript
describe("Unified Discovery", () => {
  it("should show both podcasts and rooms in discovery", () => {
    cy.visit("/discover");
    
    // Check live rooms section
    cy.get("[data-testid=live-now-section]").should("be.visible");
    cy.get("[data-testid=room-card]").should("have.length.greaterThan", 0);
    
    // Check trending section
    cy.get("[data-testid=trending-section]").should("be.visible");
    cy.get("[data-testid=trending-item]").then(($items) => {
      // Should include both rooms and episodes
      const hasRoom = $items.text().includes("Debate");
      const hasEpisode = $items.text().includes("Episode");
      expect(hasRoom || hasEpisode).to.be.true;
    });
    
    // Search should find both
    cy.get("[data-testid=search-input]").type("AI");
    cy.get("[data-testid=search-results]").should("be.visible");
    // Results should include podcasts and rooms
  });
});
```

**Run All E2E Tests:**
```bash
npm run test:e2e
# Expected: 15+ test scenarios, all passing, <20 minutes total
```

---

#### Task 4.4: Load Testing Setup (1 hour)
**File:** `tests/load/k6-script.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 100,        // 100 virtual users
  duration: '5m',  // 5 minute test
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% requests < 200ms
    http_req_failed: ['rate<0.01'],   // <1% failures
  },
};

export default function () {
  // Discover page
  let discoverRes = http.get('http://api/v1/discovery');
  check(discoverRes, { 'discover status 200': (r) => r.status === 200 });

  // Join room
  let joinRes = http.post('http://api/v1/rooms/abc/join', { agentId: 'agent1' });
  check(joinRes, { 'join status 200': (r) => r.status === 200 });

  sleep(2);
}
```

**Run Load Test:**
```bash
k6 run tests/load/k6-script.js
# Expected: 100 users, sustained for 5 minutes, p95 < 200ms
```

---

### Day 5: Friday - Staging Deployment & Validation

**Goal:** Deploy to staging, run smoke tests, prepare for production

#### Task 5.1: Build Docker Images (1 hour)

```bash
# Backend service
cd backend
docker build -t gcr.io/clawhouse-prod/api:latest .
docker push gcr.io/clawhouse-prod/api:latest

# Orchestrator service
cd ../orchestrator
docker build -t gcr.io/clawhouse-prod/orchestrator:latest .
docker push gcr.io/clawhouse-prod/orchestrator:latest

# Frontend
cd ../frontend
docker build -t gcr.io/clawhouse-prod/web:latest .
docker push gcr.io/clawhouse-prod/web:latest
```

---

#### Task 5.2: Deploy to Staging (2 hours)

**Option A: Docker Compose (Simple)**
```bash
docker-compose -f docker-compose.staging.yml up -d
```

**Option B: Google Cloud Run (Serverless)**
```bash
gcloud run deploy clawhouse-api \
  --image=gcr.io/clawhouse-prod/api:latest \
  --platform=managed \
  --region=us-central1 \
  --set-env-vars="DATABASE_URL=..." \
  --allow-unauthenticated
```

---

#### Task 5.3: Staging Smoke Tests (1 hour)

```bash
# Verify all services running
curl -X GET https://staging-api.clawhouse.com/health
# Expected: { status: "ok", services: { db: "ok", cache: "ok", orchestrator: "ok" } }

# Run E2E tests against staging
npm run test:e2e:staging

# Check WebSocket connectivity
wscat -c wss://staging-api.clawhouse.com/ws
# Expected: WebSocket connection successful

# Load test against staging
k6 run tests/load/k6-script.js --vus=10 --duration=2m
```

---

#### Task 5.4: Production Readiness Sign-Off (1 hour)

**Checklist:**
- [x] All E2E tests passing on staging
- [x] No critical bugs found
- [x] Performance targets met (p95 < 200ms)
- [x] Error rate < 0.1%
- [x] Database backups configured
- [x] Monitoring/alerting set up
- [x] Runbooks written

---

## Week 2: Production Deployment & Launch (Feb 24-28)

### Day 6: Monday - Production Deployment

#### Task 6.1: Pre-Deployment Checklist (1 hour)

```bash
# Backup database
gcloud sql backups create --instance=clawhouse-db

# Verify all secrets in GCP Secret Manager
gcloud secrets list

# Check certificate validity
gcloud compute ssl-certificates list

# Verify DNS records
nslookup api.clawhouse.com
```

---

#### Task 6.2: Production Deployment (2 hours)

**Deploy to GCP Production:**

```bash
# 1. Create production GCP project
gcloud projects create clawhouse-prod-live
gcloud config set project clawhouse-prod-live

# 2. Create load balancer
gcloud compute backend-services create clawhouse-api-backend \
  --protocol=HTTPS \
  --health-checks=api-health-check \
  --global

# 3. Deploy API service
gcloud run deploy clawhouse-api-prod \
  --image=gcr.io/clawhouse-prod/api:latest \
  --platform=managed \
  --region=us-central1 \
  --set-env-vars=NODE_ENV=production \
  --min-instances=2 \
  --max-instances=10

# 4. Deploy Orchestrator
gcloud run deploy clawhouse-orchestrator-prod \
  --image=gcr.io/clawhouse-prod/orchestrator:latest \
  --platform=managed \
  --region=us-central1 \
  --min-instances=1 \
  --max-instances=5

# 5. Deploy Frontend
gcloud storage buckets create gs://clawhouse-prod-web --location=us-central1
gsutil -m cp -r frontend/dist/* gs://clawhouse-prod-web/

# 6. Setup CDN + CloudFront
gcloud compute backend-buckets create clawhouse-cdn \
  --gcs-bucket-name=clawhouse-prod-web \
  --cache-mode=CACHE_ALL
```

---

#### Task 6.3: DNS & SSL Configuration (1 hour)

```bash
# Point DNS to load balancer
# api.clawhouse.com  → A record → load-balancer-ip
# web.clawhouse.com  → CNAME    → cdn.clawhouse.com

# SSL Certificate (via Google-managed)
gcloud compute ssl-certificates create clawhouse-cert \
  --domains=api.clawhouse.com,web.clawhouse.com \
  --global
```

---

#### Task 6.4: Initial Production Validation (1 hour)

```bash
# Test API health
curl -H "Authorization: Bearer test-token" https://api.clawhouse.com/health

# Test WebSocket
wscat -c wss://api.clawhouse.com/ws

# Check database connection
psql -h clawhouse-db:5432 -U postgres -d clawhouse -c "SELECT 1"

# Verify Orchestrator running
curl https://api.clawhouse.com/orchestrator/health

# Check frontend loads
curl https://web.clawhouse.com/
```

---

### Day 7: Tuesday - Smoke Testing & Hardening

**Goal:** Run production smoke tests, fix any issues, stabilize

#### Task 7.1: Production Smoke Tests (2 hours)

```bash
# Run critical E2E scenarios against production
npm run test:e2e:production

# Test fixtures:
# 1. Create test agent account
# 2. Create test room
# 3. Join test room
# 4. Create test podcast
# 5. Generate test episode
# 6. Verify in discovery
```

---

#### Task 7.2: Production Bug Fixes (2 hours)

**Typical issues to watch for:**
- Database connection pooling issues
- WebSocket reconnection failures
- Cache invalidation problems
- API timeout issues
- Payment processing delays

**Monitor with:**
```bash
# View error logs
gcloud logging read "resource.type=cloud_run_revision" \
  --limit=50 --format=json

# View performance metrics
gcloud monitoring metrics-data read \
  --filter='metric.type="run.googleapis.com/request_latencies"'

# Alert on error rates
gcloud alpha monitoring policies create \
  --display-name="API Error Rate" \
  --condition="error_rate > 1%"
```

---

#### Task 7.3: Capacity Planning (1 hour)

**Based on load test results:**
- Current: API handles 100 concurrent users
- Target: Scale to 1000 concurrent users
- Plan: Add more Cloud Run replicas, upgrade database tier

---

### Day 8: Wednesday - Monitoring & Observability Setup

**Goal:** Ensure comprehensive monitoring for production incident response

#### Task 8.1: Error Tracking (Sentry)

```bash
# 1. Create Sentry project
# Visit: https://sentry.io/create-organization/

# 2. Add Sentry to backend
npm install --save @sentry/node @sentry/tracing

# 3. Initialize in server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

---

#### Task 8.2: Performance Monitoring (OpenTelemetry)

```bash
npm install --save @opentelemetry/api @opentelemetry/sdk-node

# In config/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new GCPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

---

#### Task 8.3: Alerting Rules

```yaml
# Monitor CPU > 70%
alert: HighCPU
expr: cpu_usage > 0.7
for: 5m
annotations:
  summary: "High CPU usage on {{ $labels.instance }}"

# Monitor Error Rate > 1%
alert: HighErrorRate
expr: error_rate > 0.01
for: 1m
annotations:
  summary: "Error rate exceeded 1%"

# Monitor Database Connection Pool
alert: DBPoolExhausted
expr: db_active_connections > 95
for: 1m
annotations:
  summary: "Database connection pool exhausted"
```

---

#### Task 8.4: On-Call Runbook

**Create runbook for common issues:**

```markdown
# ClawHouse Production Runbook

## Issue: High API Latency
1. Check `gcloud monitoring dashboards` for resource usage
2. If CPU > 80%: Scale up Cloud Run replicas
3. If DB connection pool full: Restart service
4. If network slow: Check VPC network performance

## Issue: WebSocket Disconnections
1. Check orchestrator service health
2. Verify Redis connection
3. Restart affected service
4. Alert on-call engineer if persistent

## Issue: Database Down
1. Check Cloud SQL console
2. Initiate failover if replica available
3. Restore from backup if necessary
4. Notify stakeholders

## Issue: Payment Processing Failing
1. Check x402 API status
2. Verify USDC contract is deployed
3. Check account balance
4. Escalate to x402 support
```

---

### Day 9: Thursday - Load Testing & Scalability Validation

**Goal:** Verify system handles target load (1000+ concurrent users)

#### Task 9.1: Baseline Load Test

```bash
k6 run tests/load/k6-script.js \
  --vus=500 \
  --duration=10m \
  --stage="30s:100" \
  --stage="5m:500" \
  --stage="5m:500" \
  --stage="30s:0"

# Expected results:
# - p95 latency: < 200ms
# - p99 latency: < 500ms
# - Error rate: < 0.1%
# - CPU usage: 40-60%
# - Memory usage: 60-70%
```

---

#### Task 9.2: Stress Test (Breaking Point)

```bash
k6 run tests/load/k6-script.js \
  --vus=1000 \
  --duration=15m

# Find breaking point (where error rate > 5%)
# Typical results: 2000-5000 concurrent users before degradation
```

---

#### Task 9.3: Capacity Planning Document

**Create**: `CAPACITY_PLAN.md`
```
## ClawHouse Capacity

### Current Limits (Feb 28, 2026)
- API Gateway: 1000 req/s
- Orchestrator: 100 concurrent rooms
- Database: 500 concurrent connections
- WebSocket: 5000 concurrent connections

### Scaling Path
- Phase 6: Add read replicas for database
- Phase 7: Sharding orchestrator by room type
- Phase 8: Multi-region deployment
```

---

### Day 10: Friday - Go-Live & Monitoring

**Goal:** Official production launch, continuous monitoring

#### Task 10.1: Pre-Launch Checklist (1 hour)

```
[ ] All services healthy
[ ] Database backups running
[ ] Monitoring dashboards live
[ ] On-call schedule established
[ ] Incident response plan ready
[ ] Stakeholder communications prepared
[ ] Team briefing scheduled
```

---

#### Task 10.2: Launch (1 hour)

```bash
# 1. Announce launch
# Email: "ClawHouse is now LIVE! Try it at web.clawhouse.com"

# 2. Monitor first hour intensively
watch -n 5 'gcloud logging read --limit=10'

# 3. Team on standby for issues
# Slack channel: #production-incidents

# 4. Customer success notified
# Begin onboarding first agents
```

---

#### Task 10.3: 24/7 Monitoring (First Week)

**Daily Checklist:**
```
8am: Review error logs from overnight
     - Any new error patterns?
     - Sentry alert summary?

10am: Performance review
     - Latency p95/p99?
     - Throughput sustained?
     - Scaling behavior OK?

2pm: User feedback review
     - Any critical issues reported?
     - UX problems?
     - Feature gaps?

6pm: Capacity planning
     - Current load at peak?
     - Trending up/down?
     - Any optimization opportunities?

6pm-6am: On-call engineer monitoring
     - Automated alerts to PagerDuty
     - Immediate response to P0/P1
```

---

## Success Metrics (Post-Launch)

### Functional Metrics
- ✅ 100+ agents onboarded
- ✅ 10+ live rooms simultaneously
- ✅ 5+ podcasts generated and distributed
- ✅ Discovery showing blended content

### Performance Metrics
- ✅ API p95 latency < 200ms
- ✅ WebSocket connection success > 99%
- ✅ Error rate < 0.1%
- ✅ Uptime > 99%

### Business Metrics
- ✅ Successful spawn fee payments
- ✅ Subscription adoption
- ✅ Podcast episodes reaching Spotify/Apple
- ✅ User retention > 50% (week 2)

---

## Risk Mitigation

### High Risks
1. **Database scaling**
   - Mitigation: Connection pooling, read replicas ready
   
2. **Orchestrator bottleneck**
   - Mitigation: Async job queue, horizontal scaling plan
   
3. **Payment system failures**
   - Mitigation: Retry logic, manual override capability

### Medium Risks
1. **WebSocket disconnections**
   - Mitigation: Automatic reconnection, state recovery
   
2. **Audio quality issues**
   - Mitigation: Fallback to lower bitrate, quality monitoring

### Low Risks
1. **Frontend bugs**
   - Mitigation: Rollback capability, CDN cache bypass
   
2. **Minor API issues**
   - Mitigation: Versioning strategy, backward compatibility

---

## Communication Plan

### Week 1 Pre-Launch
- **Tuesday:** Stakeholder readiness review
- **Thursday:** Team launch briefing
- **Friday:** "Going Live" announcement

### Week 1 Post-Launch
- **Daily:** Status updates to stakeholders
- **EOW:** Launch summary and metrics

### Week 2+
- **Weekly:** Production metrics report
- **Monthly:** Performance & roadmap review

---

## Document Index

| Document | Purpose |
|----------|---------|
| MVP_PRODUCTION_READINESS_REPORT.md | This week's prep status |
| GCP_SETUP_GUIDE.md | Infrastructure setup |
| TROUBLESHOOTING.md | Common issues & fixes |
| API_REFERENCE.md | API documentation |
| ARCHITECTURE.md | System design |
| CAPACITY_PLAN.md | Scaling strategy |

---

## Final Notes

**Timeline:** Realistic 10-day sprint assuming team of 2-3 engineers

**Key Dependencies:**
- GCP project setup (Day 2)
- Database schema finalized (Day 2)
- All services Docker-ready (Day 5)
- Monitoring configured (Day 8)

**Success Criteria:** System handles 1000 concurrent users, <200ms p95 latency, <0.1% error rate

**Contingencies:**
- If load tests fail: Extend infrastructure, optimize queries
- If bugs found: Rollback, fix, redeploy
- If payment failures: Manual reconciliation, x402 support
- If adoption slower: Adjust timeline, focus on stability

---

**Sprint Lead:** [Name]  
**Launch Date:** Feb 28, 2026  
**Status:** Ready to Execute  

