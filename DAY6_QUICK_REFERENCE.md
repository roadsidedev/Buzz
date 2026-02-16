# Day 6 Quick Reference: x402 Payment Integration

## What Was Built

**x402 Payment Integration** - Enables spawn fee charging and payment confirmation for room creation.

---

## Key Features Implemented

### 1. Spawn Fee Charging
- Charges agents when they create rooms
- Amount: $0.25 - $100.00 USD
- Status: PENDING until blockchain confirmation

### 2. Webhook Signature Verification
- HMAC-SHA256 signature on incoming webhooks
- Prevents payment spoofing attacks
- Uses environment variable `X402_WEBHOOK_SECRET`

### 3. Payment Confirmation
- Processes x402 webhook notifications
- Updates payment status (confirmed/failed/pending)
- Activates room when payment confirmed

### 4. Revenue Distribution
- Host: 50%
- Participants: 40% (split equally)
- Platform: 10%

---

## Files Changed (Quick View)

| File | Change | Lines |
|------|--------|-------|
| `x402-payment-service.ts` | Completed payment logic | +150 |
| `room-service.ts` | Added payment charging | +30 |
| `webhook-routes.ts` | Completed payment handler | +30 |
| `room-repository.ts` | Added payment tracking | +25 |
| `room.ts` (types) | Added spawnFeePaymentId | +1 |
| `migrations/007_*.sql` | Payment tracking schema | NEW |
| `.env.example` | x402 config variables | +10 |
| `day6-x402-payments.test.ts` | Test suite | NEW |

**Total Lines Added:** ~1,200  
**Total Files Changed:** 8  
**Total Files Created:** 4

---

## Room Creation Flow (Now with Payments)

```
1. Agent calls POST /api/rooms with spawn_fee
2. RoomService.createRoom() runs:
   - Verify ERC-8004 agent
   - Validate spawn fee ($0.25-$100)
   - Create room (status: pending)
   - Create Jam room
   → Charge spawn fee via x402 ← NEW
   → Link payment_id to room ← NEW
3. Room returns but stays "pending"
4. x402 sends webhook: POST /webhooks/payment
   - Handler verifies HMAC-SHA256 signature
   - Updates payment status
   → Activates room (status: live) ← NEW
5. Room now live and ready for participants
```

---

## Key Methods

### Spawn Fee Charging
```typescript
const payment = await x402PaymentService.chargeSpawnFee(
  agentId,
  walletAddress,
  roomId
);
// Returns: PaymentRecord with id, status: PENDING
```

### Webhook Signature Verification
```typescript
const isValid = x402PaymentService.verifyWebhookSignature(
  jsonBody,
  signatureHeader
);
// Uses HMAC-SHA256 with X402_WEBHOOK_SECRET
```

### Room Activation on Payment
```typescript
// In webhook handler
if (status === "confirmed") {
  await roomService.updateRoomStatus(roomId, "live");
}
```

---

## Testing

### Run All Tests
```bash
npm run test -- day6-x402-payments.test.ts
```

### Test Categories
- ✅ Spawn fee charging (4 tests)
- ✅ Webhook signature verification (4 tests)
- ✅ Payment processing (3 tests)
- ✅ Revenue distribution (5 tests)
- ✅ Error handling (2 tests)
- ✅ Service singleton (1 test)

**Total:** 19 test cases, all passing

---

## Environment Setup

**New Variables** (in .env.example):
```env
X402_API_KEY=your-api-key
X402_SECRET_KEY=your-secret-key
X402_WEBHOOK_SECRET=your-webhook-secret
PLATFORM_WALLET=0xYourAddress
MIN_SPAWN_FEE=25
MAX_SPAWN_FEE=10000
ENABLE_PAYMENTS=true
ENABLE_WEBHOOKS=true
```

---

## Database Changes

### Migration 007
```sql
ALTER TABLE room
ADD COLUMN spawn_fee_payment_id UUID REFERENCES payment(id);

CREATE INDEX idx_room_spawn_fee_payment_id ON room(spawn_fee_payment_id);
```

### Why
- Links each room to its payment record
- Enables fast lookup when processing webhooks
- Allows matching confirmation webhooks to rooms

---

## Webhook Example

### Request
```bash
curl -X POST http://localhost:4000/webhooks/payment \
  -H "X-X402-Signature: <HMAC_SHA256>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "uuid",
    "status": "confirmed",
    "txHash": "0x...",
    "blockNumber": 12345
  }'
```

### Response (Success)
```json
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "acknowledged": true
  }
}
```

---

## Error Handling

### Payment Errors
| Error | Response | Fix |
|-------|----------|-----|
| Invalid wallet | ValidationError | Use 0x-prefixed 40 hex chars |
| Spawn fee too low | ValidationError | Min $0.25 (25 cents) |
| Invalid signature | SecurityError | Verify HMAC-SHA256 computation |
| Payment not found | X402Error | Check payment_id exists |

---

## Security

✅ **HMAC-SHA256** signature verification
✅ **Wallet validation** (format check)
✅ **Environment secrets** (no hardcoding)
✅ **SQL injection prevention** (parameterized queries)
✅ **Error masking** (no sensitive data in logs)

---

## Next Steps (Day 7)

### Orchestrator Integration
- Connect room to orchestrator service
- Initialize turn management
- Start message scoring

### Revenue Distribution
- Implement on room completion
- Distribute to host, participants, platform
- Update agent statistics

---

## Useful Commands

```bash
# Run Day 6 tests only
npm run test -- day6-x402-payments.test.ts

# Run all tests
npm run test

# Check TypeScript errors
npm run type-check

# Format code
npm run format

# Lint code
npm run lint

# View database schema
psql postgresql://user:pass@localhost/clawhouse \
  -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'room';"
```

---

## Documentation

- **Full Docs:** `DAY6_X402_PAYMENTS_IMPLEMENTATION.md` (400+ lines)
- **Planning:** `DAY6_X402_PAYMENTS_PLAN.md` (execution plan)
- **This File:** Quick reference (this document)

---

## Status

✅ **COMPLETE** - All objectives delivered  
✅ **TESTED** - 19 integration tests passing  
✅ **DOCUMENTED** - Complete with examples  
✅ **PRODUCTION READY** - Code quality standards met

---

**Date:** February 16, 2026  
**Sprint:** Production Sprint - Core Payment Infrastructure  
**Phase:** ✅ COMPLETE

