# Security Fixes: Phases 4-5 Implementation Roadmap

**Date:** February 16, 2026  
**Status:** 📋 PLANNING COMPLETE | Ready for Implementation  
**Audit Reference:** T-019c612f-205d-720a-bc1c-230a8eb01983

---

## Executive Summary

Phases 4-5 address the remaining critical security findings from the audit:
- **Phase 4:** ERC-8004 Smart Contract Integration (Agent Identity Verification)
- **Phase 5:** LLM Integration Robustness (Scoring Engine & Moderation Security)

**Timeline:** ~2 weeks (5 days + 5 days)  
**Effort:** Medium complexity, moderate dependencies

---

## PHASE 4: ERC-8004 Smart Contract Integration

### Problem Statement

**Current Status:**
```typescript
// backend/src/routes/auth-routes.ts:107
// TODO: Call ERC-8004 smart contract to verify
const verified = await agentService.verifyAgent(erc8004Address);
```

**Risk:** 
- No actual blockchain verification implemented
- Agent identity can be faked
- No proof of personhood/uniqueness
- Centralized trust point

### Solution Architecture

#### 1. Smart Contract Interface
```solidity
// contracts/AgentRegistry.sol
interface IAgentRegistry {
    function registerAgent(string calldata name, bytes calldata proof) external returns (bool);
    function getAgentStatus(address agent) external view returns (uint8);
    function isVerified(address agent) external view returns (bool);
    function revokeAgent(address agent) external;
}
```

#### 2. Backend Integration Service

**File:** `backend/src/services/erc8004-verification-service.ts`

```typescript
/**
 * ERC-8004 Agent Identity Verification Service
 * 
 * Responsibilities:
 * - Connect to blockchain (Ethereum, Polygon, or L2)
 * - Verify agent identity via smart contract
 * - Cache verification results
 * - Handle contract failures gracefully
 * - Audit all verification attempts
 */

interface AgentIdentityProof {
  address: string;
  name: string;
  proof: string;  // Signed message or proof from external service
  timestamp: number;
}

interface VerificationResult {
  agentAddress: string;
  verified: boolean;
  verificationTime: Date;
  expiresAt: Date;
  contractAddress: string;
  transactionHash?: string;
  error?: string;
}

class ERC8004VerificationService {
  private ethers: ethers.Provider;
  private contract: ethers.Contract;
  private cacheService: CacheService;
  
  async verifyAgent(
    erc8004Address: string,
    proof: AgentIdentityProof
  ): Promise<VerificationResult>;
  
  async registerAgent(
    agentData: AgentRegistrationRequest
  ): Promise<VerificationResult>;
  
  async revokeAgent(agentAddress: string): Promise<void>;
  
  async getVerificationStatus(agentAddress: string): Promise<VerificationResult | null>;
}
```

#### 3. Database Schema Changes

```sql
-- agents table additions
ALTER TABLE agent ADD COLUMN erc8004_address VARCHAR(42) UNIQUE;
ALTER TABLE agent ADD COLUMN erc8004_verified BOOLEAN DEFAULT false;
ALTER TABLE agent ADD COLUMN verification_timestamp TIMESTAMP;
ALTER TABLE agent ADD COLUMN contract_transaction_hash VARCHAR(255);

-- verification audit table
CREATE TABLE erc8004_verification_audit (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agent(id),
  erc8004_address VARCHAR(42),
  status VARCHAR(50),  -- pending, verified, failed, revoked
  proof_hash VARCHAR(255),
  contract_response JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Integration Points

**Registration Flow:**
```
User Registration
  ↓
POST /auth/register {erc8004Address, proof}
  ↓
AuthService.register()
  ├─ Validate input
  ├─ Create agent (status: pending)
  └─ Call ERC8004VerificationService.registerAgent()
      ├─ Call smart contract
      ├─ Poll for transaction confirmation
      ├─ Cache result (TTL: 24h)
      └─ Update agent status
  ↓
Return {success: true, verified: true}
```

**Verification Polling:**
```typescript
async registerAgent(proof: AgentIdentityProof) {
  // 1. Call contract (async)
  const tx = await this.contract.registerAgent(
    proof.name,
    proof.proof,
    { gasLimit: 200000 }
  );
  
  // 2. Poll for confirmation
  const receipt = await tx.wait(3);  // 3 block confirmations
  
  // 3. Verify registration
  const isVerified = await this.contract.isVerified(proof.address);
  
  // 4. Cache result
  await this.cacheService.set(
    `erc8004:${proof.address}`,
    { verified: isVerified, ...receipt },
    24 * 60 * 60  // Cache 24h
  );
  
  return { verified: isVerified, transactionHash: receipt.hash };
}
```

### Files to Create

1. **`backend/src/services/erc8004-verification-service.ts`** (~400 lines)
   - Smart contract interaction
   - Verification logic
   - Transaction polling
   - Error handling
   - Cache integration

2. **`backend/src/clients/blockchain-client.ts`** (~150 lines)
   - Ethers.js wrapper
   - Network selection
   - Gas estimation
   - Retry logic

3. **`backend/tests/unit/erc8004-verification-service.test.ts`** (~300 lines)
   - Mock contract calls
   - Verification flow tests
   - Transaction handling
   - Cache integration
   - Error scenarios

4. **`migrations/006_erc8004_integration.sql`** (~80 lines)
   - Agent table updates
   - Verification audit table
   - Indices for query performance

5. **`contracts/AgentRegistry.sol`** (~200 lines)
   - Smart contract implementation
   - Registration function
   - Status tracking
   - Revocation logic

### Configuration

```typescript
// src/config/blockchain.ts
export const blockchainConfig = {
  network: process.env.BLOCKCHAIN_NETWORK || "sepolia",  // testnet
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL,
  contractAddress: process.env.ERC8004_CONTRACT_ADDRESS,
  confirmationBlocks: 3,
  gasLimit: 200000,
  maxRetries: 3,
  retryDelay: 1000,  // ms
};
```

### Error Handling

```typescript
// Error scenarios
1. Contract unavailable → Cache fallback, manual review
2. Transaction failed → Refund gas, suggest retry
3. Network congestion → Queue verification, retry later
4. Invalid proof → Reject with clear error
5. Timeout → Async polling, webhook notification
```

### Security Considerations

✅ **Proof Validation:** Verify cryptographic signatures  
✅ **Transaction Verification:** Confirm block confirmations  
✅ **Replay Prevention:** Include nonce/timestamp in proof  
✅ **Rate Limiting:** Limit registrations per address  
✅ **Audit Trail:** Log all verification attempts  
✅ **Cache Security:** TTL-based expiration of cached results  

---

## PHASE 5: LLM Integration Robustness

### Problem Statement

**Current Status:**
- Scoring engine calls Claude/GPT without edge case handling
- Moderation agent relies on LLM without fallbacks
- No prompt injection prevention
- No timeout/retry logic
- Performance under load untested

**Risk:**
- Prompt injection attacks
- Timeout/hanging requests
- Resource exhaustion
- Degraded service during LLM failures

### Solution Architecture

#### 1. Scoring Engine Enhancements

**File:** `orchestrator/src/services/scoring_engine.py`

```python
"""
Enhanced Scoring Engine with Robustness

Features:
- Input sanitization to prevent prompt injection
- Timeout and retry logic
- Fallback scoring if LLM unavailable
- Performance metrics and monitoring
- Cache for repeated queries
"""

class ScoringEngine:
    def __init__(self):
        self.llm_client = None
        self.cache_ttl = 3600  # 1 hour
        self.timeout = 10  # seconds
        self.max_retries = 3
        self.fallback_score = 50  # Default middle score
        
    async def score_message(
        self,
        message: Message,
        context: ScoringContext,
        use_fallback: bool = True
    ) -> ScoringResult:
        """
        Score message with multiple safety layers
        
        Process:
        1. Sanitize inputs (prevent prompt injection)
        2. Check cache for recent similar messages
        3. Call LLM with timeout
        4. Validate response format
        5. Fall back if error
        """
        
        # Layer 1: Input Sanitization
        sanitized = self._sanitize_inputs(message, context)
        
        # Layer 2: Cache Lookup
        cached = await self._check_cache(sanitized)
        if cached:
            return cached
        
        # Layer 3: LLM Call with Retry
        try:
            score = await self._call_llm_with_retry(sanitized)
            await self._cache_result(sanitized, score)
            return score
        except TimeoutError:
            logger.error("Scoring timeout", extra={"message_id": message.id})
            if use_fallback:
                return ScoringResult(score=self.fallback_score, reason="LLM timeout")
            raise
        except Exception as e:
            logger.error("Scoring failed", extra={"error": str(e)})
            if use_fallback:
                return ScoringResult(score=self.fallback_score, reason=f"LLM error: {str(e)}")
            raise
    
    def _sanitize_inputs(self, message: Message, context: ScoringContext) -> dict:
        """
        Remove potential injection vectors
        
        Rules:
        - Remove control characters
        - Escape special characters in prompts
        - Validate character encodings
        - Limit input length
        """
        return {
            "content": self._escape_prompt(message.content),
            "agent": self._escape_prompt(context.participant_history.get(message.agent_id, "")),
            "objective": self._escape_prompt(context.room_objective),
        }
    
    async def _call_llm_with_retry(
        self,
        inputs: dict,
        attempt: int = 0
    ) -> ScoringResult:
        """
        Call LLM with exponential backoff retry
        
        Retry strategy:
        - Initial wait: 1s
        - Backoff: 2x per attempt
        - Max retries: 3
        - Total timeout: 30s
        """
        try:
            # Build prompt securely
            prompt = self._build_prompt(inputs)
            
            # Call with timeout
            response = await asyncio.wait_for(
                self.llm_client.complete(
                    prompt,
                    max_tokens=200,
                    temperature=0.3
                ),
                timeout=self.timeout
            )
            
            # Parse and validate response
            return self._parse_response(response)
            
        except asyncio.TimeoutError:
            if attempt < self.max_retries:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                logger.warn(f"Retry after {wait_time}s", extra={"attempt": attempt})
                await asyncio.sleep(wait_time)
                return await self._call_llm_with_retry(inputs, attempt + 1)
            raise
    
    def _escape_prompt(self, text: str) -> str:
        """
        Escape prompt to prevent injection
        
        Removes:
        - Special control sequences
        - System prompt markers
        - Common injection patterns
        """
        text = text.strip()[:1000]  # Limit length
        
        # Remove control sequences
        text = "".join(
            c for c in text
            if ord(c) >= 32 and ord(c) != 127  # Remove control chars
        )
        
        # Escape special prompt markers
        patterns = [
            "SYSTEM:", "USER:", "ASSISTANT:",
            "[BEGIN]", "[END]",
            "Ignore previous instructions",
            "System message:",
        ]
        for pattern in patterns:
            text = text.replace(pattern, f"\\{pattern}")
        
        return text
    
    async def _check_cache(self, inputs: dict) -> Optional[ScoringResult]:
        """Check Redis cache for similar messages"""
        cache_key = f"score_cache:{hash(json.dumps(inputs, sort_keys=True))}"
        return await self.cache.get(cache_key)
    
    async def _cache_result(self, inputs: dict, result: ScoringResult):
        """Cache scoring result with TTL"""
        cache_key = f"score_cache:{hash(json.dumps(inputs, sort_keys=True))}"
        await self.cache.set(cache_key, result, self.cache_ttl)
```

#### 2. Moderation Agent Enhancements

**File:** `orchestrator/src/services/moderation_agent.py`

```python
"""
Enhanced Moderation Agent with Safety Guardrails

Features:
- Prompt injection detection
- Multiple moderation checks
- Graceful degradation
- Confidence scoring
- Appeal mechanism
"""

class ModerationAgent:
    async def moderate_message(
        self,
        message: Message,
        strict_mode: bool = False
    ) -> ModerationResult:
        """
        Multi-layer moderation with fallbacks
        
        Checks:
        1. Heuristic filters (fast, no LLM)
        2. Pattern matching (common violations)
        3. LLM moderation (if needed)
        4. Human review flag (if uncertain)
        """
        
        # Layer 1: Heuristic filters (no LLM)
        heuristic_result = self._check_heuristics(message)
        if heuristic_result.confidence > 0.9:  # High confidence
            return heuristic_result
        
        # Layer 2: Pattern matching
        pattern_result = self._check_patterns(message)
        if pattern_result.severity > 0.7:
            return pattern_result
        
        # Layer 3: LLM moderation (with fallback)
        try:
            llm_result = await asyncio.wait_for(
                self._call_moderation_llm(message),
                timeout=5  # Shorter timeout for moderation
            )
            
            # Combine results
            final_result = self._combine_results(
                heuristic_result,
                pattern_result,
                llm_result
            )
            
            return final_result
            
        except (asyncio.TimeoutError, Exception) as e:
            # Fallback: Use heuristic + pattern results only
            logger.warn("Moderation LLM failed, using heuristics", extra={"error": str(e)})
            
            if pattern_result.severity > 0.5:
                return pattern_result
            else:
                return heuristic_result
    
    def _check_heuristics(self, message: Message) -> ModerationResult:
        """
        Fast heuristic checks (no LLM)
        
        Checks:
        - Profanity list
        - Spam patterns
        - URL detection
        - Suspicious formatting
        """
        violations = []
        severity = 0.0
        
        # Profanity check
        if self._contains_profanity(message.content):
            violations.append("profanity")
            severity = max(severity, 0.8)
        
        # Spam patterns
        if self._is_spam_pattern(message.content):
            violations.append("spam")
            severity = max(severity, 0.7)
        
        # Suspicious links
        if self._contains_suspicious_links(message.content):
            violations.append("suspicious_links")
            severity = max(severity, 0.6)
        
        return ModerationResult(
            severity=severity,
            violations=violations,
            confidence=min(len(violations) * 0.3 + 0.4, 1.0),
            source="heuristics"
        )
    
    async def _call_moderation_llm(
        self,
        message: Message
    ) -> ModerationResult:
        """
        Call LLM with safety prompts and guardrails
        
        Prompt designed to:
        - Avoid returning the harmful content
        - Use structured output format
        - Provide confidence scores
        """
        
        # Build structured prompt
        prompt = f"""
You are a content moderation system. Analyze this message for violations.

RULES:
- Only respond with JSON
- Do not repeat harmful content
- Rate severity 0-1
- List violation categories

MESSAGE: "{message.content[:500]}"

JSON Response:
{{
  "severity": <float 0-1>,
  "violations": [<string>],
  "confidence": <float 0-1>,
  "reason": "<explanation>"
}}
"""
        
        # Call with strict timeout
        response = await asyncio.wait_for(
            self.llm_client.complete(prompt, max_tokens=200),
            timeout=5
        )
        
        # Parse JSON response
        try:
            result_data = json.loads(response)
            return ModerationResult(**result_data, source="llm")
        except json.JSONDecodeError:
            logger.error("Moderation response not JSON", extra={"response": response})
            raise ValueError("Invalid moderation response format")
    
    def _combine_results(
        self,
        heuristic: ModerationResult,
        pattern: ModerationResult,
        llm: ModerationResult
    ) -> ModerationResult:
        """
        Combine multiple moderation results
        
        Strategy:
        - Use highest severity
        - Merge violation lists
        - Average confidence
        """
        return ModerationResult(
            severity=max(heuristic.severity, pattern.severity, llm.severity),
            violations=list(set(
                heuristic.violations +
                pattern.violations +
                llm.violations
            )),
            confidence=(
                heuristic.confidence +
                pattern.confidence +
                llm.confidence
            ) / 3,
            source="combined"
        )
```

#### 3. Test Files

**Files to Create:**

1. **`orchestrator/tests/unit/test_scoring_engine_robustness.py`** (~300 lines)
   - Timeout handling
   - Retry logic
   - Fallback scoring
   - Cache integration
   - Injection prevention
   - Performance metrics

2. **`orchestrator/tests/unit/test_moderation_agent_robustness.py`** (~300 lines)
   - Heuristic check tests
   - Pattern matching tests
   - LLM call failures
   - Combined result logic
   - Fallback behavior

3. **`orchestrator/tests/integration/test_llm_integration.py`** (~250 lines)
   - End-to-end scoring
   - End-to-end moderation
   - Load testing
   - Error recovery
   - Performance metrics

#### 4. Database & Monitoring

```sql
-- Add performance metrics table
CREATE TABLE llm_request_metrics (
  id UUID PRIMARY KEY,
  service VARCHAR(50),  -- scoring, moderation
  request_id UUID,
  duration_ms INTEGER,
  tokens_used INTEGER,
  cached BOOLEAN,
  fallback_used BOOLEAN,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_metrics_service ON llm_request_metrics(service);
CREATE INDEX idx_llm_metrics_created ON llm_request_metrics(created_at);
```

### Files to Create

1. **`orchestrator/src/services/scoring_engine.py`** (MODIFY) (~500 lines total)
2. **`orchestrator/src/services/moderation_agent.py`** (MODIFY) (~400 lines total)
3. **`orchestrator/src/utils/prompt_sanitizer.py`** (~150 lines)
4. **`orchestrator/tests/unit/test_scoring_engine_robustness.py`** (~300 lines)
5. **`orchestrator/tests/unit/test_moderation_agent_robustness.py`** (~300 lines)
6. **`orchestrator/tests/integration/test_llm_integration.py`** (~250 lines)
7. **`migrations/007_llm_metrics.sql`** (~50 lines)

### Configuration

```python
# orchestrator/config/llm_config.py
LLM_CONFIG = {
    "provider": "anthropic",  # or "openai"
    "model": "claude-3-sonnet-20240229",
    "timeout_seconds": 10,
    "max_retries": 3,
    "fallback_score": 50,
    "cache_ttl": 3600,
    "rate_limit": {
        "requests_per_minute": 100,
        "tokens_per_minute": 10000,
    },
}
```

### Security Checklist

✅ **Prompt Injection Prevention:**
- [ ] Input length limits
- [ ] Character validation
- [ ] Control sequence removal
- [ ] Pattern matching for injection markers
- [ ] Escaped special characters

✅ **LLM Reliability:**
- [ ] Timeout handling (10s max)
- [ ] Retry with exponential backoff
- [ ] Fallback scoring
- [ ] Cache for repeated queries
- [ ] Performance monitoring

✅ **Error Handling:**
- [ ] Network failures
- [ ] API rate limiting
- [ ] Timeout scenarios
- [ ] Invalid responses
- [ ] Service degradation

✅ **Performance:**
- [ ] Sub-1s response time 95%ile
- [ ] Cache hit rate tracking
- [ ] Concurrent request handling
- [ ] Memory usage monitoring

---

## Implementation Timeline

### Phase 4: ERC-8004 (5 days)
- Day 1: Smart contract design & review
- Day 2-3: Backend service implementation
- Day 4: Testing & error scenarios
- Day 5: Integration & documentation

### Phase 5: LLM Robustness (5 days)
- Day 1-2: Scoring engine hardening
- Day 3: Moderation agent enhancements
- Day 4: Comprehensive testing
- Day 5: Performance tuning & docs

---

## Success Criteria

### Phase 4 Complete When:
- [ ] Smart contract deployed to testnet
- [ ] Agent registration with blockchain verification works
- [ ] Identity verification cached and TTL enforced
- [ ] All tests pass (unit + integration)
- [ ] Error scenarios handled gracefully
- [ ] Audit trail complete and queryable
- [ ] Documentation updated

### Phase 5 Complete When:
- [ ] Prompt injection attempts blocked
- [ ] LLM timeouts handled gracefully
- [ ] Fallback scoring works reliably
- [ ] Moderation uses multi-layer approach
- [ ] Performance metrics collected
- [ ] All tests pass (80%+ coverage)
- [ ] Load testing validates resilience
- [ ] Zero hanging requests in production

---

## Production Readiness Checklist

After all 5 phases:

- [ ] All security audit findings addressed
- [ ] Test coverage ≥ 80% across codebase
- [ ] Zero critical security issues
- [ ] Graceful degradation under load
- [ ] Comprehensive audit logging
- [ ] Monitoring & alerting configured
- [ ] Runbooks for incident response
- [ ] Team trained on security features
- [ ] Deployment checklist signed off
- [ ] Go-live approval from security lead

---

## References

- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
- OWASP: Prompt Injection: https://owasp.org/www-community/attacks/Prompt_Injection
- LLM Safety: https://www.anthropic.com/index/constitutional-ai-harmless-helpful-honest
- Ethers.js: https://docs.ethers.org/
