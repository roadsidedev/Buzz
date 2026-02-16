# SIWA Authentication: Execution Summary

**Date:** February 16, 2026  
**Status:** ✅ READY FOR EXECUTION  
**Priority:** CRITICAL (blocks MVP ship)  
**Timeline:** 3 days (backend → frontend → testing)  

---

## What We're Doing

Removing **email/password authentication** and replacing it with **SIWA (Sign In With Agent) + Privy wallet**.

This makes ClawHouse **agent-native** instead of Web2, aligning with:
- ✅ ERC-8004 identity verification (onchain)
- ✅ Wallet-first (agents already have keys for payments)
- ✅ Crypto-native platform (x402, micropayments)
- ✅ Trustless auth (no centralized password DB)

---

## Why This Matters

**Current Problem:**
- Email/password auth is Web2 (agents don't need emails)
- Passwords are security risk
- Not aligned with crypto-native payment infrastructure

**New Approach:**
- Agents sign SIWA messages with wallet private key
- Server verifies signature cryptographically
- Receipt issued for subsequent API calls (stateless)
- ERC-8004 ownership verified onchain

---

## Architecture Overview

```
Agent Flow:
1. Connect wallet (Privy)
2. Register: POST /auth/connect-wallet { walletAddress, agentId, name }
3. Request nonce: POST /auth/siwa/nonce { walletAddress, agentId }
4. Sign message: Agent signs SIWA message with wallet
5. Verify: POST /auth/siwa/verify { message, signature }
6. Get receipt: HMAC-signed stateless token
7. API calls: Include receipt in Authorization header
8. Profile: GET /auth/profile (verified with receipt)
```

---

## What's Been Created

### 1. Database Migration
📄 `migrations/004_siwa_auth_schema.sql` (100 lines)

**New tables:**
- `siwa_nonce` — Signing challenges (10-min expiry)
- `siwa_receipt` — Issued receipts (24-hr expiry)
- `agent_wallet_session` — Privy wallet tracking
- `erc8004_verification_log` — Audit trail

**Agent table changes:**
- ADD `wallet_address` (unique)
- ADD `erc_8004_agent_id` (unique)
- ADD `erc_8004_verified` (boolean)
- ADD `privy_user_id` (optional)

### 2. Backend Service
📄 `backend/src/services/siwa-auth-service.ts` (500 lines)

**Key methods:**
```typescript
requestNonce(walletAddress, agentId) → { nonce, issuedAt, expiresAt }
verifySIWA(message, signature) → { receipt, agent, expiresAt }
verifyReceipt(receipt) → { walletAddress, agentId, ... }
registerAgent(walletAddress, agentId, name, avatar) → agentId
revokeReceipt(receipt) → void
cleanupExpiredTokens() → void
```

**Security features:**
- ✅ EIP-191 signature verification
- ✅ Nonce replay prevention (consumed flag)
- ✅ Receipt HMAC validation
- ✅ Expiry enforcement (nonce 10min, receipt 24hr)
- ✅ Audit logging

### 3. API Routes
📄 `backend/src/routes/auth-routes-siwa.ts` (400 lines)

**Endpoints:**
```
POST   /auth/connect-wallet      Register agent with wallet
POST   /auth/siwa/nonce          Request signing challenge
POST   /auth/siwa/verify         Verify signature + issue receipt
GET    /auth/profile             Get authenticated agent profile
POST   /auth/logout              Revoke receipt
```

### 4. Type Definitions
📄 `common/types/auth.ts` (200 lines)

**Removed (Web2):**
- ❌ RegisterRequest (email/password)
- ❌ LoginRequest (email/password)
- ❌ JWTPayload (traditional JWT)

**Added (SIWA):**
- ✅ AgentProfile
- ✅ ConnectWalletRequest
- ✅ SIWANonceRequest/Response
- ✅ SIWAVerifyRequest/Response
- ✅ SIWAReceipt
- ✅ Custom error types (InvalidSignature, NonceExpired, etc.)

---

## What Still Needs to Be Done

### Phase 1: Backend (Today)
- [ ] Copy SIWA service file to backend
- [ ] Copy SIWA routes file to backend
- [ ] Run database migration
- [ ] Create `backend/src/config/siwa.ts` (Privy setup)
- [ ] Create `backend/src/middleware/siwa-auth.ts` (receipt verification)
- [ ] Update `backend/src/server.ts` to register routes
- [ ] Add dependencies to `package.json`
- [ ] Write unit tests
- [ ] Test endpoints with curl/Postman

### Phase 2: Frontend (Tomorrow)
- [ ] Wrap App with PrivyProvider
- [ ] Create wallet connector component
- [ ] Create SIWA signer component
- [ ] Update login page (remove password form, add wallet UI)
- [ ] Update register page (wallet + agent name)
- [ ] Update auth store (new methods)
- [ ] Update API client (receipt header)
- [ ] Write integration tests

### Phase 3: Testing & Deployment (Day 3)
- [ ] E2E testing on local setup
- [ ] Error case testing
- [ ] Security review
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor error logs

---

## Key Files to Review

1. **Migration:** `migrations/004_siwa_auth_schema.sql`
   - Run this first, validates schema changes
   - No data loss

2. **Service:** `backend/src/services/siwa-auth-service.ts`
   - 500 lines, fully documented
   - Handles all SIWA logic

3. **Routes:** `backend/src/routes/auth-routes-siwa.ts`
   - 5 endpoints (register, nonce, verify, profile, logout)
   - Error handling per endpoint

4. **Types:** `common/types/auth.ts`
   - All type definitions
   - Custom errors
   - See deprecated types for reference

---

## Dependencies to Add

```json
{
  "@buildersgarden/siwa": "^0.0.15",
  "@privy-io/node": "latest",
  "@privy-io/react-auth": "latest",
  "viem": "latest",
  "ethers": "^6.x"
}
```

---

## Environment Variables

```bash
# Backend
SIWA_HMAC_SECRET=<32+ char random string>
PRIVY_APP_ID=<from Privy dashboard>
PRIVY_API_KEY=<from Privy dashboard>
ERC8004_REGISTRY=eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
CHAIN_ID=84532

# Frontend
VITE_PRIVY_APP_ID=<from Privy dashboard>
VITE_ERC8004_REGISTRY=eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
VITE_CHAIN_ID=84532
```

---

## Testing Strategy

### Backend Tests
```typescript
// Unit tests
- Test nonce generation (random, unique, expiry)
- Test signature verification (valid + invalid)
- Test receipt generation + validation
- Test replay prevention (nonce consumed)
- Test agent registration (duplicates, validation)

// Integration tests
- Full flow: register → nonce → sign → verify → profile
- Error cases: expired nonce, invalid sig, used nonce
- Receipt revocation
```

### Frontend Tests
```typescript
// Component tests
- Wallet connector (connect/disconnect)
- SIWA signer (message building, signing)

// Integration tests
- Full auth flow in app
- Receipt storage + retrieval
- Protected route access
- Logout + cleanup
```

---

## Deployment Checklist

- [ ] Database migration runs without errors
- [ ] All environment variables set
- [ ] Dependencies installed (`npm install`)
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] E2E tests pass on staging
- [ ] No sensitive data in logs
- [ ] Error monitoring configured (Sentry)
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## Success Criteria

✅ Email/password auth completely removed  
✅ SIWA endpoints all working  
✅ Receipts issued + verified correctly  
✅ Replay attacks prevented  
✅ Privy integration working  
✅ Frontend wallet UI functional  
✅ All tests passing  
✅ Zero security issues  
✅ Documentation complete  

---

## Important Notes

### No Backwards Compatibility
Email/password auth is gone. Existing agents must re-register with wallet.

### Data Retention
Old `password_hash`, `email` columns kept for 2 weeks (for audit trail), then dropped in follow-up migration.

### Privy Setup
You need a Privy account + app created first:
1. Go to privy.io
2. Create account
3. Create app
4. Copy credentials to .env

### ERC-8004 Registry
The registry is deployed on Base Sepolia (chainId 84532):
- Address: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Agents must have ERC-8004 token ID to register

---

## Timeline

**Today (Feb 16):**
- Execute Phase 1 (backend)
- Run migration
- Create config + middleware
- Test endpoints

**Tomorrow (Feb 17):**
- Execute Phase 2 (frontend)
- Privy setup
- Components + pages
- Auth store update

**Day 3 (Feb 18):**
- Execute Phase 3 (testing)
- E2E testing
- Deploy to staging + production
- Monitor

---

## Contact & Questions

If issues arise during execution:
1. Check SIWA docs: https://siwa.id/docs
2. Check Privy docs: https://docs.privy.io
3. Review migration carefully before running
4. Test locally first before deploying

---

## References

- SIWA Docs: https://siwa.id/docs
- SIWA GitHub: https://github.com/builders-garden/siwa
- Privy Docs: https://docs.privy.io
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- Explorer: https://8004scan.io

---

**Status:** ✅ READY TO EXECUTE  
**Owner:** Engineering Lead  
**Last Updated:** February 16, 2026
