# Phase 4 Execution Checklist

**Phase:** 4 of 10 (Authentication & Routing)  
**Duration:** 3 weeks (Feb 15 - Mar 8, 2026)  
**Status:** READY TO EXECUTE  
**Previous:** Phase 3 ✅ COMPLETE

---

## Pre-Flight Checklist

Before starting Phase 4:

- [ ] Phase 3 frontend fully tested and working
- [ ] Backend API Gateway running on port 4000
- [ ] PostgreSQL database accessible
- [ ] Node.js 20+ installed
- [ ] npm/yarn package manager ready
- [ ] Environment variables template ready
- [ ] Team allocated (backend, frontend, QA)
- [ ] Read PHASE_4_KICKOFF.md
- [ ] Read PHASE_4_WEEK1_BACKEND_AUTH.md
- [ ] Read PHASE_4_WEEK2_FRONTEND_AUTH.md

---

## Week 1: Backend Authentication Foundation

### Day 1: Database Schema

**Morning (2 hours)**
- [ ] Review migration plan in PHASE_4_WEEK1_BACKEND_AUTH.md
- [ ] Create migrations/001_auth_schema.sql file
- [ ] Write SQL: Add auth fields to agent table
- [ ] Write SQL: Create refresh_token table
- [ ] Write SQL: Create password_reset_token table
- [ ] Write SQL: Create login_audit table
- [ ] Create all indexes

**Afternoon (2 hours)**
- [ ] Run migration: `psql -U postgres -d clawhouse -f migrations/001_auth_schema.sql`
- [ ] Verify tables with `\d agent`, `\d refresh_token`
- [ ] Check indexes created
- [ ] Document any issues
- [ ] Commit to git

**Success Criteria:**
- [ ] All tables exist in PostgreSQL
- [ ] All columns present on agent
- [ ] All indexes created
- [ ] No SQL errors

**Test Script:**
```bash
psql -U postgres -d clawhouse << EOF
SELECT column_name FROM information_schema.columns WHERE table_name='agent' AND column_name IN ('email', 'password_hash', 'role');
SELECT COUNT(*) FROM pg_indexes WHERE tablename='refresh_token';
EOF
```

---

### Day 2: Auth Types & Service

**Morning (2 hours)**
- [ ] Create common/types/auth.ts with all interfaces
- [ ] Define AuthUser, RegisterRequest, LoginRequest, AuthResponse
- [ ] Define JWTPayload with all fields (sub, email, username, role, iat, exp, aud)
- [ ] Create custom error classes (InvalidCredentialsError, etc.)
- [ ] Add JSDoc comments to all types

**Afternoon (2 hours)**
- [ ] Create backend/src/services/auth-service.ts
- [ ] Implement `register()` method (validate, hash, insert, generate tokens)
- [ ] Implement `login()` method (find user, verify password, log attempt)
- [ ] Implement `refresh()` method (validate, revoke, issue new tokens)
- [ ] Implement `validateAccessToken()` method
- [ ] Implement `getUserProfile()` method
- [ ] Add all helper methods (_validateRegisterRequest, _hashPassword, _generateTokens, etc.)

**Success Criteria:**
- [ ] All interfaces defined with JSDoc
- [ ] AuthService fully typed (no any)
- [ ] All 6 public methods implemented
- [ ] Error handling with custom classes
- [ ] Password hashing with bcryptjs
- [ ] JWT generation and validation
- [ ] Comments on complex logic

**Installation:**
```bash
cd backend && npm install bcryptjs jsonwebtoken
```

**Test:**
```typescript
// Unit tests for AuthService in Week 1, Day 5
```

---

### Day 3: Auth Middleware & Routes

**Morning (2 hours)**
- [ ] Create backend/src/middleware/auth.ts
- [ ] Implement `validateJWT` middleware
- [ ] Implement `extractBearerToken` helper
- [ ] Implement `requireRole` middleware
- [ ] Add JSDoc comments
- [ ] Extend Express Request type for user property

**Afternoon (2 hours)**
- [ ] Create backend/src/api/routes/auth.ts
- [ ] Implement POST /auth/register endpoint
- [ ] Implement POST /auth/login endpoint
- [ ] Implement POST /auth/refresh endpoint
- [ ] Implement GET /auth/validate endpoint
- [ ] Implement GET /auth/profile endpoint
- [ ] Add error handling and logging

**Success Criteria:**
- [ ] All 5 endpoints created
- [ ] Middleware properly attached
- [ ] Error responses consistent
- [ ] Logging on all endpoints
- [ ] No hardcoded values

---

### Day 4: Integration into API Gateway

**Morning (2 hours)**
- [ ] Open backend/src/server.ts
- [ ] Import auth routes
- [ ] Register auth routes on /api/v1/auth
- [ ] Apply validateJWT to all /api/v1/* routes (except /auth/*)
- [ ] Test route availability

**Afternoon (2 hours)**
- [ ] Manual testing with curl:
  ```bash
  # Register
  curl -X POST http://localhost:4000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","username":"testuser","password":"SecurePass123","confirmPassword":"SecurePass123"}'

  # Login
  curl -X POST http://localhost:4000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"SecurePass123"}'

  # Validate (with token)
  curl -X GET http://localhost:4000/api/v1/auth/validate \
    -H "Authorization: Bearer ACCESS_TOKEN_HERE"
  ```
- [ ] Verify tokens are generated
- [ ] Verify token validation works
- [ ] Check database entries created

**Success Criteria:**
- [ ] Register creates user and returns tokens
- [ ] Login with correct password works
- [ ] Login with incorrect password returns 401
- [ ] Validate with token works
- [ ] Validate without token returns 401
- [ ] User data in database correct

---

### Day 5: Integration Tests

**Morning (2 hours)**
- [ ] Create tests/integration/auth.test.ts
- [ ] Write test suite with describe blocks
- [ ] Implement POST /auth/register tests (valid, duplicate email, invalid input)
- [ ] Implement POST /auth/login tests (valid, invalid password, nonexistent user)
- [ ] Implement POST /auth/refresh tests (valid, invalid, missing token)

**Afternoon (2 hours)**
- [ ] Implement GET /auth/validate tests (with token, without token, invalid format)
- [ ] Implement GET /auth/profile tests
- [ ] Write beforeEach/afterAll hooks
- [ ] Run all tests: `npm run test -- tests/integration/auth.test.ts`
- [ ] Verify 15+ tests passing
- [ ] Verify coverage on auth service

**Success Criteria:**
- [ ] 15+ auth tests written
- [ ] All tests passing
- [ ] Coverage >80% for auth paths
- [ ] Database cleaned up between tests
- [ ] No test pollution

**Run:**
```bash
npm run test -- tests/integration/auth.test.ts
npm run test:cov -- tests/integration/auth.test.ts
```

---

## Week 2: Frontend Authentication & Routing

### Day 6-7: React Router Setup

**Day 6 Morning (2 hours)**
- [ ] Install React Router: `npm install react-router-dom`
- [ ] Create frontend/src/router/protected-route.tsx
- [ ] Implement ProtectedRoute component (redirect if not auth)
- [ ] Implement PublicRoute component (redirect if auth)
- [ ] Implement RoleRoute component (check role)
- [ ] Add JSDoc comments

**Day 6 Afternoon (2 hours)**
- [ ] Create frontend/src/router/index.tsx
- [ ] Set up BrowserRouter
- [ ] Define all routes:
  - [ ] Public: /login, /register
  - [ ] Protected: /discover, /room/:id, /episode/:id, /profile
  - [ ] Root redirect to /discover
  - [ ] 404 handler
- [ ] Wrap protected routes with ProtectedRoute guard
- [ ] Wrap public routes with PublicRoute guard

**Day 7 Morning (2 hours)**
- [ ] Create frontend/src/components/layouts/main-layout.tsx (if needed)
- [ ] Create frontend/src/pages/profile-page.tsx (stub)
- [ ] Create frontend/src/pages/not-found-page.tsx
- [ ] Verify all page components exist

**Day 7 Afternoon (2 hours)**
- [ ] Test route navigation manually
- [ ] Verify protected routes block access without auth
- [ ] Verify public routes redirect if logged in
- [ ] Check loading states during auth validation

**Success Criteria:**
- [ ] Router configured with all routes
- [ ] Protected routes guard access
- [ ] Public routes redirect authenticated users
- [ ] Loading state displays
- [ ] Navigation works end-to-end

---

### Day 8: Auth Store (Zustand)

**Morning (2 hours)**
- [ ] Install Zustand: `npm install zustand`
- [ ] Create frontend/src/stores/auth-store.ts
- [ ] Set up Zustand store with persist middleware
- [ ] Implement `login()` action
- [ ] Implement `register()` action
- [ ] Implement `logout()` action

**Afternoon (2 hours)**
- [ ] Implement `validateToken()` action
- [ ] Implement `refreshAccessToken()` action
- [ ] Implement `clearError()` action
- [ ] Add localStorage persistence with key "clawhouse-auth"
- [ ] Add JSDoc comments
- [ ] Create `useInitializeAuth()` hook

**Success Criteria:**
- [ ] Store created and typed
- [ ] All actions implemented
- [ ] Persistence to localStorage working
- [ ] Token injection to API client working
- [ ] No console errors

**Test localStorage:**
```bash
# After login, check browser DevTools > Application > Local Storage
# Should see "clawhouse-auth" with tokens
```

---

### Day 9: Login & Register Pages

**Morning (2 hours)**
- [ ] Create frontend/src/pages/login-page.tsx
- [ ] Build form with email and password fields
- [ ] Implement validation (email format, password length)
- [ ] Hook up to auth store login action
- [ ] Add error message display
- [ ] Add loading state
- [ ] Style with Neobrutalism design

**Afternoon (2 hours)**
- [ ] Create frontend/src/pages/register-page.tsx
- [ ] Build form with email, username, password, confirmPassword
- [ ] Implement validation (all fields required, password match, length checks)
- [ ] Hook up to auth store register action
- [ ] Add error message display
- [ ] Add loading state
- [ ] Style with Neobrutalism design
- [ ] Add links between login/register

**Success Criteria:**
- [ ] Both pages render
- [ ] Forms validate before submit
- [ ] API calls work
- [ ] Errors display
- [ ] Successful auth redirects to /discover
- [ ] Loading states work
- [ ] Styling matches design system

**Manual Test:**
```
1. Navigate to /register
2. Fill form (new email, username, password)
3. Click "Create Account"
4. Expect redirect to /discover
5. Navigate to /profile
6. Verify user info displays
```

---

### Day 10: Integration & Testing

**Morning (2 hours)**
- [ ] Update frontend/src/App.tsx to use AppRouter
- [ ] Update frontend/src/main.tsx to call useInitializeAuth
- [ ] Test app startup with auth validation
- [ ] Verify token loading from localStorage
- [ ] Test route guards

**Afternoon (2 hours)**
- [ ] Create tests/router/protected-routes.test.tsx
- [ ] Write tests for ProtectedRoute
- [ ] Write tests for PublicRoute
- [ ] Write tests for RoleRoute
- [ ] Create tests/stores/auth-store.test.ts
- [ ] Write tests for login action
- [ ] Write tests for register action
- [ ] Write tests for logout action
- [ ] Write tests for token refresh
- [ ] Run tests: `npm run test`

**Success Criteria:**
- [ ] All routes working
- [ ] 18+ tests written
- [ ] All tests passing
- [ ] Manual flow works: signup → login → protected → logout
- [ ] No TypeScript errors

---

## Week 3: Security, E2E & Polish

### Day 11: Token Management & Security

**Focus:** Token refresh, XSS prevention, secure storage

**Tasks:**
- [ ] Implement automatic token refresh before expiry
- [ ] Test token refresh on 401 response
- [ ] Verify refresh token revocation
- [ ] Test session recovery after page reload
- [ ] Audit for XSS vulnerabilities (localStorage)
- [ ] Implement Content Security Policy headers
- [ ] Add CORS headers
- [ ] Verify password never logged or stored
- [ ] Test password hashing strength (bcrypt rounds)

**Tests to Add:**
- [ ] Token refresh on 401
- [ ] Refresh token revocation
- [ ] Session recovery from localStorage
- [ ] Invalid token handling
- [ ] Expired token handling

**Success Criteria:**
- [ ] Tokens refresh automatically
- [ ] Old refresh tokens invalidated after use
- [ ] No sensitive data in localStorage
- [ ] CORS working correctly
- [ ] Security headers present

---

### Day 12-13: E2E Tests & Hardening

**Day 12 Morning (2 hours)**
- [ ] Create tests/integration/auth-flow.e2e.test.ts
- [ ] Write test: register → auto-login → access protected
- [ ] Write test: logout → redirect to login
- [ ] Write test: login → create room
- [ ] Write test: token expiry → refresh → continue
- [ ] Write test: invalid credentials → error message

**Day 12 Afternoon (2 hours)**
- [ ] Run full test suite: `npm run test`
- [ ] Generate coverage report: `npm run test:cov`
- [ ] Achieve >85% coverage on auth paths
- [ ] Fix any failing tests
- [ ] Document any known issues

**Day 13 Morning (2 hours)**
- [ ] Security audit checklist:
  - [ ] JWT signed with strong secret (32+ chars)
  - [ ] Passwords hashed with bcrypt (10+ rounds)
  - [ ] Refresh tokens stored in DB
  - [ ] Old refresh tokens revoked
  - [ ] No hardcoded secrets
  - [ ] Environment variables used
  - [ ] HTTPS enforced in production config
  - [ ] CORS restrictive
- [ ] Code review checklist:
  - [ ] No implicit any
  - [ ] All functions typed
  - [ ] Error messages helpful
  - [ ] Logging appropriate
  - [ ] Comments on complex logic

**Day 13 Afternoon (2 hours)**
- [ ] Final manual testing:
  - [ ] Full signup → login → use protected → logout flow
  - [ ] Error handling (invalid credentials, network error)
  - [ ] Token refresh and persistence
  - [ ] Role-based access (if implemented)
- [ ] Documentation update:
  - [ ] API_REFERENCE.md — add auth endpoints
  - [ ] ARCHITECTURE.md — update with auth layer
  - [ ] SETUP.md — add auth setup steps
  - [ ] Environment variables documented

**Success Criteria:**
- [ ] 20+ E2E tests
- [ ] 85%+ code coverage
- [ ] Security audit passed
- [ ] No hardcoded secrets
- [ ] Full flow works end-to-end

---

## Daily Standup Template

Use this format for daily progress:

```
📋 STANDUP: Phase 4, Day X

✅ COMPLETED:
- [Task 1] - [% complete]
- [Task 2] - [% complete]

🔄 IN PROGRESS:
- [Task] - [Current status]

🚧 BLOCKERS:
- [Issue] - [Impact]
- [Issue] - [Impact]

📅 TOMORROW:
- [Task 1]
- [Task 2]
- [Task 3]

📊 METRICS:
- Tests written: X
- Tests passing: Y
- Code coverage: Z%
```

---

## Quality Gates

At end of each phase:

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 0 `any` types
- [ ] All functions return typed
- [ ] JSDoc on public APIs
- [ ] No console.log in production code

### Testing
- [ ] 85%+ code coverage
- [ ] All critical paths tested
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] No flaky tests

### Security
- [ ] No hardcoded secrets
- [ ] Password hashing verified
- [ ] JWT validation verified
- [ ] CORS properly configured
- [ ] XSS prevention verified

### Documentation
- [ ] README updated
- [ ] API docs updated
- [ ] Architecture docs updated
- [ ] Setup guide updated
- [ ] Troubleshooting guide updated

---

## Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/clawhouse

# JWT
JWT_SECRET=your-secret-min-32-characters-long-here-dev-only
JWT_EXPIRY=3600
JWT_REFRESH_EXPIRY=2592000

# Bcrypt
BCRYPT_ROUNDS=10

# Logging
LOG_LEVEL=info
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_LOG_LEVEL=info
```

---

## Deliverables Checklist

### Backend
- [ ] migrations/001_auth_schema.sql
- [ ] common/types/auth.ts
- [ ] backend/src/services/auth-service.ts
- [ ] backend/src/middleware/auth.ts
- [ ] backend/src/api/routes/auth.ts
- [ ] tests/integration/auth.test.ts
- [ ] tests/unit/auth-service.test.ts (optional)

### Frontend
- [ ] frontend/src/router/index.tsx
- [ ] frontend/src/router/protected-route.tsx
- [ ] frontend/src/stores/auth-store.ts
- [ ] frontend/src/pages/login-page.tsx
- [ ] frontend/src/pages/register-page.tsx
- [ ] frontend/src/pages/profile-page.tsx
- [ ] tests/router/protected-routes.test.tsx
- [ ] tests/stores/auth-store.test.ts
- [ ] tests/integration/auth-flow.e2e.test.ts

### Documentation
- [ ] PHASE_4_KICKOFF.md ✅
- [ ] PHASE_4_WEEK1_BACKEND_AUTH.md ✅
- [ ] PHASE_4_WEEK2_FRONTEND_AUTH.md ✅
- [ ] PHASE_4_WEEK3_SECURITY.md (NEW)
- [ ] PHASE_4_COMPLETE.md (NEW)
- [ ] API_REFERENCE.md (UPDATED)
- [ ] ARCHITECTURE.md (UPDATED)

---

## Success Metrics (End of Phase 4)

### Functional
- [ ] User can register with email/username/password
- [ ] User can login with email/password
- [ ] Invalid credentials rejected (401)
- [ ] Protected routes require authentication
- [ ] Unauthenticated access redirects to /login
- [ ] Token persists across page reloads
- [ ] Token auto-refreshes before expiry
- [ ] Logout clears tokens and redirects

### Quality
- [ ] 85%+ code coverage
- [ ] 0 TypeScript errors
- [ ] 30+ tests passing
- [ ] All critical paths tested
- [ ] E2E auth flow passes

### Security
- [ ] Passwords hashed (bcryptjs)
- [ ] Tokens signed (HS256)
- [ ] No hardcoded secrets
- [ ] Refresh tokens revoked after use
- [ ] CORS configured
- [ ] XSS prevention verified

### Performance
- [ ] Login response < 500ms
- [ ] Token refresh < 200ms
- [ ] Route guard check < 50ms
- [ ] No unnecessary re-renders

---

## Rollback Plan

If major issues found:

1. **Database:** Restore from backup before migration
2. **Code:** Git revert to last working commit
3. **Frontend:** Clear localStorage (auth store)
4. **Tests:** Run test suite to verify rollback

---

## Post-Phase 4 (Ready for Phase 5)

After Phase 4 completes:
- [ ] All files committed to git
- [ ] All tests passing in CI/CD
- [ ] Code reviewed and approved
- [ ] Documentation complete
- [ ] Staging deployment successful
- [ ] Security audit passed

Phase 5 can then assume:
- Users are authenticated before accessing features
- API calls include Bearer tokens
- Protected routes work correctly
- User profiles stored in database

---

## Sign-Off

**Phase 4 Status:** READY TO EXECUTE  
**Start Date:** February 15, 2026  
**Estimated Completion:** March 8, 2026  
**Duration:** 3 weeks  

**Next Phase:** Phase 5 (Discovery & Trending Algorithm)

---

**🚀 Ready to build secure authentication. Let's execute Phase 4.**

