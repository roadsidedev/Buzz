# SIWA Implementation Execution Checklist

**Status:** READY FOR EXECUTION  
**Created:** February 16, 2026  
**Timeline:** 3 days (Phase 1: Backend, Phase 2: Frontend, Phase 3: Testing)  

---

## Phase 1: Backend Implementation (Day 1-2)

### Database
- [ ] Run migration: `migrations/004_siwa_auth_schema.sql`
  - Creates `siwa_nonce`, `siwa_receipt`, `agent_wallet_session`, `erc8004_verification_log` tables
  - Adds `wallet_address`, `erc_8004_agent_id`, `erc_8004_verified`, `privy_user_id` to `agent` table
  - Confirms no data loss (can review before applying)

### Backend Services

#### New Files Created:
- ✅ `backend/src/services/siwa-auth-service.ts` (500 lines)
  - `requestNonce()` — Generate signing challenges
  - `verifySIWA()` — Verify signatures + issue receipts
  - `verifyReceipt()` — Validate receipts for API calls
  - `registerAgent()` — Register new agent with wallet
  - `cleanupExpiredTokens()` — Maintenance task

- ✅ `backend/src/routes/auth-routes-siwa.ts` (400 lines)
  - `POST /auth/connect-wallet` — Register agent
  - `POST /auth/siwa/nonce` — Request signing challenge
  - `POST /auth/siwa/verify` — Verify signature + issue receipt
  - `GET /auth/profile` — Get authenticated agent profile
  - `POST /auth/logout` — Revoke receipt

#### Configuration
- [ ] Create `backend/src/config/siwa.ts` (Privy client setup)
  ```typescript
  import { PrivyClient } from "@privy-io/node";
  
  export const privy = new PrivyClient({
    apiKey: process.env.PRIVY_API_KEY!,
    appId: process.env.PRIVY_APP_ID!,
  });
  ```

- [ ] Update `.env` with:
  ```
  SIWA_HMAC_SECRET=<32+ character random string>
  PRIVY_APP_ID=<from Privy dashboard>
  PRIVY_API_KEY=<from Privy dashboard>
  ERC8004_REGISTRY=eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
  CHAIN_ID=84532
  ```

#### Service Integration
- [ ] Update `backend/src/services/index.ts` to export `siwaAuthService`
  ```typescript
  import { SIWAAuthService } from "./siwa-auth-service.js";
  export const siwaAuthService = new SIWAAuthService(db);
  ```

- [ ] Add method stubs to `SIWAAuthService`:
  ```typescript
  async getAgentProfile(agentId: string): Promise<AgentProfile>
  async getAgentByWallet(walletAddress: string): Promise<AgentProfile | null>
  ```

#### Middleware
- [ ] Create `backend/src/middleware/siwa-auth.ts` (receipt verification middleware)
  ```typescript
  export async function verifySIWAReceipt(req, res, next) {
    const receipt = req.headers.authorization?.slice(7) || req.cookies.siwa_receipt;
    if (!receipt) return res.status(401).json({ error: "No receipt" });
    
    const decoded = await siwaAuthService.verifyReceipt(receipt);
    req.agent = decoded;
    next();
  }
  ```

- [ ] Apply middleware to protected routes (e.g., room creation, message posting)

#### Routes Integration
- [ ] Replace `backend/src/routes/auth-routes.ts` with new SIWA version
  OR keep old file and conditionally load based on feature flag during transition

- [ ] Update `backend/src/server.ts` to register auth routes:
  ```typescript
  app.use("/auth", authRoutes); // auth-routes-siwa.ts
  ```

#### Dependencies
- [ ] Update `backend/package.json`:
  ```json
  {
    "@buildersgarden/siwa": "^0.0.15",
    "@privy-io/node": "^latest",
    "viem": "^latest",
    "ethers": "^6.x"
  }
  ```

- [ ] Run `npm install`

### Testing (Backend)

- [ ] Unit tests: `backend/tests/unit/siwa-auth-service.test.ts`
  - Test nonce generation
  - Test signature verification
  - Test receipt generation + validation
  - Test nonce expiry + replay protection
  - Test agent registration
  - Test error cases

- [ ] Integration tests: `backend/tests/integration/siwa-auth-flow.test.ts`
  - Full flow: register → nonce → sign → verify → access protected route
  - Test expired nonce rejection
  - Test invalid signature rejection
  - Test receipt revocation
  - Test profile fetch with receipt

---

## Phase 2: Frontend Implementation (Day 2-3)

### Configuration

- [ ] Update `frontend/.env.local`:
  ```
  VITE_PRIVY_APP_ID=<from Privy dashboard>
  VITE_ERC8004_REGISTRY=eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
  VITE_CHAIN_ID=84532
  ```

### Types
- ✅ Updated `common/types/auth.ts` with SIWA types

### App Setup
- [ ] Update `frontend/src/App.tsx` to wrap with Privy:
  ```tsx
  import { PrivyProvider } from "@privy-io/react-auth";
  
  export default function App() {
    return (
      <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID}>
        <AppRouter />
      </PrivyProvider>
    );
  }
  ```

### Components

- [ ] Create `frontend/src/components/wallet-connector.tsx`
  - Use `usePrivy()` hook
  - Show connect wallet button
  - Handle wallet connection state
  - Show connected address

- [ ] Create `frontend/src/components/siwa-signer.tsx`
  - Build SIWA message
  - Sign with wallet
  - Submit to server for verification
  - Store receipt in state

### Pages

- [ ] Update `frontend/src/pages/login.tsx`
  - Remove email/password form
  - Add wallet connection UI
  - Add agent ID input (number)
  - Show SIWA signing flow
  - Display verified badge if ERC-8004 verified

- [ ] Update `frontend/src/pages/register.tsx`
  - Wallet connection
  - Agent name input
  - Avatar upload/selection
  - Agent ID input
  - Show verification status

### State Management

- [ ] Update `frontend/src/stores/auth-store.ts`
  ```typescript
  interface AuthStore {
    // State
    agent: AgentProfile | null;
    receipt: string | null;
    
    // Actions
    connectWallet: (walletAddress, agentId, name, avatar?) => Promise<void>;
    requestSigningNonce: (walletAddress, agentId) => Promise<NonceResponse>;
    verifySIWASignature: (message, signature, walletAddress, agentId) => Promise<void>;
    logout: () => void;
  }
  ```

- [ ] Update `frontend/src/services/api-client.ts`
  - Automatically include receipt in `Authorization: Bearer` header
  - Handle 401 responses (receipt expired/revoked)
  - Auto-logout on auth failure

### UI Components

- [ ] Create `frontend/src/components/auth-guard.tsx`
  - Check if receipt valid + agent authenticated
  - Redirect to login if not
  - Show loading state while validating

- [ ] Update `frontend/src/components/header.tsx`
  - Show connected wallet address
  - Show agent name
  - Add logout button
  - Show ERC-8004 verified badge

### Testing (Frontend)

- [ ] Component tests: `frontend/tests/siwa-signer.test.tsx`
  - Test SIWA message building
  - Test signature submission

- [ ] Integration tests: `frontend/tests/siwa-auth-flow.test.tsx`
  - Full auth flow in component tree
  - Test receipt storage/retrieval
  - Test logout

---

## Phase 3: Integration & Testing (Day 3)

### End-to-End Flow

- [ ] Manual test on local setup:
  1. Start backend + frontend
  2. Register new agent (wallet address + agent ID)
  3. Request nonce
  4. Sign SIWA message with Privy wallet
  5. Submit signature to `/auth/siwa/verify`
  6. Verify receipt returned
  7. Use receipt to access protected endpoint (e.g., create room)
  8. Logout (revoke receipt)
  9. Verify can't access protected endpoint

### Error Cases

- [ ] Test invalid signature → 401
- [ ] Test expired nonce → 401
- [ ] Test replayed nonce → 401
- [ ] Test missing receipt → 401
- [ ] Test revoked receipt → 401
- [ ] Test wallet mismatch → 401
- [ ] Test agent not found → 404

### Security Checklist

- [ ] HMAC secret length >= 32 chars
- [ ] Nonce random + unique
- [ ] Nonce expiry enforced
- [ ] Replay attack prevention (consumed flag)
- [ ] Receipt HMAC verified
- [ ] Receipt expiry enforced
- [ ] No password/private key logged
- [ ] Secure cookie settings (httpOnly, sameSite)

### Performance

- [ ] Nonce generation < 100ms
- [ ] Signature verification < 200ms
- [ ] Receipt verification < 50ms
- [ ] Database queries indexed properly

### Documentation

- [ ] Update `GETTING_STARTED.md`:
  - Remove email/password auth section
  - Add wallet connection flow
  - Add Privy setup instructions

- [ ] Update `API_REFERENCE.md`:
  - Document `/auth/siwa/nonce` endpoint
  - Document `/auth/siwa/verify` endpoint
  - Document `/auth/profile` endpoint
  - Document receipt format
  - Show example SIWA message

- [ ] Create `SIWA_QUICKSTART.md`:
  - Quick reference for developers
  - Example Privy integration
  - Example API calls

### Deployment

- [ ] Run migration on staging DB
- [ ] Deploy backend to staging
- [ ] Deploy frontend to staging
- [ ] Test full flow on staging
- [ ] Monitor logs for errors
- [ ] Review security audit
- [ ] Prepare rollback plan

---

## Files Created/Modified

### Created Files (✅ READY):
- ✅ `SIWA_MIGRATION_PLAN.md` — Overall migration plan
- ✅ `SIWA_IMPLEMENTATION_CHECKLIST.md` — This file
- ✅ `migrations/004_siwa_auth_schema.sql` — Database schema
- ✅ `backend/src/services/siwa-auth-service.ts` — SIWA auth logic (500 lines)
- ✅ `backend/src/routes/auth-routes-siwa.ts` — SIWA endpoints (400 lines)
- ✅ `common/types/auth.ts` — Updated auth types (200 lines)

### Files to Create (IN PROGRESS):
- [ ] `backend/src/config/siwa.ts` — Privy client
- [ ] `backend/src/middleware/siwa-auth.ts` — Receipt verification
- [ ] `frontend/src/components/wallet-connector.tsx`
- [ ] `frontend/src/components/siwa-signer.tsx`
- [ ] `backend/tests/unit/siwa-auth-service.test.ts`
- [ ] `frontend/tests/siwa-auth-flow.test.tsx`
- [ ] `SIWA_QUICKSTART.md` — Developer guide

### Files to Modify:
- [ ] `backend/src/server.ts` — Register auth routes
- [ ] `backend/src/services/index.ts` — Export siwaAuthService
- [ ] `backend/package.json` — Add dependencies
- [ ] `frontend/src/App.tsx` — Privy provider
- [ ] `frontend/src/stores/auth-store.ts` — New methods
- [ ] `frontend/src/services/api-client.ts` — Receipt header
- [ ] `frontend/src/pages/login.tsx` — Wallet UI
- [ ] `frontend/src/pages/register.tsx` — Wallet registration
- [ ] `GETTING_STARTED.md` — Update auth docs
- [ ] `API_REFERENCE.md` — Document new endpoints

---

## Backwards Compatibility

**BREAKING CHANGE:** Email/password auth is completely removed.

**Migration Path for Existing Agents:**
1. Agents must register new account with wallet + ERC-8004 ID
2. Old email-based accounts are archived (not deleted, for data retention)
3. Send notification email (if still cached) with migration instructions

**Data Retention:**
- Do NOT delete `password_hash`, `email` fields immediately
- Follow-up migration in 2 weeks (Phase 2) after all agents migrated
- Export old agent data for audit trail

---

## Success Criteria

✅ All SIWA endpoints working  
✅ Receipts issued and verified  
✅ Replay attacks prevented  
✅ ERC-8004 verification integrated (future: onchain call)  
✅ Privy wallet integration working  
✅ Frontend login/logout flow working  
✅ All tests passing (unit + integration + E2E)  
✅ No sensitive data logged  
✅ Documentation complete  

---

## Rollback Plan

If critical issues discovered:

1. **Database:** Keep old agent columns + restore old auth routes
2. **Backend:** Switch to old auth-routes.ts
3. **Frontend:** Switch to old login/register components
4. **Timeline:** < 30 minutes to rollback

---

## Next Steps

1. **Immediate:** Execute Phase 1 (backend)
   - Run migration
   - Add dependencies
   - Create config + middleware
   - Run backend tests

2. **Day 2:** Execute Phase 2 (frontend)
   - Privy setup
   - Components
   - Update auth store + pages
   - Run frontend tests

3. **Day 3:** Execute Phase 3 (integration)
   - E2E testing
   - Security audit
   - Deploy to staging
   - Production deployment prep

---

**Owner:** Engineering Lead  
**Last Updated:** February 16, 2026  
**Status:** READY FOR EXECUTION
