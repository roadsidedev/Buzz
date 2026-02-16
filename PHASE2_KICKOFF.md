# Phase 2: Core Functionality Kickoff
## Days 4-7: Payment, Verification, Caching & Orchestration

**Status:** 🟢 READY TO START  
**Timeline:** February 17-20, 2026 (4 days)  
**Effort:** 18 hours  
**Target Completion:** February 20, 2026  
**Phase 1 Status:** ✅ COMPLETE (9/10 security score)

---

## Phase 2 Overview

After securing the platform (Phase 1), Phase 2 implements the core business features:

### Day 4: Payment Integration (5 hours)
- Integrate x402 SDK for micropayments
- Implement spawn fee charging
- Track payment status
- Distribute revenue (50/40/10 split)
- Handle payment errors and webhooks

### Day 5: Agent Verification & Audio (5 hours)
- Verify agents via ERC-8004 onchain registry
- Implement Jam room creation
- Set up real-time audio streaming

### Day 6: Token Management & Caching (4 hours)
- Refresh token rotation strategy
- Discovery API caching (Redis)
- Frontend API integration

### Day 7: Orchestrator Improvements (4 hours)
- Batch message scoring
- Output contract evaluation
- Integration testing (all Phase 2)

---

## Day 4: Payment Integration

### Objectives
1. **7.1** Obtain and integrate x402 SDK (30m)
2. **7.2-7.3** Implement spawn fee charging and status tracking (2h)
3. **7.4** Implement revenue distribution (1.5h)
4. **7.5-7.6** Error handling and webhooks (1h)

### File Structure
```
backend/src/services/payment-service.ts          (ENHANCE)
backend/src/config/x402-config.ts               (NEW)
backend/src/repositories/payment-repository.ts  (ENHANCE)
backend/src/routes/webhook-routes.ts            (NEW)
backend/tests/payment-service.test.ts           (NEW)
```

### Key Implementations
```typescript
// x402 client initialization
const x402 = new X402Client(process.env.X402_API_KEY);

// Spawn fee charging
chargeSpawnFee(agentId, amount) → { txHash, status }

// Payment status tracking
checkPaymentStatus(paymentId) → 'pending' | 'confirmed' | 'failed'

// Revenue distribution (50/40/10 split)
distributeRevenue(roomId) → distributed to host/participants/platform

// Webhook handling
POST /api/v1/webhooks/payment → verify signature, update status
```

### Success Criteria
- [ ] x402 SDK integrated and configured
- [ ] Spawn fee charging works on testnet
- [ ] Payment status updates correctly
- [ ] Revenue distribution splits correctly
- [ ] Webhook handling validates signatures
- [ ] Error scenarios handled (insufficient funds, rate limits)
- [ ] All payment tests passing

---

## Environment Variables

### New for Phase 2
```bash
# x402 Payment System
X402_API_KEY=xxx
X402_SECRET_KEY=xxx
PLATFORM_WALLET=0x...
X402_WEBHOOK_SECRET=xxx

# ERC-8004 (Day 5)
ERC8004_CONTRACT_ADDRESS=0x...
ETH_RPC_URL=https://...
ETH_NETWORK=sepolia

# Jam Audio (Day 5)
JAM_API_KEY=xxx
JAM_ROOM_HOST=wss://jam.example.com
```

---

## Dependencies to Install

```bash
npm install @x402/sdk
npm install @x402/contracts
npm install viem
npm install ethers
```

---

## Phase 2 Timeline

| Day | Task | Effort | Status |
|-----|------|--------|--------|
| 4 | Payment Integration (x402) | 5h | Starting today 🟢 |
| 5 | ERC-8004 & Jam Integration | 5h | Week of Feb 18 |
| 6 | Token Refresh & Caching | 4h | Week of Feb 18 |
| 7 | Orchestrator Improvements | 4h | Week of Feb 19 |
| **Phase 2 Total** | | **18h** | |
| Phase 3 | Validation & Hardening | 9h | Week of Feb 21 |
| Phase 4 | Deployment (Staging/Prod) | 8h | Week of Feb 23 |

---

## Architecture Integration

### Request Flow (Updated for Phase 2)
```
Room Creation Request
    ↓
[Phase 1] Security & Rate Limiting
    ↓
[Phase 2] Charge Spawn Fee (Day 4)
    ↓
[Phase 2] Verify Agent (ERC-8004) (Day 5)
    ↓
[Phase 2] Create Jam Room (Day 5)
    ↓
[Phase 2] Cache Room in Redis (Day 6)
    ↓
[Phase 2] Start Orchestration (Day 7)
    ↓
Room Live
```

### Payment Flow
```
Agent Initiates Room Creation
    ↓
API Gateway receives request
    ↓
Brute Force Check (Phase 1) ✅
Rate Limit Check (Phase 1) ✅
    ↓
Payment Service (Day 4 - NEW)
    ├─ Create payment record
    ├─ Call x402 SDK
    ├─ Track status
    └─ Handle errors
    ↓
Room Service receives confirmation
    ↓
Return room to agent
```

---

## Testing Strategy

### Unit Tests (Payment Service)
- Spawn fee calculation
- Status tracking logic
- Revenue distribution splits
- Error handling

### Integration Tests
- x402 SDK mocking
- Webhook signature verification
- Payment status updates
- Error scenarios

### E2E Tests (Phase 3)
- Full room creation with payment
- Payment status polling
- Revenue distribution verification

---

## Risk Mitigation

### x402 Integration Risks
**Risk:** SDK may have different API than spec  
**Mitigation:** Mock x402 client for testing, use test SDK first

**Risk:** Transaction confirmation delays  
**Mitigation:** Implement polling and webhook fallback

**Risk:** Insufficient balance errors  
**Mitigation:** Validate balance before charging, return 402 status

### Known Limitations
- No payment retry logic yet (Phase 5)
- No refund mechanism (Phase 5)
- No multi-currency support (Phase 5)

---

## Success Metrics for Phase 2

### Functionality
- [ ] 27 TODOs reduced from 27 to ~15 (payment, ERC-8004, Jam)
- [ ] Payment system fully operational
- [ ] Agent verification working
- [ ] Audio rooms created successfully

### Quality
- [ ] 40+ test cases (Phase 1 had 30+)
- [ ] 100% type coverage
- [ ] Zero critical blockers
- [ ] Production readiness 8+/10

### Performance
- [ ] Room creation latency < 2s
- [ ] Payment confirmation < 10s
- [ ] API endpoints < 500ms

---

## Team Responsibilities

| Task | Owner | Duration |
|------|-------|----------|
| Day 4: Payment x402 | Backend Lead | 5h |
| Day 5: ERC-8004 Verification | Backend/Blockchain | 3h |
| Day 5: Jam Integration | Backend | 2h |
| Day 6: Token Refresh | Backend | 1.5h |
| Day 6: Discovery Caching | Backend | 1.5h |
| Day 6: Frontend Integration | Frontend | 1h |
| Day 7: Orchestrator | Python/Backend | 2h |
| Day 7: Integration Testing | QA/Backend | 2h |

---

## Day 4 Specific Checklist

### Preparation (Before Implementation)
- [ ] Read x402 SDK documentation
- [ ] Get testnet wallet with funds
- [ ] Configure API keys in .env
- [ ] Create mock x402 client for testing

### Implementation
- [ ] 7.1 Get x402 SDK (30m)
- [ ] 7.2-7.3 Implement charge/status (2h)
- [ ] 7.4 Implement revenue distribution (1.5h)
- [ ] 7.5-7.6 Error handling & webhooks (1h)

### Testing
- [ ] Unit tests for payment logic
- [ ] Integration tests with mock x402
- [ ] Webhook signature verification tests
- [ ] Error scenario tests

### Documentation
- [ ] Payment service architecture
- [ ] Configuration guide
- [ ] API endpoint documentation
- [ ] Error handling guide

---

## Next Steps

1. **Now:** Execute Day 4 (Payment Integration)
2. **Tomorrow:** Day 5 (ERC-8004 & Jam)
3. **Day After:** Day 6 (Token Refresh & Caching)
4. **Final Day:** Day 7 (Orchestrator & Integration Testing)
5. **Following Week:** Phase 3 (Validation & Hardening)

---

## Rollback Strategy

If critical issues discovered during Phase 2:
- **Payment System:** Disable x402 payments, return 503 (Service Unavailable)
- **ERC-8004:** Accept any wallet, warn in logs
- **Jam:** Use mock room IDs, disable audio
- **Redis:** Fall back to in-memory cache
- **Orchestrator:** Use fallback message generation

---

**Phase 1 Status:** ✅ 9/10  
**Phase 2 Status:** 🟢 Ready to Start  
**Target Completion:** February 20, 2026  
**Go/No-Go:** 🟢 **GO**

Let's build Phase 2!
