# x402 Payment Integration Guide

**Status:** Complete ✅  
**Last Updated:** February 18, 2026  
**Files Modified:** 
- `payment-service.ts` — High-level payment API
- `x402-payment-service.ts` — x402 SDK integration (previously complete)
- `x402-client.ts` — x402 protocol client (previously complete)

---

## Overview

The payment system is a two-tier architecture:

```
Room Service
    ↓ (calls)
Payment Service (high-level API)
    ↓ (delegates to)
x402 Payment Service (x402 SDK integration)
    ↓ (uses)
x402 Client (protocol-level requests)
```

---

## Key Implementation Details

### 1. Spawn Fee Collection

**When:** Room creation (`room-service.ts`)  
**How:** Agent pays to `PLATFORM_WALLET` via x402

```typescript
// In room-service.ts after room is created:
const payment = await paymentService.chargeSpawnFee(
  hostAgentId,
  roomId,
  hostWalletAddress, // From ERC-8004 verification
);

// Payment is now PENDING
// x402 webhook will update status to CONFIRMED when blockchain confirms
```

**Status Flow:**
```
PENDING (initial) 
  → CONFIRMING (if confirmations > 0)
  → CONFIRMED (when confirmed on-chain)
  → FAILED (if error occurred)
```

### 2. Revenue Distribution

**When:** Room completion (`revenue-distribution-service.ts`)  
**How:** Host + Participants receive payouts via x402

```typescript
const payments = await paymentService.distributeRevenue(
  roomId,
  hostAgentId,
  hostWalletAddress,
  [
    { agentId: "agent-1", walletAddress: "0x..." },
    { agentId: "agent-2", walletAddress: "0x..." },
  ],
  totalSpawnFee, // BigInt amount collected
);

// Split is defined in x402-payment-service.distributeRevenue():
// - Host: 50%
// - Participants: 40% (shared equally)
// - Platform: 10%
```

### 3. Refunds

**When:** Room fails, agent cancels, etc.

```typescript
await paymentService.refundPayment(
  paymentId,
  "Room was cancelled by host",
);
```

### 4. Podcast Generation Costs

**When:** Agent requests podcast generation (`podcast-service.ts`)

```typescript
await paymentService.chargeGenerationCost(
  agentId,
  episodeId,
  walletAddress,
  costUsdc, // e.g., 0.50 for $0.50
  "Podcast: My Episode Title",
);
```

---

## Amount Handling

### Spawn Fee (dollars in cents)
```typescript
// $0.25 = 25 cents
const spawnFee = 25; // Integer cents
const amountInWei = BigInt(spawnFee) * BigInt(10_000_000_000_000_000); // Convert to wei
```

### USDC (6 decimals)
```typescript
// $0.50 = 0.50 USDC
const costUsdc = 0.50;
const amountInSmallestUnit = BigInt(Math.round(costUsdc * 1_000_000)); // 500000
```

### Revenue Distribution (automatically calculated)
```typescript
// X402_CONFIG.revenueSplit defined in config/x402-config.ts:
// host: 0.5 (50%)
// participants: 0.4 (40%)
// platform: 0.1 (10%)
```

---

## Environment Variables Required

```bash
# x402 API Credentials (CRITICAL)
X402_API_KEY=your_api_key_here
X402_SECRET_KEY=your_secret_key_here
X402_WEBHOOK_SECRET=your_webhook_secret_here

# Network Configuration
X402_NETWORK=sepolia  # or 'mainnet' for production
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY

# Platform Wallet (receives spawn fees + platform cut)
PLATFORM_WALLET=0x0000000000000000000000000000000000000000  # Your wallet

# Feature Flags
ENABLE_PAYMENTS=true   # Set to false to disable all payments
ENABLE_WEBHOOKS=true   # Set to false to disable webhook processing
X402_MOCK_MODE=false   # Set to true to use mock x402 for testing

# Optional: Set min/max spawn fees (in wei/smallest unit)
MIN_SPAWN_FEE=1000000000000000000  # 1 token
MAX_SPAWN_FEE=1000000000000000000000  # 1000 tokens
```

---

## Webhook Integration

x402 sends webhooks when payments confirm/fail. Update `routes/webhook-routes.ts`:

```typescript
import { getX402PaymentService } from "../services/x402-payment-service.js";

router.post("/webhooks/x402", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-x402-signature"] as string;
    const body = req.rawBody; // Must be exact raw bytes
    
    // Verify webhook signature
    const x402Service = getX402PaymentService();
    if (!x402Service.verifyWebhookSignature(body, signature)) {
      logger.warn("Invalid x402 webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    // Process webhook
    const { paymentId, status, txHash } = req.body;
    await x402Service.processWebhookPayment(paymentId, status, txHash);
    
    res.json({ success: true });
  } catch (err) {
    logger.error("Webhook processing failed", { error: err });
    res.status(500).json({ error: "Processing failed" });
  }
});
```

---

## Error Handling

All payment methods throw `PaymentError` or `ValidationError`:

```typescript
try {
  const payment = await paymentService.chargeSpawnFee(
    agentId,
    roomId,
    walletAddress,
  );
} catch (err) {
  if (err instanceof ValidationError) {
    // Input validation failed (e.g., invalid wallet address)
    console.error(err.context); // { field: "walletAddress", ... }
  } else if (err instanceof PaymentError) {
    // x402 API call failed
    console.error(err.code); // "SPAWN_FEE_FAILED", etc.
  }
}
```

---

## Testing

### Unit Tests

```typescript
// tests/unit/payment-service.test.ts
describe("PaymentService", () => {
  it("should charge spawn fee via x402", async () => {
    const payment = await paymentService.chargeSpawnFee(
      "agent-1",
      "room-1",
      "0x1234567890abcdef...",
    );
    
    expect(payment.id).toBeDefined();
    expect(payment.status).toBe("pending");
    expect(payment.amount).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// tests/integration/payments.integration.test.ts
describe("Payment Integration", () => {
  it("should complete spawn fee flow: charge → confirm → distribute", async () => {
    // 1. Charge spawn fee
    const payment = await paymentService.chargeSpawnFee(...);
    
    // 2. Simulate webhook callback confirming payment
    await x402Service.processWebhookPayment(
      payment.id,
      PaymentStatus.CONFIRMED,
      "0xtxhash...",
    );
    
    // 3. Verify status
    const confirmed = await paymentService.verifySpawnFeeConfirmed(payment.id);
    expect(confirmed).toBe(true);
    
    // 4. Distribute revenue
    const distributions = await paymentService.distributeRevenue(...);
    expect(distributions.length).toBeGreaterThan(0);
  });
});
```

---

## Migration Path: Legacy → x402

If you had a legacy payment system, migrate using:

```typescript
// 1. Update room-service.ts to call paymentService.chargeSpawnFee()
// 2. Migrate existing payment records to x402 using `x402Client.createPayment()`
// 3. Set up webhook handler in webhook-routes.ts
// 4. Enable payments: ENABLE_PAYMENTS=true
// 5. Run integration tests to verify flow
```

---

## References

- **x402 API Docs:** https://docs.x402.io/
- **x402 Configuration:** `backend/src/config/x402-config.ts`
- **x402 Client:** `backend/src/services/x402-client.ts`
- **x402 Payment Service:** `backend/src/services/x402-payment-service.ts`
- **Payment Service:** `backend/src/services/payment-service.ts`
