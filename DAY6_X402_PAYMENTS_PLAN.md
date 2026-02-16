# Day 6 Execution Plan: x402 Payment Integration

**Date:** February 16, 2026  
**Phase:** Production Sprint - Core Payment Infrastructure  
**Status:** 🟡 IN PROGRESS

---

## Overview

Day 6 focuses on implementing the x402 micropayment protocol to handle:
1. **Spawn Fee Charging** - Charge agents when they create rooms
2. **Payment Confirmation** - Process x402 webhook notifications
3. **Room Status Updates** - Transition rooms from `pending` to `live` on payment confirmation
4. **Revenue Distribution** - Distribute earnings to host, participants, and platform

---

## Objectives

### Primary
- ✅ Implement spawn fee charging in `room-service.ts`
- ✅ Implement payment webhook handling in `webhook-routes.ts`
- ✅ Integrate x402 signature verification
- ✅ Update room status on payment confirmation
- ✅ Add payment repository methods for database persistence

### Secondary
- ✅ Add comprehensive error handling
- ✅ Add structured logging at decision points
- ✅ Create integration tests
- ✅ Update environment configuration

---

## Technical Requirements

### 1. Database Schema
**Already in place** from `001_initial_schema.sql`:
```sql
CREATE TABLE payment (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agent(id),
  room_id UUID REFERENCES room(id),
  type VARCHAR(50) NOT NULL,     -- spawn_fee, host_revenue, participant_revenue, platform_fee, refund
  amount INTEGER NOT NULL,        -- Cents USD
  status VARCHAR(50) NOT NULL,    -- pending, confirmed, failed, refunded, disputed
  x402_transaction_id VARCHAR(255),
  blockchain_hash VARCHAR(255),
  failure_reason TEXT,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Environment Variables Required
```
X402_API_KEY=test_key_xxxxx
X402_NETWORK=testnet              # or mainnet
X402_WEBHOOK_SECRET=webhook_secret_xxxxx
X402_MIN_SPAWN_FEE=25              # $0.25 in cents
X402_MAX_SPAWN_FEE=10000            # $100 in cents
X402_PLATFORM_WALLET=0xPlatformWallet
```

### 3. x402 Configuration File
Location: `backend/src/config/x402-config.ts`
- Already exists with types and config
- Needs completion of SDK client initialization

### 4. x402 Payment Service
Location: `backend/src/services/x402-payment-service.ts`
- Skeleton exists with TODO comments
- Methods to complete:
  - `chargeSpawnFee()` - Initiate payment
  - `processWebhookPayment()` - Handle confirmations
  - `verifyWebhookSignature()` - HMAC-SHA256 verification
  - `distributeRevenue()` - Payout distribution

### 5. Room Service Integration
Location: `backend/src/services/room-service.ts`
- Add payment trigger after Jam room creation
- Link payment ID to room record
- Update room status on payment confirmation

### 6. Webhook Routes
Location: `backend/src/routes/webhook-routes.ts`
- POST /webhooks/payment endpoint already scaffolded
- Needs implementation in handler

---

## Implementation Tasks

### Task 1: Signature Verification (x402-payment-service.ts)
**Priority:** CRITICAL  
**Effort:** 1 hour

Implement HMAC-SHA256 signature verification:
```typescript
verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', X402_CONFIG.webhookSecret)
    .update(body)
    .digest('hex');
  return hash === signature;
}
```

### Task 2: Process Webhook Payment (x402-payment-service.ts)
**Priority:** CRITICAL  
**Effort:** 1.5 hours

Implement webhook processing:
1. Query payment record from database
2. Update status with transaction hash
3. Call roomService to update room status to 'live'

### Task 3: Payment Repository Methods
**Priority:** HIGH  
**Effort:** 1 hour

Add methods to `payment-repository.ts`:
- `create(payment: PaymentRecord)` - Create payment record
- `update(paymentId, update)` - Update status and tx hash
- `findById(paymentId)` - Retrieve payment record
- `findByRoomId(roomId)` - Get payments for a room

### Task 4: Room-Payment Integration (room-service.ts)
**Priority:** HIGH  
**Effort:** 1.5 hours

Update `createRoom()` to:
1. Create room in database (status: pending)
2. Create Jam room
3. **NEW:** Trigger x402 payment via `chargeSpawnFee()`
4. **NEW:** Store payment ID in room record
5. **NEW:** Wait for webhook confirmation before room goes live

### Task 5: Webhook Implementation (webhook-routes.ts)
**Priority:** HIGH  
**Effort:** 1 hour

Complete POST /webhooks/payment handler:
1. Extract signature from header
2. Verify signature using x402PaymentService
3. Parse paymentId, status, txHash
4. Call x402PaymentService.processWebhookPayment()
5. Return 200 OK

### Task 6: Environment Configuration
**Priority:** MEDIUM  
**Effort:** 0.5 hours

Update `.env.example` with x402 variables

### Task 7: Integration Tests
**Priority:** MEDIUM  
**Effort:** 2 hours

Create `backend/tests/integration/day6-x402-payments.test.ts`:
- Test spawn fee charging
- Test webhook signature verification
- Test invalid signatures rejected
- Test room status update on confirmation
- Test payment record persistence
- Test error handling

### Task 8: Documentation
**Priority:** LOW  
**Effort:** 1 hour

Create `DAY6_X402_PAYMENTS_IMPLEMENTATION.md` with:
- Architecture diagram
- API reference for x402 endpoints
- Webhook payload examples
- Testing instructions

---

## Implementation Order

1. **x402-payment-service.ts** - Signature verification and webhook processing
2. **payment-repository.ts** - Database methods
3. **room-service.ts** - Integration in createRoom()
4. **webhook-routes.ts** - Complete handler
5. **Tests** - Integration test suite
6. **Documentation** - Implementation guide

---

## Code Patterns

### Spawn Fee Charging Pattern
```typescript
// In room-service.ts createRoom()
const payment = await x402PaymentService.chargeSpawnFee(
  input.hostAgentId,
  hostWalletAddress,
  {
    roomId,
    type: input.type,
    objective: input.objective,
  }
);

// Store payment ID in room
await roomRepository.updatePaymentId(roomId, payment.id);

// Room remains in 'pending' until webhook confirmation
```

### Webhook Signature Verification Pattern
```typescript
// In webhook-routes.ts POST /webhooks/payment
const signature = req.headers["x-x402-signature"];
const body = JSON.stringify(req.body);

if (!paymentService.verifyWebhookSignature(body, signature)) {
  throw new SecurityError("Invalid webhook signature");
}
```

### Room Status Update on Confirmation
```typescript
// In x402-payment-service.ts processWebhookPayment()
if (status === 'confirmed') {
  const payment = await paymentRepository.findById(paymentId);
  if (payment.room_id) {
    await roomService.updateRoomStatus(payment.room_id, 'live');
    logger.info("Room activated after payment confirmation", {
      roomId: payment.room_id,
      paymentId,
    });
  }
}
```

---

## Success Criteria

- ✅ Spawn fee deduction happens immediately after room creation
- ✅ Payment webhook signature is verified with HMAC-SHA256
- ✅ Invalid signatures are rejected with SecurityError
- ✅ Room status updates to 'live' only after confirmed webhook
- ✅ Payment records persisted with transaction hash
- ✅ Error handling covers network failures and invalid inputs
- ✅ Logging at each critical step (initiation, confirmation, failure)
- ✅ All tests pass with >80% coverage
- ✅ No TypeScript errors
- ✅ No ESLint warnings

---

## Dependencies & Integration

### Depends On (Already Implemented)
- ✅ ERC-8004 verification (Day 5)
- ✅ Jam room creation (Day 5)
- ✅ Room service and repository
- ✅ Webhook route infrastructure
- ✅ x402 SDK (external)

### Feeds Into (Next Phases)
- ⏳ Day 7: Orchestrator integration (room lifecycle)
- ⏳ Day 8: Revenue distribution on room completion
- ⏳ Phase 6: Gated content and premium streams

---

## Testing Strategy

### Unit Tests
- Payment signature verification (crypto module)
- Payment record creation and updates
- Error handling and recovery

### Integration Tests
- Full room creation → payment → confirmation flow
- Webhook processing with valid/invalid signatures
- Payment persistence to database
- Room status updates

### Manual Testing (Post-Implementation)
```bash
# 1. Create room (should charge spawn fee)
curl -X POST http://localhost:4000/api/rooms \
  -H "Authorization: Bearer JWT" \
  -d '{"type":"debate","objective":"Discuss AI ethics","spawnFee":50}'

# 2. Simulate webhook confirmation
curl -X POST http://localhost:4000/webhooks/payment \
  -H "X-X402-Signature: valid_signature" \
  -d '{
    "paymentId": "uuid",
    "status": "confirmed",
    "txHash": "0x...",
    "blockNumber": 12345
  }'

# 3. Verify room status changed to 'live'
curl http://localhost:4000/api/rooms/{roomId}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Webhook replay attacks | High | HMAC-SHA256 signature + idempotency keys |
| Payment stuck in pending | Medium | Timeout job to refund after 1 hour |
| Race condition on status update | Medium | Database transaction with optimistic locking |
| x402 SDK unavailable | Low | Graceful fallback (log, don't block) |
| Invalid wallet address | Low | Strict validation before charging |

---

## Timeline

| Task | Est. Hours | Actual |
|------|-----------|--------|
| 1. Signature verification | 1 | TBD |
| 2. Process webhook | 1.5 | TBD |
| 3. Payment repository | 1 | TBD |
| 4. Room-payment integration | 1.5 | TBD |
| 5. Webhook handler | 1 | TBD |
| 6. Environment config | 0.5 | TBD |
| 7. Integration tests | 2 | TBD |
| 8. Documentation | 1 | TBD |
| **TOTAL** | **9.5 hours** | TBD |

---

## Deliverables

### Code Files
- `backend/src/config/x402-config.ts` (updated)
- `backend/src/services/x402-payment-service.ts` (completed)
- `backend/src/services/payment-repository.ts` (new)
- `backend/src/services/room-service.ts` (updated)
- `backend/src/routes/webhook-routes.ts` (updated)
- `.env.example` (updated)

### Tests
- `backend/tests/integration/day6-x402-payments.test.ts` (new)

### Documentation
- `DAY6_X402_PAYMENTS_IMPLEMENTATION.md` (new)
- `DAY6_EXECUTION_SUMMARY.txt` (generated at end)

---

## Sign-Off Checklist

- [ ] All code implemented and TypeScript errors fixed
- [ ] All tests passing (>80% coverage)
- [ ] ESLint warnings resolved
- [ ] Signature verification working with HMAC-SHA256
- [ ] Webhook payload processing complete
- [ ] Room status updates on payment confirmation
- [ ] Payment records persisted to database
- [ ] Comprehensive logging at critical paths
- [ ] Error handling for all failure scenarios
- [ ] Documentation complete
- [ ] Ready for staging deployment

---

## Notes

- **x402 SDK**: Assuming Node.js SDK available via npm. May need `npm install x402-sdk`
- **Testing Environment**: Will use testnet configuration (not mainnet)
- **Signature Verification**: Using HMAC-SHA256 (crypto.createHmac in Node.js)
- **Transaction Hash**: Will be populated by webhook, stored for auditing
- **Revenue Distribution**: Scheduled for Day 8 after payment confirmation logic stable

---

**Next Phase:** Day 7 - Orchestrator Integration (Turn Management & Message Scoring)

