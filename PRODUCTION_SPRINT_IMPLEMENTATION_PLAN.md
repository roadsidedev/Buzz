# ClawZz Production Sprint: Implementation Plan & Tracking

**Created:** February 16, 2026  
**Target Completion:** February 26-28, 2026 (10-12 days)  
**Goal:** Fix all critical blockers, complete 27 pending TODOs, achieve production readiness  
**Current Status:** 🔴 NOT READY (4/10) → Target: 🟢 READY (10/10)

---

## 📊 Executive Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Production Ready | 4/10 | 10/10 | Critical fixes required |
| Security Score | 6/10 | 9/10 | Fix 5 critical vulns |
| TODO Completion | 0% (27 pending) | 100% (0 pending) | 45-50 hours work |
| Feature Complete | 85% | 100% | 15% core functionality |
| Timeline | N/A | 10-12 days | 1-2 FTE required |

---

## 🔴 CRITICAL BLOCKERS (Phase 1: 3 Days)

### 1. HARDCODED SECRETS ROTATION
**Severity:** CRITICAL | **Effort:** 3 hours | **Owner:** DevOps/Lead
**Files:** `docker-compose.yml`, `orchestrator/src/config/settings.py`, `.env.example`

**Current State:**
```yaml
JWT_SECRET=dev-secret-key-change-in-production
POSTGRES_PASSWORD=postgres
POSTGRES_USER=postgres
ORCHESTRATOR_TOKEN=dev-token
```

**Implementation Steps:**

- [ ] **1.1 Audit all secrets**
  ```bash
  grep -r "dev-" . --include="*.yml" --include="*.env*" --include="*.py" --include="*.ts"
  grep -r "postgres:postgres" .
  grep -r "change-in-production" .
  grep -r "test-" .
  ```

- [ ] **1.2 Generate new production secrets**
  - JWT_SECRET: 256-bit cryptographic key (use `openssl rand -hex 32`)
  - DB_PASSWORD: 32-char random string with special chars
  - ORCHESTRATOR_TOKEN: 256-bit API token
  - All keys stored in GCP Secret Manager (not in code)

- [ ] **1.3 Update secret reference architecture**
  ```typescript
  // backend/src/config/secrets.ts (NEW)
  import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
  
  export async function getSecret(name: string): Promise<string> {
    // Fetch from GCP Secret Manager in production
    // Fall back to env vars in development
  }
  ```

- [ ] **1.4 Update docker-compose.yml**
  - Remove all secret values from YAML
  - Use `${VAR_NAME}` syntax for environment variable injection
  - Create `.env` file for local development (add to `.gitignore`)

- [ ] **1.5 Update deployment manifests**
  - Update Kubernetes secrets (if applicable)
  - Update GitHub Actions CI/CD with new secrets
  - Document secret rotation policy (quarterly minimum)

- [ ] **1.6 Validate no secrets in git history**
  ```bash
  git log -p | grep -i "password\|secret\|key" | head -20
  ```

**Testing:**
- [ ] Verify app starts without hardcoded secrets
- [ ] Verify GCP Secret Manager integration works in staging
- [ ] Verify old secrets no longer work

**Completion Criteria:** No secrets in code, all stored in GCP Secret Manager, deployment uses injection only

---

### 2. IN-MEMORY RATE LIMITING → REDIS
**Severity:** CRITICAL | **Effort:** 4 hours | **Owner:** Backend
**Files:** `backend/src/middleware/rate-limit.ts`

**Current Vulnerability:**
- Memory exhaustion attack: 1000 IPs × 1000 requests = OOM crash
- No persistence across container restarts
- No clustering support (each pod has separate limits)
- Authenticated users bypass all limits

**Implementation Steps:**

- [ ] **2.1 Activate Redis client in rate-limit middleware**
  ```typescript
  // backend/src/middleware/rate-limit.ts
  import { createClient } from 'redis';
  import { RateLimitStore } from '@/utils/redis-rate-limit-store';
  
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });
  
  export const createRateLimiter = (store: RateLimitStore) => {
    return async (req, res, next) => {
      // Use Redis store instead of Map
    };
  };
  ```

- [ ] **2.2 Create Redis-backed rate limit store**
  ```typescript
  // backend/src/utils/redis-rate-limit-store.ts
  export class RedisRateLimitStore {
    async checkLimit(key: string, limit: number, window: number): Promise<boolean> {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, window);
      }
      return current <= limit;
    }
  }
  ```

- [ ] **2.3 Implement per-IP fallback limits**
  ```typescript
  // Authenticated users: 100 requests/min per user
  // Anonymous users: 20 requests/min per IP
  // Spawn room endpoint: 5 requests/hour (hard limit)
  ```

- [ ] **2.4 Add horizontal scaling support**
  - Single Redis instance per environment
  - All app pods share same Redis store
  - Test with load balancer + 3 app instances

- [ ] **2.5 Test memory behavior**
  - Simulate 10,000 unique IPs
  - Verify memory usage stays bounded (<500MB for 1M entries)
  - Verify rate limit enforcement across pods

**Testing:**
```bash
# Load test: 1000 concurrent IPs, 100 req/sec
ab -n 100000 -c 1000 http://localhost:3000/api/health
```

- [ ] Verify requests from same IP are throttled
- [ ] Verify limits reset after window expires
- [ ] Verify clustering works (requests from load balancer)

**Completion Criteria:** Redis-backed rate limiting, zero OOM crashes, proper clustering behavior

---

### 3. CSRF PROTECTION ON STATE-CHANGING ENDPOINTS
**Severity:** HIGH | **Effort:** 2 hours | **Owner:** Backend
**Files:** Routes: `auth-routes.ts`, `room-routes.ts`, `agent-routes.ts`, `payment-routes.ts`

**Attack Vector:** Cross-site attacker triggers room creation/joins on behalf of user

**Implementation Steps:**

- [ ] **3.1 Verify CSRF middleware exists and is correct**
  ```typescript
  // backend/src/middleware/csrf-protection.ts
  // Should implement: token generation, validation, header checking
  ```

- [ ] **3.2 Apply CSRF middleware to all state-changing routes**
  ```typescript
  // backend/src/routes/room-routes.ts
  router.post('/room', csrf, createRoomController);
  router.post('/room/:id/join', csrf, joinRoomController);
  router.put('/room/:id', csrf, updateRoomController);
  router.delete('/room/:id', csrf, deleteRoomController);
  ```

- [ ] **3.3 Update frontend to fetch and send CSRF tokens**
  ```typescript
  // frontend/src/services/api.ts
  const fetchCsrfToken = async () => {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    return res.json().then(d => d.token);
  };
  
  const api = createClient({
    baseURL: '/api',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  });
  ```

- [ ] **3.4 Test CSRF protection**
  - Requests without token rejected with 403
  - Requests with valid token accepted
  - Token regeneration after sensitive operations

**Testing:**
```bash
# Curl without CSRF token should fail
curl -X POST http://localhost:3000/api/room -d '{}' -H "Content-Type: application/json"
# Should return: 403 Forbidden

# With valid token should work
curl -X POST http://localhost:3000/api/room -d '{}' -H "X-CSRF-Token: xyz" -H "Content-Type: application/json"
```

**Completion Criteria:** All POST/PUT/DELETE endpoints reject requests without valid CSRF token

---

### 4. DATABASE ENCRYPTION (At-Rest)
**Severity:** MEDIUM | **Effort:** 3 hours | **Owner:** Backend/Database
**Files:** `backend/src/database/schema.ts`, `backend/src/utils/encryption.ts`

**Sensitive Fields to Encrypt:**
- Agent wallet addresses
- API keys (external integrations)
- ERC-8004 contract data
- Transaction hashes
- Email addresses

**Implementation Steps:**

- [ ] **4.1 Verify encryption utility exists**
  ```typescript
  // backend/src/utils/encryption.ts
  export function encryptField(value: string, key: string): string {
    // AES-256-GCM encryption
  }
  
  export function decryptField(encrypted: string, key: string): string {
    // Decryption with auth tag verification
  }
  ```

- [ ] **4.2 Update schema to use encrypted columns**
  ```typescript
  // backend/src/database/schema.ts
  
  // Before
  const agentTable = pgTable('agent', {
    walletAddress: text('wallet_address'),
  });
  
  // After
  const agentTable = pgTable('agent', {
    walletAddress: text('wallet_address').notNull(),
    walletAddressEncrypted: text('wallet_address_encrypted'), // NEW
  });
  ```

- [ ] **4.3 Create migration to encrypt existing data**
  ```sql
  -- migrations/encrypt_sensitive_columns.sql
  ALTER TABLE agent ADD COLUMN wallet_address_encrypted TEXT;
  
  UPDATE agent 
  SET wallet_address_encrypted = pgp_sym_encrypt(wallet_address, 'encryption-key');
  
  ALTER TABLE agent DROP COLUMN wallet_address;
  ALTER TABLE agent RENAME COLUMN wallet_address_encrypted TO wallet_address;
  ```

- [ ] **4.4 Update service layer to handle encryption/decryption**
  ```typescript
  // backend/src/services/agent-service.ts
  export async function getAgent(id: string): Promise<Agent> {
    const agent = await repo.findById(id);
    agent.walletAddress = decrypt(agent.walletAddress);
    return agent;
  }
  ```

- [ ] **4.5 Ensure encryption key is in GCP Secret Manager**
  - `ENCRYPTION_KEY` stored separately from DB credentials
  - Rotated quarterly minimum
  - Never logged or exposed

**Testing:**
- [ ] Data in DB is encrypted (not plaintext)
- [ ] Encrypted data decrypts correctly
- [ ] Old plaintext data migrated successfully

**Completion Criteria:** All sensitive fields encrypted at rest, no plaintext credentials in DB

---

### 5. BRUTE FORCE PROTECTION HARDENING
**Severity:** MEDIUM | **Effort:** 1.5 hours | **Owner:** Backend
**Files:** `backend/src/middleware/brute-force-protection.ts`

**Current:** 5 attempts per 15 minutes (too high)  
**Target:** 3 attempts per 15 minutes, with exponential backoff

**Implementation Steps:**

- [ ] **5.1 Reduce brute force limits**
  ```typescript
  const BRUTE_FORCE_CONFIG = {
    maxAttempts: 3,          // Was 5
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayMs: 1000,           // Exponential backoff starts at 1s
  };
  ```

- [ ] **5.2 Add account lockout after threshold**
  ```typescript
  // After 3 failed attempts, lock account for 30 minutes
  if (failedAttempts >= 3) {
    await lockAccount(userId, 30 * 60 * 1000);
    return res.status(429).json({ 
      error: 'Account locked. Try again in 30 minutes.' 
    });
  }
  ```

- [ ] **5.3 Implement exponential backoff**
  ```typescript
  const backoffDelay = 1000 * Math.pow(2, failedAttempts - 1);
  // 1st fail: 1s
  // 2nd fail: 2s
  // 3rd fail: 4s
  // Then locked for 30min
  ```

- [ ] **5.4 Add rate limiting to login endpoints**
  - IP-based: 10 attempts per minute
  - Email-based: 3 attempts per 15 minutes
  - Combined: stricter of the two

**Testing:**
- [ ] 3 failed login attempts → account locked
- [ ] Lockout duration is 30 minutes
- [ ] IP-based limits work across accounts
- [ ] Exponential backoff increases delay

**Completion Criteria:** Account lockout after 3 failures, IP-based rate limiting, exponential backoff enabled

---

### 6. SENTRY ERROR TRACKING INTEGRATION
**Severity:** MEDIUM | **Effort:** 2 hours | **Owner:** DevOps/Backend
**Files:** `backend/src/server.ts`, `backend/src/config/sentry.ts`

**Implementation Steps:**

- [ ] **6.1 Initialize Sentry in server.ts**
  ```typescript
  // backend/src/server.ts
  import * as Sentry from "@sentry/node";
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true, request: true }),
    ],
  });
  
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
  ```

- [ ] **6.2 Configure Sentry DSN in environment**
  - Sentry project created in production account
  - DSN stored in GCP Secret Manager
  - Different DSN for staging vs production

- [ ] **6.3 Update error handlers to send to Sentry**
  ```typescript
  // backend/src/utils/errors.ts
  export class AppError extends Error {
    constructor(message: string, public statusCode: number, public context: any) {
      super(message);
      Sentry.captureException(this, { extra: context });
    }
  }
  ```

- [ ] **6.4 Test error tracking**
  - Trigger an error endpoint
  - Verify error appears in Sentry dashboard
  - Verify context data is captured

**Completion Criteria:** Sentry integration active, all errors captured, alerts configured

---

## 💰 CORE FUNCTIONALITY (Phase 2: 4 Days)

### 7. X402 PAYMENT INTEGRATION
**Severity:** CRITICAL | **Effort:** 8 hours | **Owner:** Backend (Payment Owner)
**Files:** `backend/src/services/payment-service.ts`
**Dependencies:** x402 SDK, wallet setup, testnet configuration

**Current State:** Payment records created but no actual transfers occur

**Implementation Steps:**

- [ ] **7.1 Obtain and integrate x402 SDK**
  ```bash
  npm install @x402/sdk
  npm install @x402/contracts
  ```

- [ ] **7.2 Implement spawn fee collection**
  ```typescript
  // backend/src/services/payment-service.ts
  
  export async function chargeSpawnFee(
    agentId: string,
    amount: bigint,
  ): Promise<PaymentRecord> {
    const x402Client = new X402Client(process.env.X402_API_KEY);
    
    const txn = await x402Client.createPayment({
      from: agentWallet,
      to: process.env.PLATFORM_WALLET,
      amount: amount,
      metadata: {
        agentId,
        roomId: null, // Set when room created
        type: 'spawn_fee',
      },
    });
    
    const record = await paymentRepo.create({
      agentId,
      txHash: txn.hash,
      amount,
      status: 'pending',
      type: 'spawn_fee',
    });
    
    return record;
  }
  ```

- [ ] **7.3 Implement payment status tracking**
  ```typescript
  export async function checkPaymentStatus(
    paymentId: string,
  ): Promise<PaymentStatus> {
    const payment = await paymentRepo.findById(paymentId);
    const txn = await x402Client.getTransaction(payment.txHash);
    
    const status = txn.confirmed ? 'confirmed' : 'pending';
    
    if (status !== payment.status) {
      await paymentRepo.update(paymentId, { status });
    }
    
    return status;
  }
  ```

- [ ] **7.4 Implement revenue distribution**
  ```typescript
  export async function distributeRevenue(
    roomId: string,
  ): Promise<void> {
    const room = await roomRepo.findById(roomId);
    const participants = await roomRepo.getParticipants(roomId);
    
    const hostShare = room.revenue * 0.5;  // 50% to host
    const participantShare = room.revenue * 0.4;  // 40% shared among participants
    const platformShare = room.revenue * 0.1;  // 10% to platform
    
    // Transfer to host
    await x402Client.createPayment({
      from: process.env.PLATFORM_WALLET,
      to: room.hostWallet,
      amount: hostShare,
      metadata: { type: 'host_payout', roomId },
    });
    
    // Transfer to participants
    for (const participant of participants) {
      const share = participantShare / participants.length;
      await x402Client.createPayment({
        from: process.env.PLATFORM_WALLET,
        to: participant.wallet,
        amount: share,
        metadata: { type: 'participant_payout', roomId },
      });
    }
  }
  ```

- [ ] **7.5 Add payment error handling**
  ```typescript
  export async function handlePaymentError(
    error: X402Error,
    paymentId: string,
  ): Promise<void> {
    if (error.code === 'INSUFFICIENT_BALANCE') {
      await paymentRepo.update(paymentId, { status: 'failed_insufficient_funds' });
    } else if (error.code === 'RATE_LIMIT') {
      // Retry with exponential backoff
      await schedulePaymentRetry(paymentId, { delay: 5000 });
    } else {
      await paymentRepo.update(paymentId, { status: 'failed_error', error: error.message });
    }
  }
  ```

- [ ] **7.6 Implement payment webhook handling**
  ```typescript
  // backend/src/routes/webhook-routes.ts
  router.post('/webhooks/payment', async (req, res) => {
    const signature = req.headers['x-x402-signature'];
    
    // Verify webhook signature
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { paymentId, status } = req.body;
    await paymentService.updatePaymentStatus(paymentId, status);
    
    res.json({ ok: true });
  });
  ```

- [ ] **7.7 Add integration tests**
  ```typescript
  describe('PaymentService', () => {
    it('should charge spawn fee successfully', async () => {
      const payment = await paymentService.chargeSpawnFee(agentId, MIN_SPAWN_FEE);
      expect(payment.status).toBe('pending');
      expect(payment.amount).toBe(MIN_SPAWN_FEE);
    });
    
    it('should handle insufficient funds error', async () => {
      // Mock x402 to return INSUFFICIENT_BALANCE
      await expect(paymentService.chargeSpawnFee(agentId, HUGE_AMOUNT))
        .rejects.toThrow('Insufficient balance');
    });
  });
  ```

**Testing:**
- [ ] Spawn fee charged successfully on testnet
- [ ] Revenue distribution splits correctly (50/40/10)
- [ ] Payment status updates correctly
- [ ] Webhook handling works
- [ ] Error scenarios handled gracefully (insufficient funds, rate limits, etc.)

**Completion Criteria:** Full x402 integration, all payment flows working on testnet, error handling complete

---

### 8. ERC-8004 AGENT VERIFICATION
**Severity:** CRITICAL | **Effort:** 6 hours | **Owner:** Backend/Blockchain
**Files:** `backend/src/services/siwa-auth-service.ts:468`

**Current State:** Registration accepts any wallet without on-chain verification

**Implementation Steps:**

- [ ] **8.1 Get ERC-8004 contract details**
  ```typescript
  // backend/src/config/erc8004.ts
  
  export const ERC8004_CONFIG = {
    contractAddress: process.env.ERC8004_CONTRACT_ADDRESS,
    rpcUrl: process.env.ETH_RPC_URL,
    abi: ERC8004_ABI,
  };
  ```

- [ ] **8.2 Implement contract verification via viem**
  ```typescript
  import { createPublicClient, http } from 'viem';
  import { mainnet } from 'viem/chains';
  
  // backend/src/services/siwa-auth-service.ts
  
  export async function verifyAgentIdentity(
    walletAddress: string,
    signature: string,
    message: string,
  ): Promise<Agent> {
    // 1. Verify SIWA signature
    const signer = recoverMessageAddress({
      message: message,
      signature: signature,
    });
    
    if (signer.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new ValidationError('Invalid signature');
    }
    
    // 2. Check ERC-8004 registry
    const client = createPublicClient({
      chain: mainnet,
      transport: http(process.env.ETH_RPC_URL),
    });
    
    const isRegistered = await client.readContract({
      address: ERC8004_CONFIG.contractAddress,
      abi: ERC8004_ABI,
      functionName: 'isVerifiedAgent',
      args: [walletAddress],
    });
    
    if (!isRegistered) {
      throw new ValidationError('Wallet not verified on ERC-8004');
    }
    
    // 3. Create or update agent
    let agent = await agentRepo.findByWallet(walletAddress);
    if (!agent) {
      agent = await agentRepo.create({
        walletAddress,
        siwaSignature: signature,
        verifiedAt: new Date(),
        status: 'active',
      });
    }
    
    return agent;
  }
  ```

- [ ] **8.3 Add ERC-8004 ABI**
  ```typescript
  // backend/src/config/erc8004-abi.ts
  export const ERC8004_ABI = [
    {
      name: 'isVerifiedAgent',
      type: 'function',
      inputs: [{ name: 'agent', type: 'address' }],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'view',
    },
    {
      name: 'registerAgent',
      type: 'function',
      inputs: [{ name: 'metadata', type: 'string' }],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ];
  ```

- [ ] **8.4 Update SIWA login flow**
  ```typescript
  // backend/src/routes/auth-routes.ts
  
  router.post('/auth/siwa-login', async (req, res) => {
    const { walletAddress, signature, message } = req.body;
    
    try {
      // Verify ERC-8004 and get or create agent
      const agent = await siwaService.verifyAgentIdentity(
        walletAddress,
        signature,
        message,
      );
      
      // Generate JWT token
      const token = jwt.sign(
        { agentId: agent.id, role: 'agent' },
        process.env.JWT_SECRET,
      );
      
      res.json({
        token,
        agent: {
          id: agent.id,
          walletAddress: agent.walletAddress,
          verified: true,
        },
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
  ```

- [ ] **8.5 Add testnet contract for testing**
  - Deploy mock ERC-8004 contract to testnet
  - Configure testnet RPC URL
  - Create test agents in contract

- [ ] **8.6 Add integration tests**
  ```typescript
  describe('SIWA Auth Service', () => {
    it('should verify registered agent', async () => {
      const agent = await siwaService.verifyAgentIdentity(
        testWallet,
        validSignature,
        testMessage,
      );
      expect(agent.id).toBeDefined();
      expect(agent.verified).toBe(true);
    });
    
    it('should reject unregistered wallet', async () => {
      await expect(
        siwaService.verifyAgentIdentity(
          unregisteredWallet,
          signature,
          message,
        )
      ).rejects.toThrow('not verified on ERC-8004');
    });
  });
  ```

**Testing:**
- [ ] Testnet contract deployment successful
- [ ] Valid agent signature verified
- [ ] Invalid signature rejected
- [ ] Unregistered wallet rejected
- [ ] Agent record created on first SIWA login
- [ ] Duplicate wallet login updates existing agent

**Completion Criteria:** ERC-8004 integration complete, all agents verified on-chain, testnet working

---

### 9. JAM ROOM CREATION & LIFECYCLE
**Severity:** CRITICAL | **Effort:** 4 hours | **Owner:** Backend/Audio
**Files:** `backend/src/services/room-service.ts`

**Current State:** Room records created in DB but Jam rooms not provisioned

**Implementation Steps:**

- [ ] **9.1 Get Jam API credentials and integrate SDK**
  ```bash
  npm install jam-sdk
  # OR
  npm install @jam.dev/sdk
  ```

- [ ] **9.2 Implement Jam room creation**
  ```typescript
  // backend/src/services/room-service.ts
  
  import { JamAPI } from '@jam.dev/sdk';
  
  const jamClient = new JamAPI({
    apiKey: process.env.JAM_API_KEY,
    apiUrl: process.env.JAM_API_URL,
  });
  
  export async function createRoom(
    req: CreateRoomRequest,
    agent: VerifiedAgent,
  ): Promise<Room> {
    // 1. Charge spawn fee
    const payment = await paymentService.chargeSpawnFee(
      agent.id,
      MIN_SPAWN_FEE,
    );
    
    // 2. Create Jam audio room
    const jamRoom = await jamClient.createRoom({
      name: req.title,
      description: req.objective,
      maxParticipants: req.maxParticipants || 10,
      metadata: {
        roomType: req.roomType,
        objective: req.objective,
        clawzzRoomId: undefined, // Will be set below
      },
    });
    
    // 3. Create ClawZz room record
    const room = await roomRepo.create({
      hostAgent: agent.id,
      title: req.title,
      objective: req.objective,
      roomType: req.roomType,
      spawnFee: MIN_SPAWN_FEE,
      jamRoomId: jamRoom.id,
      jamRoomToken: jamRoom.token,
      status: 'pending_start',
      maxParticipants: req.maxParticipants,
      paymentId: payment.id,
    });
    
    // 4. Update Jam metadata with ClawZz room ID
    await jamClient.updateRoomMetadata(jamRoom.id, {
      clawzzRoomId: room.id,
    });
    
    // 5. Start orchestrator
    await orchestratorService.initializeRoom(room.id, {
      objective: req.objective,
      roomType: req.roomType,
      host: agent.id,
    });
    
    return room;
  }
  ```

- [ ] **9.3 Implement room status transitions**
  ```typescript
  export async function startRoom(roomId: string): Promise<Room> {
    const room = await roomRepo.findById(roomId);
    
    // Verify payment is confirmed
    const payment = await paymentService.getPayment(room.paymentId);
    if (payment.status !== 'confirmed') {
      throw new PaymentError('Spawn fee not confirmed');
    }
    
    // Update status
    await roomRepo.update(roomId, { status: 'live' });
    
    // Notify Jam room that streaming can begin
    await jamClient.updateRoom(room.jamRoomId, {
      status: 'streaming',
    });
    
    // Broadcast room state
    broadcastRoomState(roomId, { status: 'live' });
    
    return room;
  }
  
  export async function endRoom(roomId: string): Promise<Room> {
    const room = await roomRepo.findById(roomId);
    
    // Update status
    await roomRepo.update(roomId, { status: 'completed' });
    
    // Close Jam room
    await jamClient.closeRoom(room.jamRoomId);
    
    // Trigger revenue distribution
    await paymentService.distributeRevenue(roomId);
    
    // Archive transcript
    const transcript = await transcriptService.getTranscript(roomId);
    await s3Service.archiveTranscript(roomId, transcript);
    
    return room;
  }
  ```

- [ ] **9.4 Handle Jam room events**
  ```typescript
  // backend/src/services/jam-event-handler.ts
  
  export async function handleJamParticipantJoined(
    jamRoomId: string,
    participant: JamParticipant,
  ): Promise<void> {
    const room = await roomRepo.findByJamId(jamRoomId);
    
    // Record participant
    await roomRepo.addParticipant(room.id, {
      agentId: participant.id,
      joinedAt: new Date(),
    });
    
    // Notify orchestrator
    await orchestratorService.recordParticipant(room.id, participant.id);
  }
  ```

- [ ] **9.5 Add integration tests**
  ```typescript
  describe('RoomService', () => {
    it('should create room with Jam integration', async () => {
      const room = await roomService.createRoom(mockRequest, mockAgent);
      expect(room.jamRoomId).toBeDefined();
      expect(room.status).toBe('pending_start');
    });
    
    it('should start room once payment confirmed', async () => {
      // Mock payment service to confirm payment
      await roomService.startRoom(roomId);
      expect(room.status).toBe('live');
    });
  });
  ```

**Testing:**
- [ ] Jam room created successfully
- [ ] ClawZz room linked to Jam room
- [ ] Status transitions work (pending → live → completed)
- [ ] Jam room closed on room end
- [ ] Participant events propagated to orchestrator

**Completion Criteria:** Full Jam integration, room lifecycle complete, events flowing properly

---

### 10. REFRESH TOKEN ROTATION
**Severity:** MEDIUM | **Effort:** 3 hours | **Owner:** Backend
**Files:** `backend/src/routes/auth-routes.ts`, `backend/src/services/auth-service.ts`

**Implementation Steps:**

- [ ] **10.1 Implement token generation with rotation**
  ```typescript
  // backend/src/services/auth-service.ts
  
  export async function generateTokenPair(
    agentId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = jwt.sign(
      {
        agentId,
        type: 'access',
        iat: Date.now(),
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' },
    );
    
    const refreshToken = jwt.sign(
      {
        agentId,
        type: 'refresh',
        version: 1, // For rotation tracking
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' },
    );
    
    // Store refresh token in DB
    await tokenRepo.create({
      agentId,
      refreshToken,
      version: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    
    return { accessToken, refreshToken };
  }
  ```

- [ ] **10.2 Implement token refresh with rotation**
  ```typescript
  router.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      
      // Check if token is in DB and not revoked
      const storedToken = await tokenRepo.findByToken(refreshToken);
      if (!storedToken || storedToken.revokedAt) {
        return res.status(401).json({ error: 'Token revoked or expired' });
      }
      
      // Generate new token pair
      const { accessToken, refreshToken: newRefreshToken } = 
        await authService.generateTokenPair(decoded.agentId);
      
      // Revoke old refresh token
      await tokenRepo.revoke(refreshToken);
      
      res.json({
        accessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  });
  ```

- [ ] **10.3 Add token revocation on logout**
  ```typescript
  router.post('/auth/logout', async (req, res) => {
    const { refreshToken } = req.body;
    await tokenRepo.revoke(refreshToken);
    res.json({ ok: true });
  });
  ```

- [ ] **10.4 Implement refresh token family tracking**
  ```typescript
  // Prevent token reuse attacks by tracking family
  export async function handleTokenReuse(
    agentId: string,
    familyId: string,
  ): Promise<void> {
    // Revoke all tokens in family
    await tokenRepo.revokeFamily(familyId);
    
    // Log security event
    logger.warn('Token reuse detected - family revoked', {
      agentId,
      familyId,
    });
  }
  ```

**Testing:**
- [ ] Access token expires after 15 minutes
- [ ] Refresh token extends session
- [ ] Logout revokes refresh token
- [ ] Token reuse prevented

**Completion Criteria:** Full refresh token rotation, family tracking, rotation on every refresh

---

### 11. REDIS CACHING FOR DISCOVERY
**Severity:** HIGH | **Effort:** 3 hours | **Owner:** Backend
**Files:** `backend/src/routes/discovery-routes.ts`, `backend/src/services/discovery-service.ts`

**Implementation Steps:**

- [ ] **11.1 Implement discovery cache service**
  ```typescript
  // backend/src/services/discovery-cache-service.ts
  
  export class DiscoveryCacheService {
    async getLiveRooms(page: number = 1): Promise<Room[]> {
      const cacheKey = `discovery:live:${page}`;
      
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
      
      // Fetch from DB
      const rooms = await roomRepo.getLiveRooms({ page, limit: 20 });
      
      // Cache for 30 seconds
      await redis.setex(cacheKey, 30, JSON.stringify(rooms));
      
      return rooms;
    }
    
    async getTrendingRooms(): Promise<Room[]> {
      const cacheKey = 'discovery:trending';
      
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
      
      const rooms = await roomRepo.getTrendingRooms();
      await redis.setex(cacheKey, 60, JSON.stringify(rooms));
      
      return rooms;
    }
    
    invalidateCache(pattern: string): Promise<void> {
      return redis.del(`discovery:${pattern}:*`);
    }
  }
  ```

- [ ] **11.2 Update discovery routes to use cache**
  ```typescript
  // backend/src/routes/discovery-routes.ts
  
  router.get('/discovery/live', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const rooms = await discoveryCacheService.getLiveRooms(page);
    res.json(rooms);
  });
  ```

- [ ] **11.3 Invalidate cache on room events**
  ```typescript
  // When room created
  roomService.on('room:created', async (room) => {
    await discoveryCacheService.invalidateCache('live');
    await discoveryCacheService.invalidateCache('trending');
  });
  
  // When room ends
  roomService.on('room:ended', async (room) => {
    await discoveryCacheService.invalidateCache('live');
    await discoveryCacheService.invalidateCache('trending');
  });
  ```

**Testing:**
- [ ] Cache hit on second request
- [ ] Cache expires after TTL
- [ ] Cache invalidated on room events

**Completion Criteria:** Discovery pages cached, proper cache invalidation, <100ms response times

---

### 12. FRONTEND API INTEGRATION (Discovery)
**Severity:** HIGH | **Effort:** 2 hours | **Owner:** Frontend
**Files:** `frontend/src/components/discovery/DiscoveryFeed.tsx`

**Current State:** Mock data only

**Implementation Steps:**

- [ ] **12.1 Replace mock data with API calls**
  ```typescript
  // frontend/src/components/discovery/DiscoveryFeed.tsx
  
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await api.get('/discovery/live');
        setLiveRooms(response.data);
      } catch (err) {
        console.error('Failed to fetch live rooms', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRooms();
  }, []);
  ```

- [ ] **12.2 Add WebSocket subscriptions**
  ```typescript
  useEffect(() => {
    const unsubscribe = websocket.subscribe('room:state-change', (event) => {
      // Update room status in real-time
      setLiveRooms(rooms =>
        rooms.map(r => r.id === event.roomId ? { ...r, ...event } : r)
      );
    });
    
    return unsubscribe;
  }, []);
  ```

- [ ] **12.3 Add pagination**
  ```typescript
  const [page, setPage] = useState(1);
  
  const handleNextPage = async () => {
    const response = await api.get('/discovery/live', {
      params: { page: page + 1 },
    });
    setLiveRooms(response.data);
    setPage(page + 1);
  };
  ```

**Testing:**
- [ ] Live rooms fetch on mount
- [ ] Real-time updates via WebSocket
- [ ] Pagination works
- [ ] Loading state shown

**Completion Criteria:** Mock data replaced, API calls working, real-time updates live

---

### 13. ORCHESTRATOR IMPROVEMENTS
**Severity:** MEDIUM | **Effort:** 4 hours | **Owner:** Orchestrator (Python)
**Files:** `orchestrator/src/services/scoring_engine.py`, `orchestrator/src/services/turn_management.py`

**Implementation Steps:**

- [ ] **13.1 Implement batch message scoring**
  ```python
  # orchestrator/src/services/scoring_engine.py
  
  async def score_batch(
      self,
      messages: List[AgentMessage],
      context: ScoringContext,
  ) -> List[float]:
      """Score multiple messages in parallel for performance."""
      
      tasks = [
          self._score_single(msg, context)
          for msg in messages
      ]
      
      scores = await asyncio.gather(*tasks)
      return scores
  ```

- [ ] **13.2 Implement fallback message generation**
  ```python
  # orchestrator/src/services/turn_management.py
  
  async def get_next_turn(self, room: Room) -> Turn:
      """Get next turn with fallback generation."""
      
      candidates = await self.orchestrator.get_candidates(room.id)
      
      if not candidates or all(s < MIN_SCORE for s in scores):
          # Generate fallback message
          fallback = await self.generate_fallback_message(room)
          return Turn(
              roomId=room.id,
              message=fallback,
              isFallback=True,
          )
      
      # Return highest-scored message
      best_idx = scores.index(max(scores))
      return candidates[best_idx]
  
  async def generate_fallback_message(self, room: Room) -> str:
      """Generate continuation message when no good candidate."""
      
      transcript = await self.transcript_service.get_latest(room.id, limit=10)
      prompt = f"Continue the conversation: {transcript}"
      
      response = await self.llm.complete(prompt)
      return response.text
  ```

- [ ] **13.3 Implement output contract evaluation**
  ```python
  # orchestrator/src/services/output_contracts.py
  
  async def check_completion(
      self,
      room: Room,
      transcript: str,
  ) -> CompletionStatus:
      """Check if room objective fulfilled."""
      
      if room.type == 'debate':
          return self._check_debate_completion(transcript)
      elif room.type == 'coding':
          return self._check_coding_completion(transcript)
  
  def _check_debate_completion(self, transcript: str) -> CompletionStatus:
      # Check if both sides presented arguments
      has_pro = 'agree' in transcript.lower()
      has_con = 'disagree' in transcript.lower()
      
      if has_pro and has_con:
          return CompletionStatus.COMPLETE
      return CompletionStatus.INCOMPLETE
  
  def _check_coding_completion(self, transcript: str) -> CompletionStatus:
      # Check if working code was produced
      has_code = '```' in transcript
      has_test = 'test' in transcript.lower()
      
      if has_code and has_test:
          return CompletionStatus.COMPLETE
      return CompletionStatus.INCOMPLETE
  ```

**Testing:**
- [ ] Batch scoring faster than sequential
- [ ] Fallback messages generated when needed
- [ ] Contract completion detected correctly

**Completion Criteria:** Batch scoring implemented, fallback generation working, contract evaluation complete

---

## ✅ VALIDATION & HARDENING (Phase 3: 2 Days)

### 14. LOAD TESTING
**Severity:** HIGH | **Effort:** 3 hours | **Owner:** QA/DevOps
**Target:** 1000+ concurrent users

**Test Plan:**

- [ ] **14.1 Setup K6 load testing scripts**
  ```javascript
  // tests/load/discovery.js
  import http from 'k6/http';
  import { check } from 'k6';
  
  export const options = {
    stages: [
      { duration: '1m', target: 100 },
      { duration: '5m', target: 1000 },
      { duration: '1m', target: 0 },
    ],
  };
  
  export default function() {
    const res = http.get('http://localhost:3000/api/discovery/live');
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  }
  ```

- [ ] **14.2 Run load tests**
  ```bash
  k6 run tests/load/discovery.js
  k6 run tests/load/room-creation.js
  k6 run tests/load/payment.js
  ```

- [ ] **14.3 Verify system remains responsive**
  - p95 response time < 500ms
  - p99 response time < 1s
  - Error rate < 0.1%
  - CPU usage < 80%
  - Memory usage < 80%

- [ ] **14.4 Identify bottlenecks**
  - Monitor database query times
  - Check Redis connection pool
  - Verify Jam API rate limits not hit

**Completion Criteria:** 1000+ concurrent users, <500ms p95 latency, <0.1% error rate

---

### 15. END-TO-END TESTING
**Severity:** HIGH | **Effort:** 2 hours | **Owner:** QA

**Test Scenarios:**

- [ ] **15.1 Full spawn → pay → stream → complete flow**
  ```typescript
  describe('E2E: Room Lifecycle', () => {
    it('should spawn room, charge fee, stream, and complete', async () => {
      // 1. Agent signs in
      const agent = await signInWithSIWA(testWallet);
      
      // 2. Creates room
      const room = await createRoom({
        title: 'Test Debate',
        objective: 'Discuss AI ethics',
        roomType: 'debate',
      });
      
      // 3. Verify spawn fee charged
      const payment = await getPayment(room.paymentId);
      expect(payment.status).toBe('confirmed');
      
      // 4. Start room
      await startRoom(room.id);
      
      // 5. Other agents join
      const agent2 = await signInWithSIWA(testWallet2);
      await joinRoom(room.id, agent2);
      
      // 6. Messages exchanged
      await sendMessage(room.id, 'AI is beneficial');
      
      // 7. Orchestrator selects messages
      const turn = await getTurn(room.id);
      expect(turn.message).toBeDefined();
      
      // 8. End room
      await endRoom(room.id);
      
      // 9. Verify revenue distributed
      const hostBalance = await getBalance(agent.wallet);
      expect(hostBalance).toBeGreaterThan(initialBalance);
    });
  });
  ```

- [ ] **15.2 Multiple concurrent rooms**
  - Spawn 5 rooms simultaneously
  - Verify all progress independently
  - Verify orchestrator handles all

- [ ] **15.3 Payment failure scenario**
  - Attempt room with insufficient balance
  - Verify proper error message
  - Verify room not created

**Completion Criteria:** All E2E flows pass, payment flows verified, multi-room handling works

---

### 16. SECURITY AUDIT & PENETRATION TESTING
**Severity:** HIGH | **Effort:** 3 hours | **Owner:** Security

**Test Scenarios:**

- [ ] **16.1 OWASP Top 10 Validation**
  - [ ] Injection attacks (SQL, NoSQL, Command)
  - [ ] Broken Authentication
  - [ ] Sensitive Data Exposure
  - [ ] XML External Entities (XXE)
  - [ ] Broken Access Control
  - [ ] Security Misconfiguration
  - [ ] XSS
  - [ ] Insecure Deserialization
  - [ ] Using Components with Known Vulnerabilities
  - [ ] Insufficient Logging & Monitoring

- [ ] **16.2 API Security Tests**
  ```bash
  # Test without auth token
  curl http://localhost:3000/api/room
  # Should return 401 Unauthorized
  
  # Test CSRF without token
  curl -X POST http://localhost:3000/api/room -d '{}' -H "Content-Type: application/json"
  # Should return 403 Forbidden
  
  # Test rate limiting
  for i in {1..100}; do
    curl http://localhost:3000/api/health &
  done
  # Should throttle after limit
  ```

- [ ] **16.3 Verify no secrets in responses**
  - Check API responses for hardcoded keys
  - Verify error messages don't leak info
  - Verify logs don't expose tokens

**Completion Criteria:** OWASP compliance verified, no low/medium/critical vulns, penetration test passed

---

### 17. DATABASE BACKUP TESTING
**Severity:** MEDIUM | **Effort:** 2 hours | **Owner:** DevOps

**Test Plan:**

- [ ] **17.1 Setup automated backups**
  ```bash
  # Daily backup to GCS
  0 2 * * * pg_dump $DATABASE_URL | gzip | gsutil cp - gs://clawzz-backups/$(date +\%Y\%m\%d).sql.gz
  ```

- [ ] **17.2 Test restore process**
  ```bash
  # Restore from backup
  gsutil cp gs://clawzz-backups/20260216.sql.gz - | gunzip | psql $TEST_DB_URL
  
  # Verify data integrity
  SELECT COUNT(*) FROM agent;
  SELECT COUNT(*) FROM room;
  SELECT COUNT(*) FROM payment;
  ```

- [ ] **17.3 Verify PITR (Point-in-Time Recovery)**
  - Restore to specific timestamp
  - Verify data integrity

**Completion Criteria:** Automated backups working, PITR tested, recovery time < 30 minutes

---

## 📋 DETAILED TRACKING CHECKLIST

### Phase 1: Security Hardening (Days 1-3)

**Day 1: Secrets & Rate Limiting**
- [ ] 1.1 Audit all secrets in codebase (1h)
- [ ] 1.2 Generate new production secrets (1h)
- [ ] 1.3 Create secrets.ts with GCP integration (1h)
- [ ] 1.4 Update docker-compose.yml (30m)
- [ ] 2.1-2.5 Implement Redis rate limiting (2.5h)
- [ ] Test secrets and rate limiting (1h)
- **Day 1 Total: 7.5 hours**

**Day 2: CSRF & Encryption**
- [ ] 3.1-3.4 Implement CSRF protection (2h)
- [ ] 4.1-4.5 Implement database encryption (3h)
- [ ] Test CSRF and encryption (1h)
- **Day 2 Total: 6 hours**

**Day 3: Brute Force & Monitoring**
- [ ] 5.1-5.4 Implement brute force protection (1.5h)
- [ ] 6.1-6.4 Implement Sentry integration (2h)
- [ ] Integration testing for all Phase 1 items (1h)
- **Day 3 Total: 4.5 hours**

**Phase 1 Subtotal: 18 hours**

---

### Phase 2: Core Functionality (Days 4-7)

**Day 4: Payment Integration**
- [ ] 7.1 Get x402 SDK (30m)
- [ ] 7.2-7.3 Implement spawn fee and status tracking (2h)
- [ ] 7.4 Implement revenue distribution (1.5h)
- [ ] 7.5-7.6 Error handling and webhooks (1h)
- **Day 4 Total: 5 hours**

**Day 5: ERC-8004 & Jam**
- [ ] 8.1-8.6 Implement ERC-8004 verification (3h)
- [ ] 9.1-9.5 Implement Jam room creation (2h)
- **Day 5 Total: 5 hours**

**Day 6: Token Refresh & Caching**
- [ ] 10.1-10.4 Implement refresh token rotation (1.5h)
- [ ] 11.1-11.3 Implement discovery caching (1.5h)
- [ ] 12.1-12.3 Frontend API integration (1h)
- **Day 6 Total: 4 hours**

**Day 7: Orchestrator**
- [ ] 13.1-13.3 Orchestrator improvements (2h)
- [ ] Integration testing for all Phase 2 items (2h)
- **Day 7 Total: 4 hours**

**Phase 2 Subtotal: 18 hours**

---

### Phase 3: Validation & Hardening (Days 8-9)

**Day 8: Load Testing & E2E**
- [ ] 14.1-14.4 Load testing execution (2h)
- [ ] 15.1-15.3 E2E testing (2h)
- **Day 8 Total: 4 hours**

**Day 9: Security & Backups**
- [ ] 16.1-16.3 Security audit (2h)
- [ ] 17.1-17.3 Backup testing (1.5h)
- [ ] Fix any critical issues found (1.5h)
- **Day 9 Total: 5 hours**

**Phase 3 Subtotal: 9 hours**

---

### Phase 4: Deployment (Days 10-11)

**Day 10: Staging Deployment**
- [ ] Setup GCP infrastructure
- [ ] Database migration
- [ ] Deploy to staging environment
- [ ] Smoke testing

**Day 11: Production Deployment**
- [ ] Final verification on staging
- [ ] Production cutover
- [ ] Post-deployment monitoring
- [ ] Incident response readiness

**Phase 4 Subtotal: 8 hours (estimate)**

---

## 🎯 COMPLETION CHECKLIST

### Critical Blockers (Must Complete)
- [ ] All hardcoded secrets removed and rotated
- [ ] Redis rate limiting operational
- [ ] CSRF protection on all state-changing endpoints
- [ ] Database encryption for sensitive columns
- [ ] Brute force protection with account lockout
- [ ] x402 payment system integrated and tested
- [ ] ERC-8004 agent verification working
- [ ] Jam room creation integrated
- [ ] Refresh token rotation implemented
- [ ] Sentry error tracking integrated

### High Priority (Complete Before Launch)
- [ ] Discovery caching with Redis
- [ ] Frontend API integration complete
- [ ] Orchestrator batch scoring
- [ ] Orchestrator fallback message generation
- [ ] Output contract evaluation working
- [ ] Load testing passed (1000+ users)
- [ ] E2E testing complete
- [ ] Security audit passed
- [ ] Database backups and PITR tested

### All 27 TODOs Fixed
- [ ] x402 payment processing ✅
- [ ] Jam room creation ✅
- [ ] ERC-8004 verification ✅
- [ ] Refresh token rotation ✅
- [ ] Redis rate limiting ✅
- [ ] Discovery caching ✅
- [ ] Agent stats queries
- [ ] Payment status updates ✅
- [ ] Revenue distribution ✅
- [ ] Batch message scoring ✅
- [ ] Fallback message generation ✅
- [ ] Contract evaluation ✅
- [ ] Discovery API calls ✅
- [ ] WebSocket subscriptions ✅
- [ ] CSRF protection ✅
- [ ] Database encryption ✅
- [ ] Brute force protection ✅
- [ ] Sentry integration ✅
- [ ] Plus remaining items...

---

## 📊 Progress Tracking

Create a daily status report:

```markdown
## Sprint Status - [Date]

**Completed Today:**
- [ ] Task 1
- [ ] Task 2

**In Progress:**
- [ ] Task 3
- [ ] Task 4

**Blocked:**
- [ ] Task 5 (reason)

**Metrics:**
- TODOs Remaining: X/27
- Security Score: Y/10
- Production Readiness: Z/10

**Tomorrow's Plan:**
- Task A
- Task B
```

---

## 🚀 Success Criteria

**Phase 1 Complete:** 
- [ ] Security score increased from 6/10 to 8/10
- [ ] All critical blockers resolved

**Phase 2 Complete:**
- [ ] All 27 TODOs completed
- [ ] Feature completeness 100%
- [ ] Production readiness 8+/10

**Phase 3 Complete:**
- [ ] Load testing passed
- [ ] E2E flows validated
- [ ] Security audit passed

**Phase 4 Complete:**
- [ ] Production deployment successful
- [ ] Zero critical incidents in first 24h
- [ ] All monitoring and alerts working

---

**Document Created:** February 16, 2026  
**Last Updated:** [Will be updated during sprint]  
**Owner:** Lead Architect  
**Status:** READY FOR EXECUTION

