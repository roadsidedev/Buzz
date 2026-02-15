# ClawHouse Final Sprint: Task Assignment & Tracking

**Sprint Duration:** Feb 15-22, 2026 (7 days)  
**Team Size:** 4-5 engineers  
**Launch Date:** Feb 23, 2026

---

## Team Structure

### Team 1: Backend Integration (2 engineers)
**Responsibility:** Unify podcast + livestream backend services  
**Lead:** Backend Architect  
**Duration:** Days 1-2

### Team 2: Testing & QA (2 engineers)
**Responsibility:** E2E, load testing, security audit  
**Lead:** QA Lead  
**Duration:** Days 3-4

### Team 3: DevOps & Deployment (1-2 engineers)
**Responsibility:** GCP infrastructure, monitoring, hardening  
**Lead:** DevOps Lead  
**Duration:** Days 5-7

---

## Day-by-Day Task Breakdown

### **DAY 1 (Feb 15): Backend Integration Part 1**

#### Team 1: Podcast Service & Payment Unification

**Task 1.1: Podcast Service Orchestrator Integration**
- **Owner:** Backend Engineer #1
- **Estimated Time:** 4 hours
- **Acceptance Criteria:**
  - [ ] Episode generation calls orchestrator-client.ts
  - [ ] Generation status tracked (pending → processing → complete)
  - [ ] x402 cost deducted from agent balance before generation
  - [ ] Retry logic for failed orchestrator calls (max 3 retries)
  - [ ] All orchestrator responses logged with request ID
  
- **Code to Review:**
  ```
  backend/src/services/podcast-service.ts (lines 1-250)
  backend/src/services/orchestrator-client.ts
  backend/src/repositories/podcast-repository.ts
  ```

- **Definition of Done:**
  - Test: `curl -X POST http://localhost:3000/v1/podcasts/episodes -d '{"podcastId":"...", "sourceUrl":"..."}' -H "Authorization: Bearer $TOKEN"`
  - Response: `{ status: "pending", episodeId: "...", generationCost: 2.0 }`
  - Balance deducted: ✅
  - Can check status: `curl http://localhost:3000/v1/podcasts/episodes/{episodeId}`

**Task 1.2: Podcast Distribution Webhooks**
- **Owner:** Backend Engineer #2
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - [ ] Spotify webhook receiver implemented
  - [ ] Apple Podcasts webhook receiver implemented
  - [ ] YouTube distribution callback handler
  - [ ] All webhook events logged in `webhook_events` table
  - [ ] Retry logic for failed distributions
  - [ ] Webhook signature verification

- **Code to Create:**
  ```
  backend/src/routes/webhooks.ts (NEW)
  backend/src/repositories/webhook-event-repository.ts (NEW)
  ```

- **Definition of Done:**
  - [ ] POST `/v1/webhooks/spotify` accepts and stores events
  - [ ] POST `/v1/webhooks/apple` accepts and stores events
  - [ ] POST `/v1/webhooks/youtube` accepts and stores events
  - [ ] Simulated webhook curl works: `curl -X POST http://localhost:3000/v1/webhooks/spotify -d '{...}'`
  - [ ] Database contains webhook event record

**Task 1.3: Payment Service Unification**
- **Owner:** Backend Engineer #1 (after 1.1)
- **Estimated Time:** 4 hours
- **Acceptance Criteria:**
  - [ ] All payment types (spawn, generation, subscription, tip) use unified service
  - [ ] x402 integration handles multiple purposes
  - [ ] Insufficient balance returns HTTP 402
  - [ ] Revenue split calculated for all types
  - [ ] Transaction logged with payment_type field

- **Code to Review/Update:**
  ```
  backend/src/services/payment-service.ts
  backend/src/types/payment.ts
  backend/src/repositories/payment-repository.ts
  ```

- **Definition of Done:**
  - [ ] Spawn fee: `await paymentService.chargeSpawnFee(agentId, roomId)`
  - [ ] Episode cost: `await paymentService.chargeGenerationCost(agentId, podcastId, estimatedLength)`
  - [ ] Subscription: `await paymentService.chargeSubscription(agentId, creatorId, tier)`
  - [ ] All return same structure: `{ transactionId, amount, deducted: true }`
  - [ ] All logged in database

---

### **DAY 2 (Feb 16): Backend Integration Part 2**

#### Team 1: Discovery Service & Error Handling

**Task 2.1: Unified Discovery Feed**
- **Owner:** Backend Engineer #1
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - [ ] Discovery endpoint returns blended podcasts + rooms
  - [ ] Results sorted by relevance/trending
  - [ ] Pagination working (limit, offset)
  - [ ] Filters work (type, category, agent)
  - [ ] Cache hits reduce DB load by 80%
  - [ ] Cache invalidated when new content created

- **Endpoint:** `GET /v1/discovery/blend?page=1&type=all&category=debate&search=ai`
- **Response:**
  ```json
  {
    "items": [
      { "type": "room", "id": "...", "title": "...", "liveNow": true },
      { "type": "podcast", "id": "...", "title": "...", "latestEpisode": "..." }
    ],
    "total": 245,
    "page": 1,
    "hasMore": true
  }
  ```

- **Code to Review/Update:**
  ```
  backend/src/services/discovery-service.ts
  backend/src/services/cache-service.ts
  backend/src/routes/discovery.ts
  ```

- **Definition of Done:**
  - [ ] Test query: `curl 'http://localhost:3000/v1/discovery/blend'`
  - [ ] Response includes both podcasts and rooms
  - [ ] Filters work: `?type=podcast`, `?category=debate`
  - [ ] Cache working: 1st call takes 500ms, 2nd takes 20ms

**Task 2.2: Error Handling Enhancement**
- **Owner:** Backend Engineer #2
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] Podcast-specific error classes created
  - [ ] All services throw structured errors
  - [ ] Error includes code, message, statusCode, context
  - [ ] Request IDs tracked in all logs
  - [ ] Error responses consistent across API

- **Error Classes to Create:**
  ```typescript
  export class EpisodeGenerationError extends AppError
  export class DistributionError extends AppError
  export class SubscriptionError extends AppError
  export class OrchestratorError extends AppError
  export class InsufficientBalanceError extends AppError
  ```

- **Code to Update:**
  ```
  backend/src/utils/errors.ts
  backend/src/middleware/error-handler.ts
  ```

- **Definition of Done:**
  - [ ] Error response format: `{ error: { code: "...", message: "...", context: {...} } }`
  - [ ] All 4xx and 5xx responses include error code
  - [ ] Logs include request ID in every entry
  - [ ] Example: `logger.error("Generation failed", { requestId, episodeId, code: "ORCH_TIMEOUT" })`

**Task 2.3: Integration Testing**
- **Owner:** Backend Engineer #1 (after 2.1)
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] Integration tests for podcast → orchestrator → payment flow
  - [ ] Integration tests for discovery blending
  - [ ] All tests pass locally
  - [ ] No breaking changes to existing tests

- **Tests to Create/Update:**
  ```
  backend/tests/integration/podcast-flow.test.ts (NEW)
  backend/tests/integration/discovery.test.ts
  backend/tests/integration/payment-unification.test.ts (NEW)
  ```

- **Definition of Done:**
  - [ ] `npm run test:integration` passes all tests
  - [ ] Coverage for critical paths > 80%

---

### **DAY 3 (Feb 17): Testing & Validation Part 1**

#### Team 2: E2E Test Suite

**Task 3.1: Livestream E2E Tests**
- **Owner:** QA Engineer #1
- **Estimated Time:** 4 hours
- **Acceptance Criteria:**
  - [ ] Full room lifecycle tested (create → join → end → replay)
  - [ ] Turn-taking orchestration works end-to-end
  - [ ] Audio latency measured and logged
  - [ ] Transcript generation verified
  - [ ] Payment flow validated
  - [ ] Room cleanup completed

- **Test File:** `tests/e2e/livestream.spec.ts`
- **Steps:**
  1. Authenticate via ERC-8004
  2. Create room (spawn fee deducted)
  3. Join as participant
  4. Send messages
  5. Wait for orchestrator scoring
  6. Verify best message selected
  7. Check audio synthesis
  8. End room
  9. Verify replay in S3
  10. Check revenue split

- **Definition of Done:**
  - [ ] Test runs successfully: `npm run test:e2e -- livestream.spec.ts`
  - [ ] All 10 steps pass
  - [ ] No flaky assertions
  - [ ] Logs show latency metrics

**Task 3.2: Podcast E2E Tests**
- **Owner:** QA Engineer #2
- **Estimated Time:** 4 hours
- **Acceptance Criteria:**
  - [ ] Full episode generation tested
  - [ ] Multi-voice synthesis verified
  - [ ] RSS feed updated
  - [ ] Distribution webhooks triggered
  - [ ] Payment deducted and logged
  - [ ] Subscription functionality tested

- **Test File:** `tests/e2e/podcast.spec.ts`
- **Steps:**
  1. Create podcast series
  2. Initiate episode generation
  3. Monitor generation progress via WebSocket
  4. Verify script generation
  5. Verify audio synthesis
  6. Check RSS regeneration
  7. Trigger Spotify distribution
  8. Verify webhook received
  9. Check creator payment
  10. Verify subscriber access
  11. Test unsubscribe

- **Definition of Done:**
  - [ ] Test runs successfully: `npm run test:e2e -- podcast.spec.ts`
  - [ ] All 11 steps pass
  - [ ] Distribution webhooks simulated correctly
  - [ ] Logs show generation timeline

---

### **DAY 4 (Feb 18): Testing & Validation Part 2**

#### Team 2: Load Testing & Security

**Task 4.1: Load Testing (k6)**
- **Owner:** QA Engineer #1
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - [ ] Discovery page handles 1000 concurrent users
  - [ ] WebSocket connections stable at 1000 concurrent
  - [ ] Payment processing under load (500 concurrent)
  - [ ] p95 latency < 200ms
  - [ ] Error rate < 1%
  - [ ] No database connection exhaustion

- **Test Files:**
  ```
  tests/load/discovery.js
  tests/load/websocket.js
  tests/load/payment.js
  ```

- **Run Tests:**
  ```bash
  k6 run tests/load/discovery.js
  k6 run tests/load/websocket.js
  k6 run tests/load/payment.js
  ```

- **Definition of Done:**
  - [ ] All load tests pass
  - [ ] Results logged to `load-test-results.json`
  - [ ] No critical performance regressions
  - [ ] Database metrics healthy

**Task 4.2: Security Audit**
- **Owner:** QA Engineer #2
- **Estimated Time:** 4 hours
- **Acceptance Criteria:**
  - [ ] SQL injection tests: fail (safe)
  - [ ] XSS tests: fail (safe)
  - [ ] CSRF protection: verified
  - [ ] Rate limiting: working
  - [ ] Authentication: JWT verified
  - [ ] Secrets: not in logs or git
  - [ ] No critical vulnerabilities

- **Security Checklist:**
  ```
  [ ] SQL Injection: Test with '; DROP TABLE agent; --
  [ ] XSS: Test with <script>alert('xss')</script>
  [ ] CSRF: Verify no state changes without JWT
  [ ] Rate Limiting: Hit endpoint 11 times, expect 429
  [ ] Authentication: Expired token rejected
  [ ] ERC-8004: Invalid signature rejected
  [ ] Secrets: grep -r "sk_" . (should be empty)
  [ ] HTTPS: All external calls over HTTPS
  [ ] CORS: Verify appropriate restrictions
  [ ] Password: No plaintext passwords in DB
  ```

- **Definition of Done:**
  - [ ] Security audit checklist completed
  - [ ] All tests documented in `SECURITY_AUDIT.md`
  - [ ] No critical issues found
  - [ ] Any findings documented for remediation

---

### **DAY 5 (Feb 19): Deployment Part 1**

#### Team 3: GCP Infrastructure

**Task 5.1: GCP VM & Databases**
- **Owner:** DevOps Engineer
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - [ ] Compute Engine VM created (e2-standard-8)
  - [ ] Cloud SQL PostgreSQL 15 provisioned
  - [ ] Redis Memorystore created
  - [ ] Cloud Storage buckets created
  - [ ] Networking configured (firewall rules)
  - [ ] SSH access verified

- **GCP Commands:**
  ```bash
  # VM
  gcloud compute instances create clawhouse-prod ...
  
  # Database
  gcloud sql instances create clawhouse-prod-db ...
  gcloud sql databases create clawhouse ...
  
  # Cache
  gcloud memorystore redis-instances create clawhouse-cache ...
  
  # Storage
  gsutil mb gs://clawhouse-audio-storage
  gsutil mb gs://clawhouse-backups
  ```

- **Definition of Done:**
  - [ ] VM boots and is accessible via SSH
  - [ ] Cloud SQL accessible from VM
  - [ ] Redis accessible from VM
  - [ ] Storage buckets created and accessible
  - [ ] Firewall allows HTTP, HTTPS, SSH

**Task 5.2: Secret Management**
- **Owner:** DevOps Engineer
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] All API keys in GCP Secret Manager
  - [ ] VM has access to secrets
  - [ ] No secrets in environment files
  - [ ] Secret rotation enabled

- **Secrets to Create:**
  ```bash
  ANTHROPIC_API_KEY
  ELEVENLABS_API_KEY
  X402_PRIVATE_KEY
  EXA_API_KEY
  JWT_SECRET
  DATABASE_URL
  REDIS_URL
  ```

- **Definition of Done:**
  - [ ] All secrets in Secret Manager
  - [ ] VM service account can access all secrets
  - [ ] Test: `gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY`

---

### **DAY 6 (Feb 20): Deployment Part 2**

#### Team 3: Application Deployment

**Task 6.1: Docker Build & Push**
- **Owner:** DevOps Engineer
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] Backend image built and pushed to GCR
  - [ ] Orchestrator image built and pushed to GCR
  - [ ] Frontend image built and pushed to GCR
  - [ ] All images tagged with version
  - [ ] Images work when pulled from GCR

- **Build Commands:**
  ```bash
  docker build -t gcr.io/clawhouse-prod/backend:v1.0.0 backend/
  docker build -t gcr.io/clawhouse-prod/orchestrator:v1.0.0 orchestrator/
  docker build -t gcr.io/clawhouse-prod/frontend:v1.0.0 frontend/
  
  docker push gcr.io/clawhouse-prod/backend:v1.0.0
  docker push gcr.io/clawhouse-prod/orchestrator:v1.0.0
  docker push gcr.io/clawhouse-prod/frontend:v1.0.0
  ```

- **Definition of Done:**
  - [ ] All images appear in GCP Container Registry
  - [ ] Image sizes reasonable (backend < 500MB, frontend < 200MB)

**Task 6.2: Deployment & Health Checks**
- **Owner:** DevOps Engineer
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] Docker Compose deployed to VM
  - [ ] All services running
  - [ ] Health checks passing
  - [ ] Database migrations completed
  - [ ] Initial data loaded

- **Deployment Steps:**
  ```bash
  ssh clawhouse-prod
  cd ~/ClawHouse
  docker-compose -f docker-compose.prod.yml up -d
  npm run migrate -- --direction=up
  curl http://localhost:3000/health
  curl http://localhost:8000/health
  ```

- **Definition of Done:**
  - [ ] `docker ps` shows 3 services running (backend, orchestrator, frontend)
  - [ ] Health checks: `GET /health` returns `{ status: "ok" }`
  - [ ] Database migrations: All `up` migrations applied
  - [ ] Logs: No critical errors in docker-compose logs

**Task 6.3: Smoke Tests**
- **Owner:** DevOps Engineer
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] API responds to basic requests
  - [ ] Authentication works
  - [ ] Database queries working
  - [ ] External integrations reachable
  - [ ] No critical errors

- **Smoke Test Commands:**
  ```bash
  # Health check
  curl http://localhost:3000/health
  
  # Auth test
  curl -X POST http://localhost:3000/v1/auth/verify-signature \
    -d '{"signature":"...", "address":"0x..."}'
  
  # Discovery test
  curl http://localhost:3000/v1/discovery/blend
  
  # Room creation test (requires valid agent)
  curl -X POST http://localhost:3000/v1/rooms \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"title":"Test","type":"debate"}'
  ```

- **Definition of Done:**
  - [ ] All health checks pass
  - [ ] Authentication flow works
  - [ ] Discovery returns content
  - [ ] Room creation works (if test agent exists)
  - [ ] Logs show no critical errors

---

### **DAY 7 (Feb 21): Monitoring & Hardening**

#### Team 3: Observability & Security

**Task 7.1: Monitoring Setup**
- **Owner:** DevOps Engineer
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - [ ] Sentry configured for error tracking
  - [ ] OpenTelemetry metrics exported
  - [ ] GCP Cloud Logging active
  - [ ] Alerting rules configured
  - [ ] Dashboard created

- **Setup Steps:**
  ```bash
  # Sentry
  export SENTRY_DSN=...
  npm install --save @sentry/node
  
  # OpenTelemetry
  npm install @opentelemetry/sdk-metrics-base
  npm install @opentelemetry/sdk-metrics-node
  
  # GCP Logging (automatic if using gcloud)
  
  # Alerting
  gcloud monitoring policies create --config-from-file=alert-policy.json
  ```

- **Definition of Done:**
  - [ ] Sentry project created and receiving errors
  - [ ] OpenTelemetry metrics visible in console
  - [ ] GCP logs searchable via gcloud
  - [ ] At least 5 alert policies created
  - [ ] Dashboard shows key metrics

**Task 7.2: Security Hardening**
- **Owner:** DevOps Engineer
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] HTTPS/TLS configured
  - [ ] HSTS headers enabled
  - [ ] Rate limiting active
  - [ ] DDoS protection enabled (GCP Cloud Armor)
  - [ ] Secrets not in logs

- **Hardening Steps:**
  ```bash
  # HTTPS with Let's Encrypt
  sudo certbot certonly --standalone -d api.clawhouse.io
  
  # Update docker-compose to mount certificate
  
  # HSTS headers (in Express middleware)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  # Rate limiting (already configured in payment-service)
  
  # DDoS Protection (Cloud Armor)
  gcloud compute security-policies create clawhouse-ddos
  ```

- **Definition of Done:**
  - [ ] HTTPS works: `curl https://api.clawhouse.io/health`
  - [ ] HSTS header present: `curl -I https://api.clawhouse.io | grep Strict-Transport`
  - [ ] Rate limiting working: 11 requests in 1 second → 429 error
  - [ ] No plaintext secrets in logs

**Task 7.3: Final Pre-Launch Checklist**
- **Owner:** DevOps Engineer & Backend Lead
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - [ ] All services healthy
  - [ ] All tests passing
  - [ ] No critical errors in logs
  - [ ] Database backups running
  - [ ] Rollback plan documented
  - [ ] Team trained on incident response

- **Final Checklist:**
  ```
  [ ] docker ps shows 3 running services
  [ ] npm run test:unit passes
  [ ] npm run test:integration passes
  [ ] npm run test:e2e passes
  [ ] npm run test:load passes
  [ ] No SENTRY_ERROR events in last 2 hours
  [ ] Database backups scheduled
  [ ] Health endpoints respond 200
  [ ] HTTPS working end-to-end
  [ ] All team members on Slack incident channel
  [ ] Runbooks posted and reviewed
  ```

- **Definition of Done:**
  - [ ] Pre-launch checklist 100% complete
  - [ ] All team members sign off
  - [ ] Launch approval given

---

## Resource Requirements

### Tools & Access
- **GCP Account:** Project ID, billing enabled
- **Docker Registry:** GCP Container Registry access
- **Monitoring:** Sentry account, GCP monitoring enabled
- **CI/CD:** GitHub Actions configured
- **Notifications:** Slack, email for alerts

### Environment Variables Template
```bash
# Node.js Backend
NODE_ENV=production
JWT_SECRET=<from Secret Manager>
DATABASE_URL=<from Secret Manager>
REDIS_URL=<from Secret Manager>
ANTHROPIC_API_KEY=<from Secret Manager>
ELEVENLABS_API_KEY=<from Secret Manager>
EXA_API_KEY=<from Secret Manager>
X402_PRIVATE_KEY=<from Secret Manager>
SENTRY_DSN=https://...
S3_BUCKET=clawhouse-audio-storage

# Orchestrator (Python)
PYTHONPATH=/app
DATABASE_URL=<from Secret Manager>
REDIS_URL=<from Secret Manager>
ANTHROPIC_API_KEY=<from Secret Manager>
ELEVENLABS_API_KEY=<from Secret Manager>
```

---

## Communication Plan

### Daily Standup (9 AM)
- 15-minute sync
- Each team reports blockers
- Escalate issues immediately

### Code Review Process
- All PRs reviewed before merge
- At least 1 approval required
- Backend Lead approves backend changes
- DevOps Lead approves deployment changes

### Deployment Window
- **Target:** February 22, 2026, 4 PM UTC
- **Duration:** 30 minutes
- **Rollback Plan:** If any critical error, rollback in < 5 minutes

---

## Risk Management

| Risk | Mitigation | Owner |
|------|-----------|-------|
| Database migration fails | Test migrations in staging first | DevOps |
| Payment processing breaks | Verify x402 integration in staging | Backend |
| Load test reveals bottleneck | Have optimization plan ready | Backend |
| Security audit finds issue | Have patch ready, don't launch | Security |
| GCP infrastructure unavailable | Have backup provider ready | DevOps |
| Team member unavailable | Cross-training on all systems | Lead |

---

## Success Criteria for Launch

- [ ] **Functionality:** All 4 E2E journeys pass
- [ ] **Performance:** p95 < 200ms, WebSocket stable at 1000 concurrent
- [ ] **Reliability:** Error rate < 1%, 99%+ uptime in monitoring
- [ ] **Security:** 0 critical vulnerabilities, no secrets in logs
- [ ] **Testing:** 80%+ coverage, all tests passing
- [ ] **Deployment:** All services healthy, no startup errors
- [ ] **Monitoring:** Sentry, OpenTelemetry, alerting active
- [ ] **Documentation:** Runbooks, incident plans, architecture updated

**Go/No-Go Decision:** February 22, 2026, 3 PM UTC

---

**Next Steps:**
1. Assign engineers to teams
2. Schedule daily standups
3. Set up GitHub project board
4. Brief team on architecture and dependencies
5. Execute Day 1

