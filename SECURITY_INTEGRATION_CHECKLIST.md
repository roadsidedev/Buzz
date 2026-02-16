# Security Hardening Integration Checklist

**Phase:** Phase 5 Integration  
**Estimated Time:** 2-3 hours  
**Difficulty:** Moderate  

---

## Pre-Integration

- [ ] Review `SECURITY_HARDENING_GUIDE.md`
- [ ] Review `SECURITY_HARDENING_IMPLEMENTATION_SUMMARY.md`
- [ ] Backup current code
- [ ] Create feature branch: `git checkout -b security/phase-5-hardening`

---

## Step 1: Install Dependencies

```bash
# If not already installed
npm install helmet cookie-parser @sentry/node @sentry/profiling-node

# Verify installations
npm list helmet cookie-parser @sentry/node
```

**Checklist:**
- [ ] helmet installed
- [ ] cookie-parser installed
- [ ] @sentry/node installed
- [ ] @sentry/profiling-node installed

---

## Step 2: Update Environment Variables

**Create `.env.example` additions:**

```bash
# Add to .env.example
echo "
# ========== SECURITY HARDENING (Phase 5) ==========

# Encryption
DATA_ENCRYPTION_KEY=<32-byte base64 - generate with: openssl rand -base64 32>

# Sentry Error Tracking
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Security
LOG_LEVEL=info
CSP_REPORT_URI=/api/v1/security/csp-report
" >> .env.example
```

**Generate Encryption Key:**
```bash
openssl rand -base64 32
# Copy output to DATA_ENCRYPTION_KEY in .env.production
```

**Checklist:**
- [ ] `.env.example` updated
- [ ] `.env.production` has all new variables
- [ ] `DATA_ENCRYPTION_KEY` generated and set
- [ ] `SENTRY_DSN` obtained from Sentry account
- [ ] All variables validated

---

## Step 3: Update Backend Server (server.ts)

**Location:** `backend/src/server.ts`

**Changes:**

```typescript
// 1. Add imports at top
import cookieParser from "cookie-parser";
import { securityHeaders } from "./middleware/security-headers.js";
import { initializeSentry } from "./config/sentry-config.js";
import { cookieTokenExtractor } from "./middleware/http-only-cookies.js";
import { csrfTokenEndpoint, startCsrfCleanup } from "./middleware/csrf-protection.js";
import { startBruteForcecleanup } from "./middleware/brute-force-protection.js";

// 2. Initialize Sentry FIRST (before other middleware)
const app: Express = express();
initializeSentry(app);

// 3. Update middleware stack order
// Security
app.use(helmet());
app.use(cors());
app.use(securityHeaders); // NEW: Security headers

// Parsing
app.use(cookieParser()); // NEW: Cookie parser for httpOnly cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Token extraction
app.use(cookieTokenExtractor); // NEW: Extract cookies for auth

// 4. Add CSRF token endpoint
app.get(`/api/${apiVersion}/csrf-token`, csrfTokenEndpoint);

// 5. Add cleanup jobs
startCsrfCleanup();
startBruteForcecleanup();
```

**Checklist:**
- [ ] All imports added
- [ ] Sentry initialized before other middleware
- [ ] Cookie parser middleware added
- [ ] Security headers middleware added
- [ ] Token extractor middleware added
- [ ] CSRF endpoint created
- [ ] Cleanup jobs started
- [ ] Server tested locally: `npm run dev`

---

## Step 4: Update Auth Routes

**Location:** `backend/src/routes/auth-routes.ts` or `auth-routes-siwa.ts`

**Changes for Login Handler:**

```typescript
// 1. Add imports
import { 
  recordLoginSuccess, 
  recordLoginFailure,
  bruteForcePprotection
} from "../middleware/brute-force-protection.js";
import { 
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies
} from "../middleware/http-only-cookies.js";
import { 
  logLoginSuccess,
  logLoginFailed
} from "../utils/audit-logger.js";
import { 
  captureError,
  captureBruteForceAttempt
} from "../config/sentry-config.js";
import { 
  encryptApiKey,
  encryptPII,
  decryptApiKey,
  decryptPII
} from "../config/database-encryption.js";

// 2. Add brute force protection to login route
router.post(
  "/login",
  bruteForcePprotection("email"), // Add this
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    // Validation...
    const user = await agentService.getAgentByEmail(email);
    const passwordMatch = user && await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      // Record failure for brute force protection
      recordLoginFailure(email, req.ip);
      logLoginFailed(email, "Invalid password", req.ip);
      
      throw new ValidationError("Invalid email or password");
    }

    // 3. Record success and clear failure counter
    recordLoginSuccess(email);
    logLoginSuccess(user.id, email, req.ip, req.get("user-agent"));

    // 4. Generate tokens
    const accessToken = generateToken({ userId: user.id, role: "agent" });
    const refreshToken = generateRefreshToken({ userId: user.id });

    // 5. Set tokens in httpOnly cookies instead of returning in response
    setAccessTokenCookie(res, accessToken, 3600); // 1 hour
    setRefreshTokenCookie(res, refreshToken, 604800); // 7 days

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        // NOTE: Don't return tokens - they're in cookies!
      },
    });
  })
);

// 6. Add logout endpoint
router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).agentId;

    // Clear cookies
    clearAuthCookies(res);

    // Log logout
    logLogout(userId, req.ip);

    res.json({ success: true });
  })
);
```

**Checklist:**
- [ ] All imports added
- [ ] Brute force protection middleware applied to login
- [ ] recordLoginSuccess/recordLoginFailure calls added
- [ ] logLoginSuccess/logLoginFailed calls added
- [ ] setAccessTokenCookie called
- [ ] setRefreshTokenCookie called
- [ ] Logout handler updated with clearAuthCookies
- [ ] API response updated (remove tokens from JSON)
- [ ] Auth routes tested: `npm run test -- auth-routes`

---

## Step 5: Update Room Routes (CSRF Protection)

**Location:** `backend/src/routes/room-routes.ts`

**Changes:**

```typescript
// 1. Add import
import { csrfProtection } from "../middleware/csrf-protection.js";

// 2. Add CSRF protection to state-changing routes
router.post(
  "/",
  requireAuth,
  csrfProtection, // Add this
  asyncHandler(async (req: Request, res: Response) => {
    // Handler code...
  })
);

router.put(
  "/:id",
  requireAuth,
  csrfProtection, // Add this
  asyncHandler(async (req: Request, res: Response) => {
    // Handler code...
  })
);

router.delete(
  "/:id",
  requireAuth,
  csrfProtection, // Add this
  asyncHandler(async (req: Request, res: Response) => {
    // Handler code...
  })
);
```

**Checklist:**
- [ ] CSRF protection import added
- [ ] All POST routes protected with csrfProtection middleware
- [ ] All PUT routes protected
- [ ] All DELETE routes protected
- [ ] Room routes tested: `npm run test -- room-routes`

---

## Step 6: Update Agent Service (Optional: Encryption)

**Location:** `backend/src/services/agent-service.ts`

**Changes for encrypted PII:**

```typescript
// 1. Add imports
import { 
  encryptPII,
  decryptPII,
  encryptApiKey,
  decryptApiKey
} from "../config/database-encryption.js";

// 2. When creating agent
async createAgent(data: CreateAgentRequest): Promise<Agent> {
  // Encrypt sensitive fields
  const encryptedEmail = encryptPII(data.email);
  const apiKey = generateApiKey();
  const encryptedApiKey = encryptApiKey(apiKey);

  const agent = await db.createAgent({
    ...data,
    email: encryptedEmail,
    apiKey: encryptedApiKey, // Encrypted
  });

  return agent;
}

// 3. When retrieving agent
async getAgent(id: string): Promise<Agent | null> {
  const agent = await db.getAgent(id);
  
  if (!agent) return null;

  // Decrypt sensitive fields for response
  return {
    ...agent,
    email: decryptPII(agent.email),
    apiKey: decryptApiKey(agent.apiKey),
  };
}
```

**Checklist:**
- [ ] Encryption imports added
- [ ] Create operations encrypt sensitive fields
- [ ] Retrieve operations decrypt before response
- [ ] Agent service tested
- [ ] Database values are encrypted blobs

---

## Step 7: Update Middleware Index

**Location:** `backend/src/middleware/index.ts`

**Changes:**

```typescript
// Add exports for new middleware
export { securityHeaders } from "./security-headers.js";
export {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  cookieTokenExtractor,
  extractToken,
} from "./http-only-cookies.js";
export {
  csrfProtection,
  csrfTokenEndpoint,
  startCsrfCleanup,
} from "./csrf-protection.js";
export {
  bruteForcePprotection,
  recordLoginFailure,
  recordLoginSuccess,
  getBruteForceStatus,
  startBruteForcecleanup,
} from "./brute-force-protection.js";
```

**Checklist:**
- [ ] All exports added to middleware/index.ts

---

## Step 8: Update Utils Index

**Location:** `backend/src/utils/index.ts` (if exists)

**Changes:**

```typescript
// Add audit logger exports
export { 
  auditLog,
  AuditEventType,
  logLoginSuccess,
  logLoginFailed,
  logLogout,
  logBruteForceAttempt,
  logCsrfFailure,
  logUnauthorizedAccess,
  getAuditLogs,
} from "./audit-logger.js";
```

**Checklist:**
- [ ] Audit logger exports added

---

## Step 9: Update Config Index

**Location:** `backend/src/config/index.ts` (if exists)

**Changes:**

```typescript
// Add config exports
export {
  initializeSentry,
  captureError,
  captureBruteForceAttempt,
  captureAccountLockout,
  captureCsrfMismatch,
  captureXssAttempt,
  captureUnauthorizedAccess,
} from "./sentry-config.js";

export {
  encryptSensitiveData,
  decryptSensitiveData,
  encryptApiKey,
  decryptApiKey,
  encryptPaymentData,
  decryptPaymentData,
  encryptPII,
  decryptPII,
} from "./database-encryption.js";
```

**Checklist:**
- [ ] Sentry exports added
- [ ] Encryption exports added

---

## Step 10: Test All Security Features

### Security Headers Test
```bash
curl -I http://localhost:4000/health | grep "Content-Security-Policy\|X-Frame-Options\|Strict-Transport-Security"
```

### HTTP-Only Cookie Test
```bash
curl -v http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password"}' \
  2>&1 | grep "Set-Cookie"

# Should see: Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict
```

### CSRF Token Test
```bash
CSRF_TOKEN=$(curl -s http://localhost:4000/api/v1/csrf-token | jq -r '.data.token')
echo "CSRF Token: $CSRF_TOKEN"

curl -X POST http://localhost:4000/api/v1/rooms \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Room","type":"debate"}' \
  | jq
```

### Brute Force Test
```bash
# Make 6 failed login attempts
for i in {1..6}; do
  echo "Attempt $i"
  curl -X POST http://localhost:4000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrongpass"}' \
    -w "\nStatus: %{http_code}\n"
done

# Should get 429 on attempt 6+
```

**Checklist:**
- [ ] Security headers present
- [ ] HTTP-Only cookies set correctly
- [ ] CSRF token endpoint works
- [ ] CSRF validation on POST/PUT/DELETE
- [ ] Brute force protection activates
- [ ] All audit logs created
- [ ] No console errors

---

## Step 11: Update Frontend (Optional)

**Location:** `frontend/src`

**For httpOnly Cookie Approach:**

```typescript
// In API service, update requests to include credentials
const response = await fetch("/api/v1/rooms", {
  method: "POST",
  credentials: "include", // IMPORTANT: Include cookies
  headers: {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken, // Get from /api/csrf-token
  },
  body: JSON.stringify(roomData),
});
```

**For SessionStorage Fallback:**

```typescript
// Use secure token storage
import {
  saveTokensToSessionStorage,
  getTokensFromSessionStorage,
  getAccessToken,
  clearSessionStorageTokens,
  isAuthenticated,
} from "./utils/secure-token-storage";

// After login
const { token, refreshToken } = await loginApi.login(email, password);
saveTokensToSessionStorage({
  accessToken: token,
  refreshToken,
  expiresIn: 3600,
});

// In API calls
const token = getAccessToken("sessionStorage");
const response = await fetch("/api/v1/rooms", {
  headers: {
    Authorization: `Bearer ${token}`,
    "X-CSRF-Token": csrfToken,
  },
});
```

**Checklist:**
- [ ] Credentials: "include" added to fetch calls
- [ ] X-CSRF-Token header in POST/PUT/DELETE
- [ ] Token storage utility imported (if using)
- [ ] Logout clears tokens
- [ ] Frontend tested

---

## Step 12: Git Commit & Push

```bash
# Commit changes
git add .
git commit -m "Security hardening Phase 5: XSS, CSRF, brute force, encryption, monitoring"

# Test build
npm run build

# If successful, push to feature branch
git push origin security/phase-5-hardening

# Create PR for code review
```

**Checklist:**
- [ ] All files staged
- [ ] Commit message descriptive
- [ ] Build successful (`npm run build`)
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] PR created for review

---

## Step 13: Code Review & Testing

**Have another team member review:**

- [ ] All security implementations correct
- [ ] No secrets in code
- [ ] Error messages don't leak info
- [ ] Middleware order correct
- [ ] Dependencies updated
- [ ] Tests passing

**Run test suite:**

```bash
npm run test          # Unit tests
npm run test:e2e      # E2E tests (if available)
npm run lint          # ESLint
npm run type-check    # TypeScript check
```

**Checklist:**
- [ ] Code review completed
- [ ] All tests passing
- [ ] No linting errors
- [ ] TypeScript strict mode passing
- [ ] Ready to merge

---

## Step 14: Deploy to Staging

```bash
# Switch to main branch
git checkout main
git pull

# Merge feature branch
git merge security/phase-5-hardening

# Deploy to staging
npm run deploy:staging

# Test on staging
# - Verify security headers
# - Test login flow
# - Test CSRF protection
# - Check Sentry dashboard
# - Monitor logs
```

**Checklist:**
- [ ] Merge to main
- [ ] Staging deployment successful
- [ ] All tests pass on staging
- [ ] Security features working
- [ ] Performance acceptable
- [ ] Ready for production

---

## Step 15: Deploy to Production

```bash
# Tag release
git tag -a v0.1.0-security-hardening -m "Phase 5 security hardening"

# Deploy to production
npm run deploy:production

# Monitor
# - Check Sentry dashboard
# - Monitor error rates
# - Review audit logs
# - Watch performance metrics
```

**Checklist:**
- [ ] Production deployment complete
- [ ] Security headers verified in prod
- [ ] HTTPS working correctly
- [ ] Sentry capturing events
- [ ] No unusual errors
- [ ] Performance baseline established

---

## Rollback Plan (if needed)

```bash
# If critical issue found
git revert <commit-hash>
git push
npm run deploy:production

# Or rollback to previous tag
git checkout v0.0.1
npm run deploy:production
```

**Checklist:**
- [ ] Understand rollback process
- [ ] Have previous version ready
- [ ] Document issue for post-mortem
- [ ] Plan fix for next iteration

---

## Post-Deployment

- [ ] Monitor Sentry for 24 hours
- [ ] Check audit logs for anomalies
- [ ] Collect performance metrics
- [ ] Get team feedback
- [ ] Document lessons learned
- [ ] Plan next security iteration

---

## Time Estimates

| Step | Estimated Time |
|------|-----------------|
| 1-2: Setup | 15 minutes |
| 3: Server update | 30 minutes |
| 4-5: Routes update | 45 minutes |
| 6-9: Optional features | 30 minutes |
| 10: Testing | 30 minutes |
| 11: Frontend (optional) | 30 minutes |
| 12-13: Git & review | 30 minutes |
| 14-15: Deploy & monitor | 1 hour |
| **Total** | **4-5 hours** |

---

## Support

- Questions? Check `SECURITY_HARDENING_GUIDE.md`
- Issues? Review `SECURITY_AUDIT.md`
- Need help? Ask the lead architect

---

✅ **Checklist Complete - Ready for Security Hardening Deployment!**
