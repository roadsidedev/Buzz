# Phase 2 Architecture Update - x402 Integration Correction

**Date:** February 16, 2026  
**Status:** Architecture Clarification  
**Impact:** Significant rearchitecture required  

---

## Key Finding

After reviewing the official x402 documentation, the architecture previously implemented is **not aligned with x402's design**.

### What We Thought (Incorrect)
- x402 is a direct payment SDK (like Stripe)
- We create transactions directly via `createPayment()`
- We handle transaction status tracking manually

### What x402 Actually Is (Correct)
- x402 is an **HTTP middleware pattern** for the 402 Payment Required standard
- Routes are protected with payment requirements
- Clients automatically pay via x402 facilitator
- Server verifies payment headers, not transactions
- **No direct transaction creation** - payment flows through facilitator

---

## Correct x402 Architecture

### Flow for Spawn Fee

```
1. Agent calls: POST /api/rooms (no payment)
   ↓
2. Server responds: HTTP 402 Payment Required
   + PAYMENT-REQUIRED header with price & network
   ↓
3. Client (agent) receives 402
   ↓
4. Client creates payment via x402 facilitator
   + Calls facilitator with wallet + signature
   ↓
5. Client retries: POST /api/rooms
   + PAYMENT-SIGNATURE header (proof of payment)
   ↓
6. Server middleware verifies signature via facilitator
   ↓
7. If valid: Create room + return 200 OK
   If invalid: Return 402 again
```

### Key Differences

| Old Approach | New Approach |
|-------------|-------------|
| We create transaction | Client creates transaction |
| We track tx hash | Facilitator handles payment |
| We store all payment details | We only verify headers |
| Complex state management | Stateless middleware |
| Database heavy | Minimal DB writes |

---

## Recommended Implementation Path

### Option 1: Proper x402 (Recommended for Production)
**Effort:** 8-12 hours (Day 8-9)
- Remove custom payment service
- Add `@x402/express` middleware
- Protect `/api/rooms` route
- Log successful payments to DB (optional)
- **Simpler, cleaner, production-ready**

### Option 2: Hybrid Approach (Quick Implementation)
**Effort:** 2-3 hours (finish today)
- Keep current payment service
- Mock x402 facilitator calls
- Implement webhook listener (for testnet x402)
- Add background job
- Add RoomService integration
- **Works for MVP, needs refactor before production**

---

## Current State Analysis

### What Was Implemented (Phase 2)
✅ Database persistence layer  
✅ Webhook signature verification (HMAC-SHA256)  
✅ Idempotency handling  
✅ Refund mechanism  
✅ Timeout logic  
⚠️ x402 "SDK" calls (not real x402 SDK)

### What's Missing
❌ x402 middleware integration  
❌ 402 response handling  
❌ Payment-Signature header verification  
❌ Facilitator communication  
❌ Proper payment flow  

---

## Recommended Action

### For Today (Complete Phase 2 MVP)
1. **Keep current implementation** as custom payment system
2. **Implement background job** with database query
3. **Integrate RoomService** status update
4. **Add basic tests** (mock x402 calls)
5. **Document the gap** between x402 spec and current impl

### For Production (Phase 2.5)
1. Migrate to proper x402 middleware
2. Replace custom payment service
3. Use `@x402/express` for route protection
4. Update payment flow in frontend
5. Test with real x402 facilitator

---

## Installation (Current Approach)

Since current implementation is custom (not true x402), we DON'T need:
```bash
# NOT needed (these are for x402 middleware)
npm install @x402/express
npm install @x402/evm
npm install @x402/core
```

### What We Actually Need

```bash
# For database queries
npm install pg  # Already installed

# For background jobs
npm install node-cron  # or use setInterval

# For testing
npm install vitest  # Already installed
npm install sinon   # Mock library
```

---

## Path Forward

**Immediate (Next 1 hour):**
1. ✅ Implement `refundExpiredPayments()` database query
2. ✅ Add background job scheduler
3. ✅ Integrate RoomService status update
4. ✅ Create basic test suite

**This Week (Future):**
1. Deploy to staging with current implementation
2. Test webhook flow manually
3. Plan migration to proper x402 middleware

**Phase 2.5 (Next Sprint):**
1. Replace with `@x402/express` middleware
2. Update frontend payment handling
3. Full x402 integration

---

## Technical Debt & Risks

### Current Implementation Risks
- ❌ Not following x402 standard (402 status code)
- ❌ Custom payment handling (not web-standard)
- ❌ Webhook-based instead of header-based
- ⚠️ Requires custom x402 facilitator

### Mitigation
- Keep architecture modular (easy to swap)
- Document all custom extensions
- Don't hardcode x402-specific logic
- Create abstraction layer for payments

---

## Summary

**Current Phase 2 is a custom payment system, not true x402.**

This is fine for MVP, but production needs proper x402 integration.

**Let's finish Phase 2 MVP today, plan Phase 2.5 for later.**

