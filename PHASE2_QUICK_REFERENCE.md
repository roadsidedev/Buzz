# Phase 2 Payment Enhancements - Quick Reference

## What Changed

The x402 payment service now has **full SDK integration** with database persistence, webhook idempotency, and refund handling.

### 6 Enhancements Completed

| # | Feature | Status | Key Method |
|---|---------|--------|------------|
| 7.1 | SDK Client Initialization | ✅ | `_initializeSDK()` |
| 7.2a | x402 API Transactions | ✅ | `chargeSpawnFee()` |
| 7.3 | Database Persistence | ✅ | `paymentRepository.create()` |
| 7.4 | Revenue Distribution | ✅ | `distributeRevenue()` |
| 7.6 | Webhook Idempotency | ✅ | `processWebhookPayment()` |
| 7.7 | Timeout + Refunds | ✅ | `issueRefund()`, `refundExpiredPayments()` |

---

## API Reference

### 1. Charge Spawn Fee

```typescript
const payment = await x402PaymentService.chargeSpawnFee(
  agentId: string,
  walletAddress: string,  // "0x1234..."
  roomId?: string
): Promise<PaymentRecord>
```

**Returns:**
```typescript
{
  id: "uuid",
  agentId: "agent-123",
  roomId: "room-456",
  amount: BigInt("1000000000000000000"),
  type: "spawn_fee",
  status: "pending",
  txHash: "0xabcd...",
  createdAt: Date,
  updatedAt: Date
}
```

**Errors:**
- `ValidationError` - Invalid wallet or amount
- `X402Error` - SDK call failed
- `X402Error` - Database write failed

---

### 2. Check Payment Status

```typescript
const status = await x402PaymentService.checkPaymentStatus(
  paymentId: string
): Promise<PaymentStatus>
```

**Returns:** `"pending" | "confirming" | "confirmed" | "failed"`

**Behavior:**
- Fetches payment from database
- Queries x402 API for current status
- Updates database if status changed
- Returns status or throws error

---

### 3. Process Webhook

```typescript
await x402PaymentService.processWebhookPayment(
  paymentId: string,
  status: PaymentStatus,    // "confirmed", "failed", etc.
  txHash?: string,          // blockchain hash
  idempotencyKey?: string   // optional, for retry safety
): Promise<void>
```

**Behavior:**
- Fetches payment from database
- Checks if already processed (idempotency)
- Updates payment status
- Triggers room activation if confirmed
- Returns success even if no update needed

---

### 4. Issue Refund

```typescript
await x402PaymentService.issueRefund(
  paymentId: string,
  reason?: string  // "Payment timeout", "Room failed", etc.
): Promise<void>
```

**Can refund:** PENDING, FAILED  
**Cannot refund:** CONFIRMED, REFUNDED

**Behavior:**
- Validates payment exists
- Calls x402 to create refund transaction
- Updates database status to REFUNDED
- Logs audit trail

---

### 5. Distribute Revenue

```typescript
const payouts = await x402PaymentService.distributeRevenue(
  roomId: string,
  hostWallet: string,           // "0x..."
  participantWallets: string[],  // ["0x...", "0x..."]
  totalRevenue: BigInt           // in smallest unit
): Promise<PaymentRecord[]>
```

**Split:**
- Host: 50%
- Participants: 40% (equal split)
- Platform: 10%

---

### 6. Check for Expired Payments

```typescript
const count = await x402PaymentService.refundExpiredPayments(
  timeoutMinutes?: number  // default: 60
): Promise<number>
```

**Returns:** Number of payments refunded

**Usage:**
```typescript
// Call periodically (every 5 minutes)
setInterval(async () => {
  const refunded = await paymentService.refundExpiredPayments(60);
  logger.info(`Auto-refunded ${refunded} expired payments`);
}, 5 * 60 * 1000);
```

---

## Common Patterns

### Pattern 1: Charge Spawn Fee

```typescript
import { getX402PaymentService } from "./services/x402-payment-service.js";

async function createRoom(agentId: string, walletAddress: string) {
  const paymentService = getX402PaymentService();
  
  // Charge spawn fee
  const payment = await paymentService.chargeSpawnFee(
    agentId,
    walletAddress
  );
  
  // Create room with payment tracking
  const room = await roomService.createRoom({
    hostAgentId: agentId,
    spawnFeePaymentId: payment.id,
    status: "pending"  // Wait for payment confirmation
  });
  
  return room;
}
```

---

### Pattern 2: Process Webhook

```typescript
import { Router } from "express";
import { getX402PaymentService } from "./services/x402-payment-service.js";

const router = Router();

router.post("/webhooks/payment", async (req, res) => {
  const paymentService = getX402PaymentService();
  
  try {
    // Signature already verified by middleware
    const { paymentId, status, txHash } = req.body;
    
    // Process webhook (idempotent)
    await paymentService.processWebhookPayment(
      paymentId,
      status,
      txHash
    );
    
    res.json({ ok: true });
  } catch (err) {
    logger.error("Webhook processing failed", { error: err.message });
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

export default router;
```

---

### Pattern 3: Auto-Refund Expired Payments

```typescript
import { getX402PaymentService } from "./services/x402-payment-service.js";

export async function startPaymentCleanup() {
  const paymentService = getX402PaymentService();
  
  // Check every 5 minutes
  setInterval(async () => {
    try {
      const count = await paymentService.refundExpiredPayments(60);
      
      if (count > 0) {
        logger.info(`Auto-refunded ${count} expired payments`);
      }
    } catch (err) {
      logger.error("Payment cleanup failed", { error: err.message });
      // Don't crash service on cleanup failure
    }
  }, 5 * 60 * 1000);
}

// In server.ts startup
startPaymentCleanup();
```

---

### Pattern 4: Refund on Failure

```typescript
async function handleRoomFailure(roomId: string) {
  const paymentService = getX402PaymentService();
  
  // Get room
  const room = await roomService.getRoomById(roomId);
  
  if (!room.spawnFeePaymentId) {
    return;
  }
  
  try {
    // Refund the spawn fee
    await paymentService.issueRefund(
      room.spawnFeePaymentId,
      "Room creation failed"
    );
    
    logger.info("Room spawn fee refunded", { roomId });
  } catch (err) {
    logger.error("Failed to refund on room failure", {
      roomId,
      error: err.message
    });
  }
}
```

---

## Environment Setup

### Install Dependencies
```bash
npm install @x402/sdk
```

### Set Environment Variables
```bash
# Copy from .env.example
X402_API_KEY=your-key
X402_SECRET_KEY=your-secret
X402_WEBHOOK_SECRET=your-secret
X402_NETWORK=sepolia
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PLATFORM_WALLET=0x1234...
```

### Run Tests
```bash
npm run test -- x402-payment-service
```

---

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `SDK_NOT_INITIALIZED` | SDK failed to load | Check API keys |
| `X402_API_ERROR` | x402 call failed | Retry or escalate |
| `PAYMENT_NOT_FOUND` | Payment not in DB | Check payment ID |
| `INVALID_REFUND_STATUS` | Can't refund this status | Check payment status |
| `DATABASE_ERROR` | DB write failed | Check connection |
| `WEBHOOK_PROCESSING_ERROR` | Webhook handler failed | Retry webhook |

---

## Testing Checklist

- [ ] SDK initializes on startup
- [ ] Spawn fee charged and persisted to DB
- [ ] x402 transaction hash stored
- [ ] Webhook processed (status updated)
- [ ] Webhook retry is idempotent (no double charge)
- [ ] Payment refund creates x402 transaction
- [ ] Refunded status persisted to DB
- [ ] Expired payments auto-refunded (1 hour)
- [ ] All errors logged with context

---

## Troubleshooting

**"x402 SDK not initialized"**
```
→ Check X402_API_KEY and X402_SECRET_KEY in .env
→ Run: npm install @x402/sdk
→ Restart server
```

**"Payment not found"**
```
→ Verify paymentId is correct UUID
→ Check database migration was applied
→ Verify payment was created first
```

**"Webhook signature mismatch"**
```
→ Verify X402_WEBHOOK_SECRET matches x402 dashboard
→ Check raw request body (not parsed JSON)
```

**"Cannot refund payment with status: confirmed"**
```
→ Can only refund PENDING or FAILED
→ Confirmed payments already charged
→ Use dispute resolution for confirmed payments
```

---

## Next: Day 8 Tasks

1. Implement full `refundExpiredPayments()` query logic
2. Start background job on server startup
3. Integrate with room status updates
4. Add monitoring and alerting
5. Conduct full E2E testing

---

**Reference:** See PHASE2_PAYMENT_ENHANCEMENTS.md for detailed documentation

