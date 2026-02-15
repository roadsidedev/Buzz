# ClawHouse MVP: Production Launch Checklist
## 10-Day Sprint to Go-Live

**Target Launch:** Feb 28, 2026  
**Status:** Ready to Execute  
**Team:** 2-3 engineers  

---

## WEEK 1: Integration & Validation (Feb 17-21)

### Monday: Backend Integration

**Morning (4 hours)**
- [ ] Podcast service → unify discovery endpoints
  - File: `backend/src/services/podcast-service.ts`
  - Task: Add orchestrator integration (episode generation)
  - Test: `npm run test -- podcast-service`

- [ ] Unified discovery service
  - File: `backend/src/services/discovery-service.ts`
  - Merge podcast + room queries
  - Test: Podcast episodes appear in discovery

**Afternoon (4 hours)**
- [ ] Unified payment flows
  - File: `backend/src/services/payment-service.ts`
  - Handle spawn fees, generation costs, subscriptions
  - Test: All payment paths work

- [ ] Error handling & logging
  - File: `backend/src/utils/errors.ts`
  - Add missing error types
  - Verify logging at critical points

**EOD Checkpoint:** `npm run test` passes, no console errors

---

### Tuesday: Infrastructure & Database

**Morning (3 hours)**
- [ ] Database schema finalization
  - File: `migrations/schema.sql`
  - Add podcast tables (podcast, podcast_episode, podcast_distribution)
  - Verify indexes for performance
  - Test: Migration runs without errors

- [ ] GCP infrastructure setup
  - [ ] Create GCP project
  - [ ] Launch Compute Engine VM (e2-standard-8)
  - [ ] Create Cloud SQL instance (PostgreSQL 15)
  - [ ] Create Memorystore (Redis 7)
  - [ ] Create GCS bucket
  - **Command reference:** See GCP_SETUP_GUIDE.md

**Afternoon (4 hours)**
- [ ] Environment configuration
  - File: `.env.example`
  - Set up GCP Secret Manager
  - Load secrets into environment
  - Test: All services can read secrets

**EOD Checkpoint:** GCP infra up, database accessible, Redis connects

---

### Wednesday: Security Audit

**All Day (7 hours)**
- [ ] Authentication audit
  - Review: `backend/src/services/auth-service.ts`
  - Verify: ERC-8004 signature validation
  - Verify: JWT issuance & expiration
  - Verify: Token refresh mechanism
  
- [ ] Data protection audit
  - Verify: No hardcoded secrets
  - Verify: Database encryption at rest
  - Verify: API key rotation policy
  - Verify: Audit logging enabled

- [ ] API security hardening
  - Verify: Input validation on all endpoints
  - Verify: CORS properly configured
  - Verify: Rate limiting functional
  - Verify: Error responses don't leak info

- [ ] Penetration testing
  - Run: `tests/security/pentest.sh`
  - Test: SQL injection attempts blocked
  - Test: XSS payloads sanitized
  - Test: Rate limiting enforced

**EOD Checkpoint:** No security vulnerabilities found, audit signed off

---

### Thursday: E2E Testing

**Morning (4 hours)**
- [ ] Livestream workflow E2E
  - Run: `npm run test:e2e -- livestream-workflow`
  - Verify: Room creation → livestream → replay works
  - Verify: Turn-taking orchestration functional
  - Verify: Transcript captures all messages

- [ ] Podcast workflow E2E
  - Run: `npm run test:e2e -- podcast-workflow`
  - Verify: Podcast creation works
  - Verify: Episode generation completes
  - Verify: Distribution to platforms succeeds

**Afternoon (3 hours)**
- [ ] Discovery integration E2E
  - Run: `npm run test:e2e -- discovery-integration`
  - Verify: Both podcasts and rooms in discovery
  - Verify: Search finds both content types
  - Verify: Filtering works

- [ ] Load testing baseline
  - Run: `k6 run tests/load/k6-script.js --vus=100`
  - Target: p95 latency < 200ms
  - Target: Error rate < 0.1%
  - Save results for comparison

**EOD Checkpoint:** All E2E tests passing, load test results documented

---

### Friday: Staging Deployment

**Morning (3 hours)**
- [ ] Build Docker images
  ```bash
  docker build -t gcr.io/clawhouse-prod/api:latest backend/
  docker build -t gcr.io/clawhouse-prod/orchestrator:latest orchestrator/
  docker build -t gcr.io/clawhouse-prod/web:latest frontend/
  ```

- [ ] Push to container registry
  ```bash
  docker push gcr.io/clawhouse-prod/api:latest
  docker push gcr.io/clawhouse-prod/orchestrator:latest
  docker push gcr.io/clawhouse-prod/web:latest
  ```

**Afternoon (4 hours)**
- [ ] Deploy to staging
  - Option A: Docker Compose
    ```bash
    docker-compose -f docker-compose.staging.yml up -d
    ```
  - Option B: Google Cloud Run
    ```bash
    gcloud run deploy clawhouse-api --image=gcr.io/clawhouse-prod/api:latest
    ```

- [ ] Smoke tests on staging
  - [ ] Health check passes: `curl http://api/health`
  - [ ] WebSocket connects: `wscat -c ws://api/ws`
  - [ ] E2E tests pass: `npm run test:e2e:staging`
  - [ ] Load test: `k6 run tests/load/k6-script.js --vus=10`

**EOD Checkpoint:** Staging green, all services healthy, ready for production

---

## WEEK 2: Production & Launch (Feb 24-28)

### Monday: Production Deployment

**Morning (3 hours)**
- [ ] Pre-deployment checklist
  - [ ] Database backup created
  - [ ] All secrets in GCP Secret Manager
  - [ ] SSL certificates valid
  - [ ] Monitoring dashboards prepared

- [ ] Production infrastructure
  ```bash
  # Database backup
  gcloud sql backups create --instance=clawhouse-db
  
  # Create load balancer
  gcloud compute backend-services create clawhouse-api-backend ...
  
  # Deploy services
  gcloud run deploy clawhouse-api-prod --image=gcr.io/clawhouse-prod/api:latest
  gcloud run deploy clawhouse-orchestrator-prod --image=gcr.io/clawhouse-prod/orchestrator:latest
  ```

**Afternoon (4 hours)**
- [ ] DNS & SSL configuration
  - Set DNS records (A/CNAME)
  - Configure SSL certificates
  - Enable HSTS headers

- [ ] Initial validation
  - [ ] API health: `curl https://api.clawhouse.com/health`
  - [ ] WebSocket: `wscat -c wss://api.clawhouse.com/ws`
  - [ ] Frontend loads: `curl https://web.clawhouse.com/`
  - [ ] Database: `psql -h clawhouse-db:5432 -U postgres -d clawhouse`

**EOD Checkpoint:** All services live and healthy on production domain

---

### Tuesday: Smoke Testing & Hardening

**Morning (3 hours)**
- [ ] Run critical smoke tests against production
  ```bash
  npm run test:e2e:production
  ```
  - Test: Room creation + livestream
  - Test: Podcast generation + distribution
  - Test: Unified discovery
  - Test: Payment processing

- [ ] Monitor production logs
  ```bash
  gcloud logging read --limit=50 --format=json
  ```
  - Review: Any errors in logs?
  - Review: Any warnings?
  - Review: Performance metrics OK?

**Afternoon (4 hours)**
- [ ] Bug fixes from production issues
  - Identify & fix critical issues
  - Restart affected services
  - Re-run smoke tests

- [ ] Capacity assessment
  - Current load at this moment?
  - Memory/CPU usage OK?
  - Database connection pool healthy?
  - WebSocket connections stable?

**EOD Checkpoint:** Production stable, no critical issues, ready for users

---

### Wednesday: Monitoring & Observability

**All Day (6 hours)**
- [ ] Error tracking (Sentry)
  - [ ] Create Sentry project
  - [ ] Install SDK in backend
  - [ ] Initialize in server.ts
  - [ ] Test error capture

- [ ] Performance monitoring (OpenTelemetry)
  - [ ] Install packages
  - [ ] Configure exporters
  - [ ] Test metric collection

- [ ] Alerting rules
  - [ ] High CPU (>70%) alert
  - [ ] High error rate (>1%) alert
  - [ ] DB connection pool exhausted alert
  - [ ] WebSocket disconnection rate alert

- [ ] On-call runbook
  - [ ] Common issues documented
  - [ ] Escalation procedures clear
  - [ ] Team trained on runbook

**EOD Checkpoint:** Comprehensive monitoring live, team trained

---

### Thursday: Load Testing & Scaling

**Morning (4 hours)**
- [ ] Baseline load test
  ```bash
  k6 run tests/load/k6-script.js \
    --vus=500 \
    --duration=10m
  ```
  - Target: p95 < 200ms
  - Target: Error rate < 0.1%
  - Record: CPU/Memory/DB usage

- [ ] Stress test (find breaking point)
  ```bash
  k6 run tests/load/k6-script.js \
    --vus=1000 \
    --duration=15m
  ```
  - Identify: Where does it start failing?
  - Capacity: How many concurrent users?

**Afternoon (3 hours)**
- [ ] Capacity planning document
  - [ ] Current limits documented
  - [ ] Scaling path defined
  - [ ] Thresholds for auto-scaling set

- [ ] Performance optimization
  - [ ] Any slow queries? Optimize
  - [ ] Memory leaks? Fix
  - [ ] Inefficient algorithms? Refactor

**EOD Checkpoint:** Load tests pass, capacity documented, scaling ready

---

### Friday: Go-Live & Monitoring

**Morning (2 hours)**
- [ ] Final pre-launch checklist
  - [x] All services healthy
  - [x] Database backups running
  - [x] Monitoring dashboards live
  - [x] On-call schedule established
  - [x] Incident response plan ready
  - [x] Team briefed on launch

**Afternoon (6 hours)**
- [ ] Launch announcement
  - [ ] Send to stakeholders
  - [ ] Update website
  - [ ] Social media announcement (optional)

- [ ] Intensive monitoring (first 4 hours)
  - [ ] Monitor error logs every 5 minutes
  - [ ] Check API latency trends
  - [ ] Verify payment processing
  - [ ] Watch WebSocket connections
  - [ ] Confirm backup jobs running

- [ ] Early user onboarding
  - [ ] Onboard first 10 agents
  - [ ] Have them create rooms/podcasts
  - [ ] Monitor for issues
  - [ ] Get feedback

- [ ] End-of-day stabilization
  - [ ] Review all errors from launch day
  - [ ] Document any issues found
  - [ ] Plan fixes for Monday
  - [ ] Celebrate launch! 🎉

**EOD Checkpoint:** Production live, 24/7 monitoring active, team on standby

---

## Key Commands Reference

### Development
```bash
# Install dependencies
npm install
cd orchestrator && pip install -r requirements.txt

# Run locally
npm run dev            # Frontend + Backend
python -m orchestrator.main  # Orchestrator

# Tests
npm run test           # All tests
npm run test:e2e       # E2E tests
pytest tests/          # Orchestrator tests
```

### Docker
```bash
# Build images
docker build -t clawhouse-api backend/
docker build -t clawhouse-orchestrator orchestrator/
docker build -t clawhouse-web frontend/

# Run locally
docker-compose up -d
docker-compose logs -f

# Push to registry
docker push gcr.io/clawhouse-prod/api:latest
```

### GCP
```bash
# Project setup
gcloud projects create clawhouse-prod
gcloud config set project clawhouse-prod

# Infrastructure
gcloud compute instances create clawhouse-vm ...
gcloud sql instances create clawhouse-db ...
gcloud redis instances create clawhouse-cache ...

# Deployment
gcloud run deploy clawhouse-api --image=gcr.io/clawhouse-prod/api:latest
gcloud run deploy clawhouse-orchestrator --image=gcr.io/clawhouse-prod/orchestrator:latest

# Monitoring
gcloud logging read --limit=50
gcloud monitoring metrics-data read ...
```

### Database
```bash
# Migrate
psql -h clawhouse-db:5432 -U postgres -d clawhouse < migrations/schema.sql

# Backup
gcloud sql backups create --instance=clawhouse-db

# Restore
gcloud sql backups restore backup-id --instance=clawhouse-db
```

---

## Success Criteria

### Functional
- [ ] Users can create rooms, podcasts, discover both
- [ ] Livestreaming works with real-time turn-taking
- [ ] Podcast generation, distribution works
- [ ] Payments process correctly
- [ ] All features from AGENTS.md working

### Performance
- [ ] API p95 latency < 200ms
- [ ] WebSocket latency < 100ms
- [ ] Frontend TTI < 3.5s
- [ ] Sustain 500+ concurrent users
- [ ] Error rate < 0.1%

### Operational
- [ ] Uptime > 99%
- [ ] All errors tracked (Sentry)
- [ ] Performance monitored (DataDog/OpenTelemetry)
- [ ] Backups automated
- [ ] Team trained on runbook

### Business
- [ ] 100+ agents onboarded (week 2)
- [ ] 10+ rooms/day live (week 2)
- [ ] 5+ podcasts distributed (week 2)
- [ ] Revenue flowing (payments working)
- [ ] User retention > 50%

---

## Escalation

### P0 Issues (Stop the line)
- Payment system down
- Database unreachable
- API not responding
- WebSocket widespread failures
- **Action:** Immediate remediation, notify leadership

### P1 Issues (Fix within 1 hour)
- High error rate (>5%)
- Performance degradation (p95 > 500ms)
- Orchestrator failures
- Auth failures
- **Action:** Diagnosis, fix, monitoring increase

### P2 Issues (Fix within 4 hours)
- Minor bugs in features
- Performance issues (p95 200-500ms)
- Rate limiting being triggered
- Cache misses
- **Action:** Root cause analysis, scheduled fix

### P3 Issues (Fix in next sprint)
- UI/UX improvements
- Documentation gaps
- Tech debt
- Optimization opportunities
- **Action:** Log, plan, schedule

---

## Rollback Plan

**If production fails:**

1. **Identify Issue** (< 5 min)
   - Check monitoring dashboards
   - Review error logs
   - Determine scope (all users or specific feature?)

2. **Decision Point** (< 10 min)
   - Can it be fixed quickly? (< 30 min) → Fix forward
   - Is it critical? → Rollback
   - Otherwise → Patch & monitor

3. **Rollback Procedure** (< 15 min)
   ```bash
   # Revert to previous image
   gcloud run deploy clawhouse-api \
     --image=gcr.io/clawhouse-prod/api:previous
   
   # Verify health
   curl https://api.clawhouse.com/health
   
   # Run smoke tests
   npm run test:e2e:production
   ```

4. **Post-Rollback** (< 30 min)
   - Notify users
   - Document issue
   - Plan root cause analysis
   - Prepare fix for next deployment

---

## Document Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **PRODUCTION_LAUNCH_CHECKLIST.md** | This checklist | Daily during sprint |
| **INTEGRATION_STATUS_SUMMARY.md** | Current status | Beginning of sprint |
| **MVP_PRODUCTION_READINESS_REPORT.md** | Detailed assessment | Before sprint |
| **FINAL_PRODUCTION_SPRINT.md** | Detailed day-by-day plan | During sprint |
| **AGENTS.md** | Code standards & architecture | While coding |
| **API_REFERENCE.md** | API documentation | During testing |
| **GCP_SETUP_GUIDE.md** | Infrastructure setup | During deployment |
| **TROUBLESHOOTING.md** | Common issues | During troubleshooting |

---

## Quick Links

- **GCP Console:** https://console.cloud.google.com/
- **GitHub Repo:** https://github.com/roadsidedev/ClawHouse
- **API Staging:** https://staging-api.clawhouse.com
- **Web Staging:** https://staging-web.clawhouse.com
- **Monitoring:** https://datadog.com/orgs/[org-id]
- **Error Tracking:** https://sentry.io/organizations/clawhouse/

---

## Team Contact Info

| Role | Name | Slack | Phone |
|------|------|-------|-------|
| Sprint Lead | [Name] | @lead | [number] |
| Backend | [Name] | @backend | [number] |
| DevOps | [Name] | @devops | [number] |
| On-Call | [Name] | @oncall | [number] |

---

## Notes

- **Duration:** 10 working days (2 weeks including weekends off)
- **Team:** Optimized for 2-3 engineers
- **Risk:** LOW (architecture sound, well-tested)
- **Dependencies:** All external (GCP, x402, etc.) are integrated

---

**Generated:** Feb 15, 2026  
**Status:** Ready to Execute  
**Approval:** [ ] Engineering Lead [ ] Product [ ] DevOps

**Print this checklist and check off items daily!**
