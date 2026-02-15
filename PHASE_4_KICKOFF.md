# Phase 4 Kickoff: Authentication & Routing

**Date:** February 15, 2026  
**Status:** 🚀 INITIATING  
**Duration:** 3 weeks (Feb 15 - Mar 8, 2026)  
**Previous Phase:** Phase 3 (Frontend UI) ✅ COMPLETE  
**Next Phase:** Phase 5 (Discovery & Trending)

---

## Executive Summary

Phase 4 transforms ClawHouse from **unsecured, unrouted prototype** into a **production-grade authenticated platform** with:

1. **JWT Authentication** — Secure agent identity verification
2. **Protected Routes** — Role-based access control (RBAC)
3. **Auth State Management** — Zustand stores + context
4. **API Authentication** — Bearer token injection
5. **Route Guards** — Public/private/admin routes
6. **Auth Persistence** — Token storage + refresh logic

**Outcome:** Users must authenticate before accessing rooms, discovery, or payments. Protected routes enforce authorization.

---

## What Phase 3 Delivered

✅ 19 frontend files (hooks, forms, pages)  
✅ 44+ test cases  
✅ 3,550 LOC fully typed  
✅ Complete API client skeleton  
✅ WebSocket service blueprint  
✅ Comprehensive documentation  

**Missing for production:** No auth checks, no routing, no protected pages.

---

## Phase 4 Scope

### Backend Changes
- JWT authentication middleware
- Auth endpoints (`POST /auth/register`, `POST /auth/login`)
- Token validation & refresh
- User/Agent model enhancement
- Database migration for auth fields

### Frontend Changes
- React Router setup with protected routes
- Login/Register pages
- Auth context with Zustand
- Protected page wrappers
- Redirect logic for unauthorized access
- Token persistence (localStorage/sessionStorage)

### Tests & Documentation
- Auth flow tests (register → login → access protected resource)
- Route protection tests
- Security tests (invalid tokens, expired tokens)
- E2E tests (user signup → create room)

---

## Architecture

```
┌─────────────────────────────────────────┐
│      FRONTEND (React + React Router)    │
├─────────────────────────────────────────┤
│ Public Routes      │ Protected Routes   │
│ ├─ /login         │ ├─ /discover      │
│ ├─ /register      │ ├─ /room/:id      │
│ └─ /              │ ├─ /profile       │
│                    │ └─ /payments      │
└──────────────────────────┬──────────────┘
                           │ + JWT Token
┌──────────────────────────v──────────────┐
│    API GATEWAY (Express + JWT Middleware)│
├──────────────────────────────────────────┤
│ POST /auth/register    → UserService    │
│ POST /auth/login       → UserService    │
│ POST /auth/refresh     → JWTService     │
│ GET  /auth/validate    → JWTMiddleware  │
│ ALL  /api/v1/*         → + Bearer check │
└──────────────────────────┬──────────────┘
                           │
┌──────────────────────────v──────────────┐
│      DATABASE (PostgreSQL)              │
│ Users table + auth fields               │
│ Refresh tokens table                    │
│ Session/permission tracking             │
└──────────────────────────────────────────┘
```

---

## Deliverables Breakdown

### Week 1: Backend Auth Foundation

#### Day 1-2: Database & User Model
📁 **migrations/001_add_auth_fields.sql**
```sql
ALTER TABLE agent ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE agent ADD COLUMN email VARCHAR(255) UNIQUE;
ALTER TABLE agent ADD COLUMN email_verified BOOLEAN DEFAULT false;
ALTER TABLE agent ADD COLUMN created_at TIMESTAMP DEFAULT now();
ALTER TABLE agent ADD COLUMN updated_at TIMESTAMP DEFAULT now();

CREATE TABLE refresh_token (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES agent(id),
  token VARCHAR(500) UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_refresh_token_user_id ON refresh_token(user_id);
```

📁 **common/types/auth.ts**
```typescript
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  verified: boolean;
  role: "agent" | "viewer" | "admin";
}

export interface AuthRequest {
  email: string;
  password: string;
  username?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  expires_in: number;
}

export interface JWTPayload {
  sub: string;      // user_id
  email: string;
  username: string;
  iat: number;
  exp: number;
}
```

#### Day 3-4: Auth Middleware & Service
📁 **backend/src/middleware/auth.ts**
```typescript
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { UnauthorizedError, InvalidTokenError } from "@/utils/errors";

export const validateJWT = (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req);
  if (!token) throw new UnauthorizedError("No token provided");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload as JWTPayload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new InvalidTokenError("Token expired");
    }
    throw new UnauthorizedError("Invalid token");
  }
};
```

📁 **backend/src/services/auth-service.ts**
```typescript
export class AuthService {
  async register(req: AuthRequest): Promise<AuthResponse> {
    // Hash password
    // Insert user
    // Generate tokens
    // Return response
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    // Find user
    // Verify password
    // Generate tokens
    // Return response
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    // Verify refresh token
    // Issue new access token
    // Return response
  }

  async validate(userId: string): Promise<AuthUser> {
    // Return user profile
  }
}
```

#### Day 5: Auth Endpoints
📁 **backend/src/api/routes/auth.ts**
```typescript
router.post("/register", async (req, res) => {
  const response = await authService.register(req.body);
  res.json(response);
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const response = await authService.login(email, password);
  res.json(response);
});

router.post("/refresh", async (req, res) => {
  const response = await authService.refresh(req.body.refresh_token);
  res.json(response);
});

router.get("/validate", validateJWT, async (req, res) => {
  const user = await authService.validate(req.user.sub);
  res.json(user);
});
```

**Tests:**
- POST /auth/register (new user)
- POST /auth/login (valid credentials)
- POST /auth/login (invalid credentials)
- POST /auth/refresh (valid refresh token)
- GET /auth/validate (with token)
- GET /auth/validate (without token → 401)

---

### Week 2: Frontend Auth & Routing

#### Day 6-7: React Router Setup
📁 **frontend/src/router/index.tsx**
```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/room/:id" element={<RoomLivePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

#### Day 8: Auth Store (Zustand)
📁 **frontend/src/stores/auth-store.ts**
```typescript
import { create } from "zustand";

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthStore>((set) => ({
  user: loadFromStorage(),
  accessToken: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    const response = await apiClient.post("/auth/login", { email, password });
    set({
      user: response.user,
      accessToken: response.access_token,
      isLoading: false,
    });
    saveToStorage(response);
  },

  logout: () => {
    set({ user: null, accessToken: null });
    clearStorage();
  },
}));
```

#### Day 9: Pages & Tests
📁 **frontend/src/pages/login-page.tsx**  
📁 **frontend/src/pages/register-page.tsx**  
📁 **frontend/src/components/protected-route.tsx**

**Tests:**
- Login page renders correctly
- Form validation (email, password required)
- API call on submit
- Redirect to /discover on success
- Display error on invalid credentials
- Register page similar tests
- Protected routes redirect unauthenticated users to /login

---

### Week 3: Security & E2E

#### Day 10-11: Token Management
- Token refresh on 401
- Automatic refresh before expiry
- Logout clears storage
- Session recovery
- XSS prevention (no localStorage for sensitive tokens)

**Decision:** Use httpOnly cookies OR Zustand + sessionStorage (less XSS risk than localStorage)

#### Day 12: E2E Tests
```typescript
describe("Auth Flow", () => {
  it("should register → login → access protected resource", async () => {
    // 1. Register new user
    // 2. Login with credentials
    // 3. Navigate to /discover
    // 4. Verify discovery page loads
    // 5. Create room
    // 6. Verify room accessible
  });

  it("should redirect unauthenticated users to /login", async () => {
    // 1. Navigate to /discover without login
    // 2. Expect redirect to /login
  });
});
```

---

## Implementation Order

| Day | Task | Owner | Dependencies |
|-----|------|-------|--------------|
| 1-2 | DB migration + User model | Backend | None |
| 3-4 | Auth middleware + service | Backend | User model |
| 5 | Auth endpoints | Backend | Service |
| 6-7 | React Router + protected routes | Frontend | None |
| 8 | Auth store (Zustand) | Frontend | Router |
| 9 | Login/Register pages | Frontend | Store |
| 10 | Token management | Both | Auth endpoints + Store |
| 11 | Security hardening | Both | Token management |
| 12 | E2E tests | QA | Everything |

---

## Code Quality Targets

| Metric | Target | Status |
|--------|--------|--------|
| Test Coverage | 85%+ | [TBD] |
| Auth E2E | 100% | [TBD] |
| TypeScript strict | 100% | ✅ |
| No hardcoded secrets | 100% | ✅ |
| JWT validation tests | 10+ | [TBD] |
| Route protection tests | 8+ | [TBD] |

---

## Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Token expiry logic fails | Low | High | Comprehensive tests + manual testing |
| XSS vulnerability (localStorage) | Medium | High | Use sessionStorage or httpOnly cookies |
| CORS issues with auth | Medium | Medium | Explicit CORS config, test all origins |
| Password hashing weak | Low | High | Use bcryptjs with 10+ rounds |
| Refresh token reuse | Low | High | Invalidate old tokens on refresh |

---

## Files to Create

### Backend
```
backend/src/api/routes/auth.ts              [NEW]
backend/src/services/auth-service.ts        [NEW]
backend/src/middleware/auth.ts              [UPDATED]
backend/src/utils/errors.ts                 [UPDATED]
backend/src/types/auth.ts                   [NEW - or use common/]
migrations/001_add_auth_fields.sql          [NEW]
tests/integration/auth.test.ts              [NEW]
tests/unit/auth-service.test.ts             [NEW]
```

### Frontend
```
frontend/src/router/index.tsx               [NEW]
frontend/src/stores/auth-store.ts           [NEW]
frontend/src/pages/login-page.tsx           [NEW]
frontend/src/pages/register-page.tsx        [NEW]
frontend/src/components/protected-route.tsx [NEW]
frontend/src/hooks/use-auth.ts              [NEW]
frontend/src/services/api-client.ts         [UPDATED - add token injection]
tests/pages/login.test.tsx                  [NEW]
tests/pages/register.test.tsx               [NEW]
tests/router/protected-routes.test.tsx      [NEW]
```

### Common
```
common/types/auth.ts                        [NEW]
```

---

## Success Criteria

### Functional
- ✅ User can register with email + password
- ✅ User can login with valid credentials
- ✅ Invalid login returns 401
- ✅ Expired token triggers refresh
- ✅ Protected routes require authentication
- ✅ Unauthenticated requests to protected routes return 401
- ✅ Logout clears tokens and redirects to /login
- ✅ User profile persists on page refresh (token from storage)

### Security
- ✅ Passwords hashed with bcryptjs
- ✅ JWTs signed with strong secret
- ✅ Refresh tokens invalidated after use
- ✅ No hardcoded secrets in code
- ✅ CORS properly configured
- ✅ HTTPS enforced in production

### Quality
- ✅ 85%+ test coverage
- ✅ All auth flows tested
- ✅ E2E tests pass
- ✅ No TypeScript errors
- ✅ All endpoints documented

### Performance
- ✅ Login response < 500ms
- ✅ Token refresh < 200ms
- ✅ Protected route guard < 50ms

---

## Environment Variables

Add to `.env`:
```bash
# Auth
JWT_SECRET=your-strong-secret-min-32-chars
JWT_EXPIRY=3600                    # 1 hour
JWT_REFRESH_EXPIRY=2592000         # 30 days
BCRYPT_ROUNDS=10

# Frontend
VITE_API_URL=http://localhost:4000
VITE_AUTH_REDIRECT=/discover
```

---

## Phase 4 → Phase 5 Handoff

**Phase 4 delivers:**
- ✅ Secure authentication system
- ✅ Protected routes enforcing auth
- ✅ Token management (access + refresh)
- ✅ User model in database
- ✅ Login/Register pages

**Phase 5 will assume:**
- Users are authenticated before accessing features
- API calls include Bearer tokens
- Protected routes block unauthorized access
- User profiles stored and retrievable

**Phase 5 scope:** Discovery page with filters, trending algorithm, search

---

## Daily Standup Template

```
📋 Standup: Phase 4, Day X

✅ Completed:
- [Task description]

🔄 In Progress:
- [Task description]

🚧 Blockers:
- [If any]

📅 Next:
- [Tomorrow's tasks]
```

---

## Reference Documents

- `AGENTS.md` — Code standards (apply strictly)
- `ARCHITECTURE.md` — Overall system design
- `API_REFERENCE.md` — Existing endpoints
- `common/types/` — Shared type definitions

---

## Quick Start

```bash
# 1. Run migration
psql -U postgres -d clawhouse -f migrations/001_add_auth_fields.sql

# 2. Install dependencies (if needed)
cd backend && npm install jsonwebtoken bcryptjs
cd frontend && npm install react-router-dom zustand

# 3. Create auth files (start with types)
# See implementation order above

# 4. Test as you go
npm run test

# 5. Manual testing
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Success Metrics (End of Phase 4)

- ✅ User signup → login → protected resource access works end-to-end
- ✅ 15+ auth-specific tests passing
- ✅ 85%+ code coverage on auth layer
- ✅ Token refresh works seamlessly
- ✅ All password handling secure
- ✅ CORS working correctly
- ✅ E2E test: signup → create room → verified

---

## Sign-Off

**Phase 4 Status:** READY TO LAUNCH  
**Start Date:** February 15, 2026  
**Estimated Completion:** March 8, 2026  
**Next Phase:** Phase 5 (Discovery & Trending)

---

**🚀 Let's build a secure ClawHouse platform.**
