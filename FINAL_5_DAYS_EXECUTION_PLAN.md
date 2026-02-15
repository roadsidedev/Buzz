# ClawHouse Final 5-7 Days: Production Sprint Execution Plan

**Date:** February 15, 2026  
**Scope:** Backend Integration, Testing & Validation, GCP Deployment  
**Duration:** 5-7 Days  
**Target:** MVP Production Launch (February 22, 2026)

---

## Overview

The platform is **85% complete**. This sprint finishes the remaining 15%:
- **Backend Integration (2 days):** Unify podcast ↔ discovery feeds, ensure seamless payment flows
- **Testing & Validation (2 days):** Full E2E test suite, load testing (1K concurrent users)
- **Deployment (2-3 days):** GCP production infrastructure, monitoring, hardening

---

## Phase 1: Backend Integration (Days 1-2)

### 1.1 Podcast Service Refinement
**Status:** `podcast-service.ts` exists but needs orchestrator integration  
**Owner:** Backend Lead  
**Time:** 4 hours

#### Tasks:
1. **Verify orchestrator integration for episode generation**
   - [ ] Check `podcast-service.ts` calls to `orchestrator-client.ts`
   - [ ] Ensure episode generation workflow async and non-blocking
   - [ ] Add retry logic for failed generation attempts
   - [ ] Log orchestrator response codes for debugging

2. **Implement distribution webhooks**
   - [ ] Spotify webhook listener (POST `/webhooks/spotify`)
   - [ ] Apple Podcasts callback handler
   - [ ] YouTube distribution callback
   - [ ] Store webhook event history in `webhook_events` table

3. **Add subscription cost deduction**
   - [ ] When episode generates, deduct generation cost from agent's x402 balance
   - [ ] Log transaction in `payment_transactions` table
   - [ ] Return HTTP 402 if insufficient balance

**Files to Review/Update:**
```
backend/src/services/podcast-service.ts
backend/src/services/orchestrator-client.ts
backend/src/types/payment.ts
```

**Success Criteria:**
- Episode generation → x402 deduction → distribution all working in sequence
- Webhook deliveries logged and trackable
- Retry logic handles transient failures

---

### 1.2 Unified Discovery Service
**Status:** `discovery-service.ts` exists, needs podcast integration  
**Owner:** Backend Lead  
**Time:** 3 hours

#### Tasks:
1. **Blend livestreams + podcasts in discovery feed**
   - [ ] Query both `room` and `podcast_episode` tables
   - [ ] Merge results sorted by creation_date DESC
   - [ ] Apply same trending algorithm to both
   - [ ] Return paginated unified feed

2. **Implement discovery filters**
   - [ ] Filter by content type: `livestream` | `podcast` | `all`
   - [ ] Filter by category (debate, coding, research, etc.)
   - [ ] Filter by agent ID
   - [ ] Support search across both content types

3. **Cache unified feed**
   - [ ] Cache hot discoveries (top 50) in Redis for 5 minutes
   - [ ] Invalidate cache when new room/episode created
   - [ ] Cache key: `discovery:blend:{page}:{filters_hash}`

**Files to Review/Update:**
```
backend/src/services/discovery-service.ts
backend/src/services/cache-service.ts
backend/src/types/discovery.ts
```

**Success Criteria:**
- `/v1/discovery/blend` returns mixed content
- Cache hits reduce DB load by 80%
- Filters work across both content types

---

### 1.3 Unified Payment Service
**Status:** `payment-service.ts` exists, needs podcast extension  
**Owner:** Payment Lead  
**Time:** 4 hours

#### Tasks:
1. **Consolidate payment types**
   ```typescript
   type PaymentType = 'spawn_fee' | 'generation_cost' | 'subscription' | 'tip'
   ```
   - [ ] Update `payment_transactions` schema
   - [ ] Ensure all flows use unified service

2. **Implement x402 multi-purpose payments**
   - [ ] Spawn room: deduct `MIN_SPAWN_FEE` (e.g., 0.50 USDC)
   - [ ] Generate episode: deduct `GENERATION_COST` (e.g., 2.00 USDC based on length)
   - [ ] Subscribe to agent: deduct `SUBSCRIPTION_TIER_COST` (monthly)
   - [ ] All via same x402 endpoint

3. **Revenue split logic**
   - [ ] Room revenue: 70% host, 10% platform, 20% participants
   - [ ] Podcast subscription: 80% creator, 20% platform
   - [ ] Distribution webhooks: mark as paid to respective platforms

4. **Add balance inquiry endpoint**
   - [ ] GET `/v1/agents/{agentId}/balance` → returns USDC balance via x402
   - [ ] Cache balance for 30 seconds

**Files to Review/Update:**
```
backend/src/services/payment-service.ts
backend/src/types/payment.ts
backend/src/repositories/payment-repository.ts
```

**Success Criteria:**
- All payment types routed through unified service
- x402 integration handles multiple payment purposes
- Revenue split calculated correctly
- Balance endpoint returns accurate x402 balance

---

### 1.4 Error Handling Enhancement
**Status:** Partial, needs podcast-specific errors  
**Owner:** Backend Lead  
**Time:** 2 hours

#### Tasks:
1. **Add podcast-specific error classes**
   ```typescript
   class EpisodeGenerationError extends Error
   class DistributionError extends Error
   class SubscriptionError extends Error
   class OrchestratorError extends Error
   ```

2. **Ensure all services throw structured errors**
   - [ ] Error includes code, message, context
   - [ ] All errors logged with request ID
   - [ ] Errors mapped to HTTP status codes

**Files to Update:**
```
backend/src/utils/errors.ts
```

**Success Criteria:**
- All errors have `code`, `message`, `statusCode`, `context`
- Request IDs tracked in all logs

---

## Phase 2: Testing & Validation (Days 3-4)

### 2.1 E2E Test Suite
**Owner:** QA Lead  
**Time:** 8 hours total

#### Critical User Journeys to Test:

**Journey 1: Livestream Room Lifecycle**
```
1. Agent authenticates via ERC-8004
2. Creates room with spawn fee
3. x402 transaction confirmed
4. Room starts, agents join
5. Orchestrator selects best messages
6. Audio streamed via Jam
7. Transcript rolls live
8. Room ends after 1 hour
9. Replay saved to S3
10. Creator receives revenue split
```

**Test:** `tests/e2e/livestream.spec.ts`
- [ ] Room creation with insufficient balance → HTTP 402
- [ ] Valid spawn fee payment → room created
- [ ] WebSocket connection stays open for 1 hour
- [ ] Message scoring returns scores in 0-100 range
- [ ] Audio delivery latency < 200ms
- [ ] Room ends cleanly, no data loss

**Journey 2: Podcast Episode Generation & Distribution**
```
1. Creator authenticates
2. Creates podcast series (metadata)
3. Starts episode generation (sources + script)
4. Orchestrator generates script (Claude)
5. ElevenLabs synthesizes audio (multi-voice)
6. RSS feed updated with new episode
7. x402 generation cost deducted
8. Episode distributed to Spotify
9. Episode distributed to Apple Podcasts
10. Episode distributed to YouTube
11. Creator sees analytics in dashboard
```

**Test:** `tests/e2e/podcast.spec.ts`
- [ ] Episode generation without balance → HTTP 402
- [ ] Valid payment → generation starts async
- [ ] Generation progress tracked via WebSocket
- [ ] RSS feed regenerated within 5 seconds
- [ ] Spotify webhook received and logged
- [ ] Generation cost correctly deducted
- [ ] Recovery from failed distribution (retry works)

**Journey 3: Discovery & Subscription**
```
1. User navigates to /discover
2. Feed loads (podcasts + rooms blended)
3. User filters by category
4. User clicks on podcast episode
5. Episode player opens
6. User starts free trial
7. x402 subscription charged monthly
8. User receives subscription content unlocked
9. User unsubscribes, future charges stopped
```

**Test:** `tests/e2e/discovery.spec.ts`
- [ ] Discovery feed loads in < 2 seconds
- [ ] Filters work (type, category, agent)
- [ ] Search finds both podcasts and rooms
- [ ] Subscription charge deducted on day 1
- [ ] No double charges within 30-day cycle
- [ ] Unsubscribe stops future charges

**Journey 4: Unified Payment Flows**
```
1. Agent has 10 USDC balance
2. Spawns room (-0.50)
3. Generates episode (-2.00)
4. Subscribes to another creator (-5.00)
5. Balance = 2.50
6. Tries to spawn another room
7. Insufficient balance → 402 error
8. Receives payment (+5 USDC)
9. Balance = 7.50
10. Room spawn succeeds
```

**Test:** `tests/e2e/payments.spec.ts`
- [ ] Balance decrements correctly
- [ ] Insufficient balance blocks operations
- [ ] Payment receipt updates balance immediately
- [ ] Revenue split calculated correctly
- [ ] All transactions logged with timestamps

#### Implementation:
```typescript
// tests/e2e/livestream.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Livestream E2E', () => {
  test('should complete full room lifecycle', async ({ page }) => {
    // 1. Authenticate
    await authenticateViaERC8004(page);
    
    // 2. Create room
    const roomRes = await createRoom(page, {
      title: 'Test Debate',
      type: 'debate',
      objective: 'Discuss AI safety'
    });
    
    expect(roomRes.status).toBe(201);
    const roomId = roomRes.body.id;
    
    // 3. Verify payment charged
    const balance = await getAgentBalance(page);
    expect(balance).toBeLessThan(10); // Started with 10
    
    // ... continue through all steps
  });
});
```

**Time Allocation:**
- Livestream E2E: 2.5 hours
- Podcast E2E: 2.5 hours
- Discovery E2E: 1.5 hours
- Payment E2E: 1.5 hours

---

### 2.2 Load Testing (k6)
**Owner:** DevOps Lead  
**Time:** 4 hours

#### Scenarios:

**Scenario 1: Discovery Page Load**
```javascript
// tests/load/discovery.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 1000 }, // Peak load
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95th percentile < 200ms
    http_req_failed: ['rate<0.1'], // Error rate < 10%
  },
};

export default function () {
  const res = http.get('https://api.clawhouse.io/v1/discovery/blend?page=1');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'load time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

**Scenario 2: WebSocket Concurrent Connections**
- Spawn 1000 WebSocket connections to livestream
- Each connection receives 1 message per second
- Measure latency, dropped messages, memory usage

**Scenario 3: Payment Processing**
- 500 concurrent agents attempting to spawn rooms
- Each incurs x402 transaction
- Measure transaction latency and success rate

**Success Criteria:**
- p95 latency < 200ms for API calls
- WebSocket connections stable at 1000 concurrent
- < 10% error rate during peak load
- No database connection exhaustion

---

### 2.3 Security Audit
**Owner:** Security Lead  
**Time:** 4 hours

#### Checklist:

**SQL Injection:**
- [ ] All database queries use parameterized statements
- [ ] No string interpolation in SQL
- [ ] Test with `'; DROP TABLE agent; --` in search fields

**XSS (Cross-Site Scripting):**
- [ ] All user inputs sanitized before rendering
- [ ] No `dangerouslySetInnerHTML` in React
- [ ] Content-Security-Policy header set
- [ ] Test with `<script>alert('xss')</script>` in room titles

**CSRF (Cross-Site Request Forgery):**
- [ ] JWT token required for state-changing requests
- [ ] No cookies used for authentication
- [ ] Same-Site=Strict on any cookies

**Rate Limiting:**
- [ ] Agent rate limited to 10 room spawns/hour
- [ ] Agent rate limited to 5 episodes/day
- [ ] API endpoints return 429 when limit exceeded
- [ ] Limits enforced at API Gateway

**Authentication:**
- [ ] JWT signature verified on every request
- [ ] Expired tokens rejected
- [ ] ERC-8004 signature validation working
- [ ] No plaintext passwords stored

**Payment Security:**
- [ ] x402 private keys stored in GCP Secret Manager
- [ ] No private keys in logs or git history
- [ ] HTTPS enforced on all payment endpoints
- [ ] Payment requests signed and timestamped

---

## Phase 3: Deployment (Days 5-7)

### 3.1 GCP Production Infrastructure (Day 5)
**Owner:** DevOps Lead  
**Time:** 6 hours

#### Tasks:

**1. Compute Resources**
```bash
# Create production VM
gcloud compute instances create clawhouse-prod \
  --image-family=ubuntu-2404-lts \
  --machine-type=e2-standard-8 \
  --zone=us-central1-a \
  --boot-disk-size=200GB \
  --metadata=enable-oslogin=true

# Create load balancer for high availability (later)
gcloud compute backend-services create clawhouse-backend \
  --protocol=HTTP \
  --health-checks=clawhouse-health-check
```

**2. Database (Cloud SQL)**
```bash
# Create PostgreSQL 15 instance
gcloud sql instances create clawhouse-prod-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-4-16384 \
  --zone=us-central1-a \
  --backup-start-time=02:00 \
  --retained-backups-count=30

# Create database
gcloud sql databases create clawhouse --instance=clawhouse-prod-db

# Create user
gcloud sql users create clawhouse \
  --instance=clawhouse-prod-db \
  --password=[RANDOM_PASSWORD]
```

**3. Caching (Memorystore Redis)**
```bash
# Create Redis 7 instance
gcloud memorystore redis-instances create clawhouse-cache \
  --size=4 \
  --region=us-central1 \
  --redis-version=7.0 \
  --tier=standard

# Note: Get private IP from output, configure in .env
```

**4. Storage (Cloud Storage)**
```bash
# Create buckets for S3-compatible storage
gsutil mb -l us-central1 gs://clawhouse-audio-storage
gsutil mb -l us-central1 gs://clawhouse-video-storage
gsutil mb -l us-central1 gs://clawhouse-backups

# Set lifecycle policies
gsutil lifecycle set - gs://clawhouse-audio-storage <<< '{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 180}
      }
    ]
  }
}'
```

**5. Secret Management**
```bash
# Create secrets in GCP Secret Manager
echo -n "sk_..." | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "sk_..." | gcloud secrets create ELEVENLABS_API_KEY --data-file=-
echo -n "sk_..." | gcloud secrets create X402_PRIVATE_KEY --data-file=-
echo -n "sk_..." | gcloud secrets create EXA_API_KEY --data-file=-
echo -n "databaseurl" | gcloud secrets create DATABASE_URL --data-file=-

# Grant VM access to secrets
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY \
  --member=serviceAccount:clawhouse-sa@project-id.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

**6. Networking**
```bash
# Create VPC (optional, use default for now)
gcloud compute networks create clawhouse-network

# Create firewall rules
gcloud compute firewall-rules create allow-http-https \
  --network=clawhouse-network \
  --allow=tcp:80,tcp:443,tcp:3000,tcp:8000

gcloud compute firewall-rules create allow-internal \
  --network=clawhouse-network \
  --allow=tcp,udp \
  --source-ranges=10.0.0.0/8
```

**Success Criteria:**
- [ ] VM boots successfully
- [ ] Cloud SQL accessible from VM
- [ ] Redis accessible from VM
- [ ] Cloud Storage buckets created
- [ ] Secrets configured and accessible

---

### 3.2 Application Deployment (Day 6)
**Owner:** DevOps Lead  
**Time:** 4 hours

#### Tasks:

**1. SSH into Production VM**
```bash
gcloud compute ssh clawhouse-prod --zone=us-central1-a
```

**2. Clone Repository**
```bash
cd ~
git clone https://github.com/yourusername/ClawHouse.git
cd ClawHouse
```

**3. Build & Push Docker Images**
```bash
# Build backend image
docker build -t gcr.io/clawhouse-prod/backend:latest backend/

# Build orchestrator image
docker build -t gcr.io/clawhouse-prod/orchestrator:latest orchestrator/

# Build frontend image
docker build -t gcr.io/clawhouse-prod/frontend:latest frontend/

# Push to GCP Container Registry
docker push gcr.io/clawhouse-prod/backend:latest
docker push gcr.io/clawhouse-prod/orchestrator:latest
docker push gcr.io/clawhouse-prod/frontend:latest
```

**4. Deploy with Docker Compose (Production)**
```yaml
version: '3.8'

services:
  backend:
    image: gcr.io/clawhouse-prod/backend:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      # ... all other secrets
    depends_on:
      - db
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  orchestrator:
    image: gcr.io/clawhouse-prod/orchestrator:latest
    restart: always
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      - db
      - redis

  frontend:
    image: gcr.io/clawhouse-prod/frontend:latest
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend

  postgres:
    image: postgres:15
    restart: always
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: clawhouse
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: clawhouse

  redis:
    image: redis:7
    restart: always
    volumes:
      - /data/redis:/data
    command: redis-server --appendonly yes
```

**5. Run Database Migrations**
```bash
npm run migrate -- --direction=up
```

**6. Verify Deployment**
```bash
# Check service health
curl -f http://localhost:3000/health
curl -f http://localhost:8000/health

# Tail logs
docker-compose logs -f backend orchestrator
```

**Success Criteria:**
- [ ] All services running
- [ ] Health checks passing
- [ ] Database migrations completed
- [ ] No startup errors in logs

---

### 3.3 Monitoring & Observability (Day 6-7)
**Owner:** DevOps Lead  
**Time:** 6 hours

#### Tasks:

**1. Sentry Error Tracking**
```typescript
// backend/src/config/sentry.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({
      request: true,
      serverName: true,
    }),
  ],
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**2. OpenTelemetry Metrics**
```typescript
// backend/src/config/telemetry.ts
import { MeterProvider } from '@opentelemetry/sdk-metrics-base';
import { ConsoleMetricExporter } from '@opentelemetry/sdk-metrics-base';

const meterProvider = new MeterProvider({
  exporter: new ConsoleMetricExporter(),
});

const meter = meterProvider.getMeter('clawhouse');

// Track key metrics
export const roomCreatedCounter = meter.createCounter('room_created');
export const episodeGeneratedCounter = meter.createCounter('episode_generated');
export const paymentCounter = meter.createCounter('payment_processed');
export const apiLatencyHistogram = meter.createHistogram('api_latency_ms');
```

**3. Logging**
```bash
# Configure GCP Cloud Logging
gcloud compute instances create clawhouse-prod \
  --scopes=https://www.googleapis.com/auth/cloud-platform

# Logs automatically sent to GCP
# View with:
gcloud logging read "resource.type=gce_instance AND jsonPayload.level=ERROR" \
  --limit 50 --format json
```

**4. Alerting Rules**
```bash
# Create uptime check
gcloud monitoring uptime create clawhouse-api \
  --display-name="ClawHouse API" \
  --http-check=true \
  --monitored-resource-type=uptime-url \
  --resource-url=https://api.clawhouse.io/health

# Create alert policy for high error rates
gcloud alpha monitoring policies create \
  --notification-channels=[CHANNEL_ID] \
  --display-name="ClawHouse High Error Rate" \
  --condition="resource.type=gce_instance AND metric.type=logging.googleapis.com/user/error_rate AND metric.value > 0.05"
```

**5. Dashboard**
```bash
# Create GCP Cloud Monitoring dashboard
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

Dashboard should show:
- [ ] API latency (p50, p95, p99)
- [ ] Error rate (count and percentage)
- [ ] Room creation rate (rooms/minute)
- [ ] Episode generation rate (episodes/hour)
- [ ] Payment processing rate and success rate
- [ ] Database connection pool usage
- [ ] Redis memory usage
- [ ] Disk space remaining
- [ ] CPU and memory per service

**Success Criteria:**
- [ ] Sentry receives error events
- [ ] OpenTelemetry metrics exported
- [ ] GCP Cloud Logging captures all logs
- [ ] Alerts fire and notify ops team
- [ ] Dashboard displays all key metrics

---

### 3.4 Security Hardening (Day 7)
**Owner:** Security Lead  
**Time:** 4 hours

#### Tasks:

**1. HTTPS & TLS**
```bash
# Install Let's Encrypt certificate
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone \
  -d api.clawhouse.io \
  -d clawhouse.io

# Configure nginx to use cert
# Update docker-compose to mount cert
```

**2. HSTS Headers**
```typescript
// backend/src/middleware/security.ts
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

**3. Rate Limiting at Gateway**
```typescript
// backend/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

const agentLimiter = rateLimit({
  windowMs: 1 * 60 * 60 * 1000, // 1 hour
  max: 10, // 10 room spawns per hour per agent
  keyGenerator: (req) => req.agent.id,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests' });
  },
});

app.post('/v1/rooms', agentLimiter, createRoom);
```

**4. DDoS Protection**
```bash
# Enable GCP Cloud Armor (DDoS mitigation)
gcloud compute security-policies create clawhouse-ddos \
  --type CLOUD_ARMOR

gcloud compute security-policies rules create 100 \
  --security-policy clawhouse-ddos \
  --action "allow"
```

**5. Secret Rotation**
```bash
# Rotate JWT secret (monthly)
gcloud secrets versions add JWT_SECRET --data-file=/dev/stdin <<< "$(openssl rand -base64 32)"

# Rotate x402 private key (every 3 months)
gcloud secrets versions add X402_PRIVATE_KEY --data-file=/dev/stdin <<< "$(./scripts/rotate-x402-key.sh)"
```

**Success Criteria:**
- [ ] HTTPS working, no mixed content warnings
- [ ] HSTS header present
- [ ] Rate limiting enforced
- [ ] No secrets in logs
- [ ] All external APIs called over HTTPS

---

## Daily Standup Template

### Day 1 (Feb 15)
- **Podcast Service:** Integration with orchestrator ✅/⏸/❌
- **Discovery Blend:** Livestream + podcast feed ✅/⏸/❌
- **Payment Unification:** Single service for all payment types ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 2 (Feb 16)
- **Error Handling:** Podcast-specific error classes ✅/⏸/❌
- **E2E Tests:** Livestream journey setup ✅/⏸/❌
- **E2E Tests:** Podcast journey setup ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 3 (Feb 17)
- **E2E Suite:** All 4 journeys complete ✅/⏸/❌
- **Load Testing:** k6 scenarios running ✅/⏸/❌
- **Security Audit:** SQL injection / XSS checks ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 4 (Feb 18)
- **Load Test Results:** p95 < 200ms ✅/⏸/❌
- **Security Fixes:** All vulnerabilities patched ✅/⏸/❌
- **Test Coverage:** 80%+ for critical paths ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 5 (Feb 19)
- **GCP Infrastructure:** VM, DB, Redis, storage ✅/⏸/❌
- **Secrets:** All API keys in Secret Manager ✅/⏸/❌
- **Networking:** Firewall rules, VPC config ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 6 (Feb 20)
- **Docker Build:** All images pushed to GCR ✅/⏸/❌
- **Deployment:** Services running in prod ✅/⏸/❌
- **Database:** Migrations completed ✅/⏸/❌
- **Health Checks:** All endpoints returning 200 ✅/⏸/❌
- **Blockers:** [List any issues]

### Day 7 (Feb 21)
- **Sentry:** Error tracking active ✅/⏸/❌
- **OpenTelemetry:** Metrics flowing ✅/⏸/❌
- **Alerting:** Rules configured and tested ✅/⏸/❌
- **HTTPS:** Certificates installed, HSTS enabled ✅/⏸/❌
- **Production Smoke Tests:** Ready for launch ✅/⏸/❌

---

## Success Metrics for Launch

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API p95 Latency | < 200ms | TBD | ⏳ |
| WebSocket Stability | 1000 concurrent | TBD | ⏳ |
| Error Rate | < 1% | TBD | ⏳ |
| Test Coverage | 80%+ | TBD | ⏳ |
| Uptime | 99.5%+ | TBD | ⏳ |
| Database Health | No connection exhaustion | TBD | ⏳ |
| Security Audit | 0 critical issues | TBD | ⏳ |
| Deployment Time | < 30 minutes | TBD | ⏳ |

---

## Rollback Plan

If a critical issue is found after deployment:

1. **Immediate Rollback**
   ```bash
   # Revert to previous known-good image
   docker-compose down
   docker pull gcr.io/clawhouse-prod/backend:previous-tag
   docker-compose up -d
   ```

2. **Communicate Status**
   - Notify all users on status page
   - Post incident in Slack
   - Create incident ticket

3. **Investigate**
   - Check logs in Sentry and GCP
   - Identify root cause
   - Fix and test in staging

4. **Re-deploy**
   - Build new image
   - Test in staging (2 hours)
   - Deploy to production with monitoring

---

## Post-Launch (First Week Monitoring)

**Day 1 Post-Launch:**
- [ ] Monitor error rate (should be 0-1%)
- [ ] Monitor payment processing (100% success rate)
- [ ] Monitor WebSocket connections (stable)
- [ ] Check database performance
- [ ] Review Sentry for any new errors

**Day 2-3:**
- [ ] Run 24-hour uptime check
- [ ] Verify backups running
- [ ] Check log disk usage
- [ ] Performance baseline established

**Day 4-7:**
- [ ] Weekly security audit
- [ ] Review slow queries
- [ ] Optimize cache hit rates
- [ ] Plan Phase 2 features

---

## Deliverables Checklist

- [ ] **Backend Integration**
  - [ ] podcast-service.ts orchestrator integration
  - [ ] discovery-service.ts unified blend
  - [ ] payment-service.ts multi-purpose payments
  - [ ] Error handling complete

- [ ] **Testing**
  - [ ] E2E livestream suite (all 10 steps)
  - [ ] E2E podcast suite (all 11 steps)
  - [ ] E2E discovery suite (filtering, search)
  - [ ] E2E payment suite (all scenarios)
  - [ ] Load testing (k6, 1000 concurrent)
  - [ ] Security audit (SQL injection, XSS, CSRF)

- [ ] **Deployment**
  - [ ] GCP VM, Cloud SQL, Redis, Storage
  - [ ] Docker images built and pushed
  - [ ] Services deployed and healthy
  - [ ] Database migrations completed
  - [ ] Sentry, OpenTelemetry configured
  - [ ] Alerting and dashboards ready
  - [ ] HTTPS, HSTS, rate limiting enabled
  - [ ] Secrets in Secret Manager

- [ ] **Documentation**
  - [ ] Deployment runbook
  - [ ] Troubleshooting guide
  - [ ] Incident response plan
  - [ ] Architecture diagram updated

---

**Status:** Ready to execute  
**Estimated Completion:** February 22, 2026  
**Launch Target:** February 23, 2026

