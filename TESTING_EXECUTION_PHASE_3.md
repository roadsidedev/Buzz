# Testing Execution & Coverage Verification (Phase 3)

**Date:** February 16, 2026  
**Status:** ✅ TEST INFRASTRUCTURE COMPLETE | Tests Ready for Execution  
**Audit Reference:** T-019c612f-205d-720a-bc1c-230a8eb01983

---

## Overview

Phase 3 establishes comprehensive test infrastructure to verify security fixes and ensure production readiness. This includes:
- ✅ Unit test frameworks configured (Vitest + Jest for backend, Pytest for orchestrator)
- ✅ Test coverage targets established (80%+ on critical paths)
- ✅ Integration test templates created
- ✅ Test utilities and fixtures scaffolded
- ⏳ Execution phase (to be run after deployment)

---

## Backend Test Configuration

### Files Created

#### 1. `backend/vitest.config.ts` ✅
```typescript
- Test environment: Node.js
- Coverage provider: V8
- Coverage targets: 80% (lines, functions, branches, statements)
- Test reporters: verbose, html, lcov
- Test timeout: 10 seconds
- Setup file: tests/setup.ts
```

#### 2. `backend/tests/setup.ts` ✅
```typescript
- Load environment variables (.env.test)
- Global test hooks (beforeAll, afterAll, beforeEach, afterEach)
- Shared test configuration
- Mock initialization
```

#### 3. `backend/tests/unit/refresh-token-service.test.ts` ✅
**Coverage:**
- Token issuance (format, family creation, metadata)
- Token rotation (generation tracking, family lineage)
- Single-use enforcement (replay detection, family revocation)
- Expiration handling
- Error cases (invalid token, database failures)
- Concurrent access safety
- Audit trail maintenance

**Test Count:** 12 test cases  
**Expected Coverage:** 95%+

#### 4. `backend/tests/integration/auth.integration.test.ts` ✅
**Coverage (Currently Skipped - Requires App Setup):**
- Registration flow (valid/invalid credentials, duplicate users)
- Login flow (valid/invalid credentials)
- Token refresh with rotation
- Security: Replay attack detection
- Security: Token family revocation
- Token validation on protected endpoints
- Error handling (expired tokens, invalid credentials)

**Test Count:** 15 test cases (skipped - ready for E2E phase)  
**Status:** Scaffolded, requires application instance and test database

### Running Backend Tests

```bash
# Install dependencies
cd backend
npm install

# Run all unit tests
npm test

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- refresh-token-service.test.ts

# Watch mode (continuous testing)
npm test -- --watch

# Coverage report (HTML)
npm run test:cov
# Open coverage/index.html in browser
```

### Backend Coverage Targets

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| auth-service.ts | 85% | - | Ready |
| refresh-token-service.ts | 95% | - | Ready |
| authentication middleware | 90% | - | Ready |
| validation utilities | 85% | - | Ready |
| error handling | 90% | - | Ready |

---

## Orchestrator Test Configuration

### Files Created

#### 1. `orchestrator/pytest.ini` ✅
```ini
- Test discovery: test_*.py, *_test.py
- Output: verbose, short traceback
- Coverage: branch coverage enabled
- Markers: asyncio, integration, unit, slow
```

#### 2. `orchestrator/conftest.py` ✅
```python
- Event loop fixture for async tests
- Mock fixtures:
  - mock_db: Database connection
  - mock_redis: Redis client
  - mock_api_gateway: API Gateway
  - mock_scoring_engine: Scoring service
  - mock_moderation_agent: Moderation service
  - mock_turn_manager: Turn management
  - mock_contract_validator: Contract validation
```

#### 3. `orchestrator/tests/unit/test_room_state_manager.py` ✅
**Coverage:**
- Room creation and persistence
- Room retrieval from Redis
- Room deletion and cleanup
- Active rooms enumeration
- TTL preservation on updates
- Participant storage and retrieval
- Message storage and querying
- Health check reporting
- Graceful degradation on failure
- Serialization/deserialization

**Test Count:** 11 test cases  
**Expected Coverage:** 90%+

### Running Orchestrator Tests

```bash
# Install dependencies
cd orchestrator
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit/test_room_state_manager.py

# Run specific test
pytest tests/unit/test_room_state_manager.py::TestRoomStateManager::test_create_room_persists_to_redis

# Watch mode (requires pytest-watch)
ptw

# Verbose output
pytest -v

# Show print statements
pytest -s
```

### Orchestrator Coverage Targets

| Component | Target | Current | Status |
|-----------|--------|---------|--------|
| orchestration_service.py | 85% | - | Ready |
| room_state_manager.py | 90% | - | Ready |
| scoring_engine.py | 80% | - | Ready |
| turn_management.py | 80% | - | Ready |
| moderation_agent.py | 80% | - | Ready |

---

## Test Execution Strategy

### Phase 3A: Local Unit Testing
**Duration:** ~2 hours

```bash
# Backend
cd backend
npm install
npm test -- --coverage

# Orchestrator
cd ../orchestrator
pip install -r requirements.txt pytest-cov
pytest --cov=src --cov-report=html
```

**Success Criteria:**
- ✅ All backend unit tests pass
- ✅ All orchestrator unit tests pass
- ✅ Coverage ≥ 80% on critical paths
- ✅ No flaky tests (consistent passes)

### Phase 3B: Integration Testing (Post-Deployment)
**Duration:** ~3 hours

**Requires:**
- Running backend server (localhost:3000)
- Running orchestrator (localhost:8000)
- PostgreSQL test database
- Redis test instance

```bash
# Backend integration tests
npm test -- integration/

# Manual E2E flow
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "username": "testuser",
    "password": "SecurePassword123",
    "confirmPassword": "SecurePassword123"
  }'

# Capture tokens and test refresh
```

**Success Criteria:**
- ✅ Registration flow succeeds
- ✅ Login flow succeeds
- ✅ Token refresh with rotation works
- ✅ Replay attack detection blocks reuse
- ✅ Room creation and state persistence works
- ✅ Orchestrator scales with multiple instances

### Phase 3C: Security Testing
**Duration:** ~2 hours

**Test Cases:**
1. Token Rotation Security
   - [ ] Refresh token single-use enforcement
   - [ ] Family revocation on reuse attempt
   - [ ] Audit trail completeness
   - [ ] Token format validation

2. State Persistence
   - [ ] Room state survives orchestrator crash
   - [ ] Multiple instances sync via Redis
   - [ ] State recovery from persistence
   - [ ] TTL-based cleanup works

3. Error Handling
   - [ ] Redis unavailability handled gracefully
   - [ ] Database connection failures logged
   - [ ] Token expiration rejected properly
   - [ ] Invalid tokens detected

---

## Environment Setup

### Backend (.env.test)
```bash
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost/clawhouse_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test_secret_key_must_be_at_least_32_characters_long
JWT_EXPIRY=3600
JWT_REFRESH_EXPIRY=2592000
BCRYPT_ROUNDS=10
```

### Orchestrator (pytest.ini)
```ini
[pytest]
markers =
    asyncio: async test
    integration: integration test
    unit: unit test
```

---

## Coverage Reports

### After Running Tests

**Backend:**
```bash
# Generated files:
backend/coverage/index.html  # Interactive HTML report
backend/coverage/lcov.info   # LCOV format
```

**Orchestrator:**
```bash
# Generated files:
orchestrator/htmlcov/index.html  # Interactive HTML report
orchestrator/.coverage           # Coverage database
```

### Minimum Coverage by Component

| Type | Minimum | Target |
|------|---------|--------|
| Statements | 80% | 85%+ |
| Branches | 80% | 85%+ |
| Functions | 80% | 85%+ |
| Lines | 80% | 85%+ |

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test & Coverage

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd backend && npm install && npm test -- --coverage
      - uses: codecov/codecov-action@v3

  orchestrator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: "3.11"
      - run: cd orchestrator && pip install -r requirements.txt
      - run: pytest --cov=src --cov-report=xml
      - uses: codecov/codecov-action@v3
```

---

## Test Maintenance

### Regular Execution
- **Pre-commit:** Run unit tests locally
- **Branch merge:** Run all tests + coverage check
- **Production deployment:** Run integration tests
- **Nightly:** Full test suite + security scanning

### Test Updates Required When:
- Adding new features
- Fixing bugs
- Refactoring code
- Responding to security issues

### Metrics to Track
- Test execution time
- Coverage trends
- Flaky test rate
- False positive rate

---

## Debugging Failed Tests

### Backend

```bash
# Run single test in verbose mode
npm test -- refresh-token-service.test.ts -t "rotateToken"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest

# Check coverage details
npm run test:cov -- --reporter=verbose
```

### Orchestrator

```bash
# Run single test with output
pytest tests/unit/test_room_state_manager.py::TestRoomStateManager::test_create_room_persists_to_redis -s

# Debug with PDB
pytest --pdb

# Show all captured output
pytest -v -s --tb=long
```

---

## Known Issues & Workarounds

### Issue 1: Redis Connection in Tests
**Status:** ⚠️ May require test Redis instance
**Workaround:** Use `fakeredis` package or mock Redis entirely

### Issue 2: Async Test Timing
**Status:** ✅ Configured via conftest.py
**Workaround:** Use pytest-asyncio plugin

### Issue 3: Database Transaction Rollback
**Status:** ⚠️ May require transaction handling
**Workaround:** Use test database fixtures with cleanup

---

## Success Criteria Checklist

### Phase 3 Completion
- [ ] All unit tests pass (backend)
- [ ] All unit tests pass (orchestrator)
- [ ] Backend coverage ≥ 80%
- [ ] Orchestrator coverage ≥ 80%
- [ ] Integration tests created (ready to run)
- [ ] CI/CD pipeline configured
- [ ] Test execution documented
- [ ] Security tests identified

### Production Readiness
- [ ] All security fixes tested
- [ ] Replay attack detection verified
- [ ] State persistence validated
- [ ] Error handling confirmed
- [ ] Performance acceptable
- [ ] No flaky tests
- [ ] Coverage gaps identified
- [ ] Deployment runbook created

---

## Next Steps (Phases 4-5)

### Phase 4: ERC-8004 Smart Contract Integration
- [ ] Implement blockchain verification
- [ ] Add agent identity validation
- [ ] Test with testnet contracts
- [ ] Add contract failure handling

### Phase 5: LLM Integration Robustness
- [ ] Test scoring engine edge cases
- [ ] Add prompt injection prevention
- [ ] Load test LLM endpoints
- [ ] Add timeout and retry logic
- [ ] Security audit of prompts

---

## References

- Vitest Documentation: https://vitest.dev
- Pytest Documentation: https://docs.pytest.org
- Jest Matchers: https://jestjs.io/docs/expect
- Coverage Reports: https://coverage.readthedocs.io

---

## Appendix: Test Commands Reference

```bash
# Backend
npm test                       # Run all tests
npm test -- --watch          # Watch mode
npm run test:cov             # Coverage report
npm test -- refresh-token    # Single file
npm test -- -t "should"      # Pattern matching

# Orchestrator
pytest                         # Run all tests
pytest -v                      # Verbose
pytest -s                      # Show output
pytest --cov=src              # With coverage
pytest -k "test_create"       # Pattern matching
pytest --pdb                  # Debug mode
pytest --lf                   # Last failed
```
