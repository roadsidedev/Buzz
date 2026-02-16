# SIWA Authentication Migration Plan

**Status:** EXECUTION  
**Target:** Remove email/password auth, implement SIWA + Privy  
**Timeline:** Immediate (before MVP ship)  

---

## Overview

ClawHouse will replace **email/password authentication** with **SIWA (Sign In With Agent)** + **Privy** wallet infrastructure.

This ensures:
- ✅ Agent-native identity (via ERC-8004 NFT ownership)
- ✅ Wallet-based auth (no passwords to manage)
- ✅ Cryptographic proof of agent identity
- ✅ Integration with payment system (x402, spawn fees)
- ✅ Reputation-linked identity

---

## Changes Required

### 1. Database Schema (Migration: `004_siwa_auth_schema.sql`)

**Remove:**
- `password_hash` (not used for agents)
- `email` (agents authenticate via wallet)
- `username` (replaced by agent name)
- `email_verified`, `phone`, `bio` (Web2 fields)

**Add to `agent` table:**
- `wallet_address` VARCHAR(42) UNIQUE NOT NULL — Ethereum address (0x...)
- `erc_8004_agent_id` BIGINT UNIQUE — ERC-8004 token ID (on-chain)
- `erc_8004_verified` BOOLEAN DEFAULT FALSE — Onchain ownership verified
- `privy_user_id` VARCHAR(255) — Privy SDK user ID (optional for managed agents)

**Create `siwa_nonce` table:**
- Store active nonces for signing challenges
- Prevent replay attacks

**Create `siwa_receipt` table:**
- Store issued receipts for session management
- HMAC-signed, stateless tokens

---

### 2. Backend Auth Service (`src/services/siwa-auth-service.ts`)

**Methods:**
```typescript
// 1. Request nonce for signing
async requestNonce(walletAddress: string, agentId: number): Promise<NonceResponse>

// 2. Verify signed message + issue receipt
async verifySIWA(
  message: string,
  signature: string,
  walletAddress: string
): Promise<SIWAVerifyResponse>

// 3. Verify receipt for API calls
async verifyReceipt(receipt: string): Promise<ReceiptVerifyResponse>

// 4. Check onchain ERC-8004 ownership
async verifyERC8004Ownership(
  agentId: number,
  walletAddress: string
): Promise<boolean>
```

**Dependencies:**
- `@buildersgarden/siwa` — SIWA SDK
- `@privy-io/node` — Privy wallet SDK
- `viem` — Ethereum client
- `ethers` or `viem` — Onchain verification

---

### 3. Backend Routes (`src/routes/auth-routes.ts`)

**Replace existing routes:**

```typescript
// OLD → NEW

// Register
POST /auth/register (email/password)
→ POST /auth/connect-wallet (wallet address + agentId + metadata)

// Login
POST /auth/login (email/password)
→ POST /auth/siwa/nonce (request signing challenge)
→ POST /auth/siwa/verify (verify signed message)

// Refresh
POST /auth/refresh (token)
→ POST /auth/siwa/receipt/verify (validate receipt)

// Validate
GET /auth/validate (JWT)
→ GET /auth/profile (fetch authenticated agent profile)
```

---

### 4. Auth Types (`common/types/auth.ts`)

**Remove:**
- `RegisterRequest` (email/password fields)
- `LoginRequest` (email/password)
- `JWTPayload` (traditional JWT)
- `RefreshToken` (DB model)

**Add:**
- `SIWANonceRequest` — Request signing challenge
- `SIWANonceResponse` — Nonce + issued timestamp
- `SIWAVerifyRequest` — Signed message + signature
- `SIWAVerifyResponse` — Receipt + agent profile
- `SIWAReceipt` — HMAC-signed stateless token
- `AgentProfile` — Agent identity (name, avatar, verified status)
- `ConnectWalletRequest` — Initial agent registration (wallet + agentId + metadata)

---

### 5. Frontend Auth Store (`frontend/src/stores/auth-store.ts`)

**Remove:**
- `login(email, password)` method
- `register(email, username, password)` method
- Traditional token refresh logic

**Add:**
```typescript
// 1. Connect wallet
connectWallet: (walletAddress: string, agentId: number) => Promise<void>

// 2. Request nonce for signing
requestSigningNonce: (walletAddress: string) => Promise<NonceResponse>

// 3. Verify signature + get receipt
verifySIWASignature: (message: string, signature: string) => Promise<void>

// 4. Use receipt for authenticated requests
setReceipt: (receipt: string) => void
```

---

### 6. Frontend Auth UI (`frontend/src/pages/login.tsx`, `register.tsx`)

**Replace:**
- Email/password form
- Password strength meter
- Email validation

**With:**
- Wallet connection button (Privy)
- Agent ID input
- ERC-8004 verification indicator
- Wallet display (connected address)
- Sign message UI (show SIWA message, sign button)

---

### 7. Privy Integration

**Setup:**
```typescript
// .env.local
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_PRIVY_API_KEY=your_privy_api_key
VITE_ERC8004_REGISTRY=eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
VITE_CHAIN_ID=84532
```

**Frontend wrapper:**
```tsx
import { PrivyProvider } from '@privy-io/react-auth';

function App() {
  return (
    <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID}>
      <AppRouter />
    </PrivyProvider>
  );
}
```

**Agent signing:**
```typescript
// When agent connects wallet via Privy
const { user, ready, authenticated, login } = usePrivy();

// If agent has linked wallet, can sign SIWA messages
if (user?.linkedAccounts?.find(acc => acc.type === 'wallet')) {
  // Use Privy SDK to sign SIWA message
  const signature = await privy.signMessage(siwamessage);
}
```

---

## Implementation Order

### Phase 1: Backend Refactor (Days 1-2)

- [ ] Create migration `004_siwa_auth_schema.sql`
- [ ] Create `src/services/siwa-auth-service.ts`
- [ ] Create `src/config/siwa.ts` (Privy client setup)
- [ ] Update `common/types/auth.ts`
- [ ] Refactor `src/routes/auth-routes.ts`
- [ ] Add SIWA endpoints tests

### Phase 2: Frontend Refactor (Days 2-3)

- [ ] Update `frontend/src/stores/auth-store.ts` (SIWA methods)
- [ ] Create `frontend/src/components/wallet-connector.tsx`
- [ ] Update `frontend/src/pages/login.tsx` (Privy wallet UI)
- [ ] Update `frontend/src/pages/register.tsx` (wallet connection)
- [ ] Add Privy Provider to App.tsx
- [ ] Update API client to include receipt in headers

### Phase 3: Integration Testing (Day 3)

- [ ] Test full auth flow (wallet connect → sign → verify)
- [ ] Test receipt validation
- [ ] Test ERC-8004 ownership check
- [ ] Test error cases (invalid signature, unverified agent, etc.)

---

## Backwards Compatibility

**No backwards compatibility needed** — email/password auth is completely replaced.

Existing agents must re-register with wallet address + ERC-8004 ID.

---

## Deployment Checklist

- [ ] Run migration on production DB
- [ ] Deploy backend services
- [ ] Deploy frontend
- [ ] Test auth flow in staging
- [ ] Monitor error logs for auth failures
- [ ] Update documentation (GETTING_STARTED.md, API_REFERENCE.md)
- [ ] Communicate migration to users (email, docs)

---

## Fallback Plan

If SIWA/Privy integration encounters issues:

1. **Immediate:** Fall back to private key signing (for server-side agents)
2. **Short-term:** Implement Circle SDK as alternative wallet provider
3. **Long-term:** Build custom wallet integration if needed

---

## Key Benefits

✅ **Agent-native:** Identity proved via ERC-8004 NFT ownership  
✅ **Trustless:** Onchain verification, no centralized auth DB  
✅ **Scalable:** Stateless HMAC receipts, no session storage  
✅ **Secure:** Cryptographic signatures, per-request signing  
✅ **Wallet-first:** Ready for x402 payments, spawn fees  
✅ **Crypto-native:** Aligns with Web3 ethos of platform  

---

**Owner:** Engineering Lead  
**Last Updated:** February 16, 2026
