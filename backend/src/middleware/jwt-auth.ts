/**
 * JWT Authentication Middleware
 *
 * Verifies Privy access tokens (JWTs) using native Web Crypto API.
 * Supports both HMAC (shared secret) and RS256/ES256 (JWKS public keys).
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Decode JWT header to determine algorithm
 * 3. Verify signature using appropriate method
 * 4. Extract `sub` claim (Privy DID) from payload
 * 5. Resolve agent record via BuzzAuthService.getAgentByPrivyDid()
 * 6. Attach req.agent for downstream middleware/routes
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

// Web Crypto API types — use `any` since ES2020 lib doesn't include them.
// Node.js 20+ has these globals available at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebCryptoKey = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebKeyUsage = any;

// Lazy-loaded to avoid circular dependency
let _authService: any = null;
async function getAuthService() {
  if (!_authService) {
    const { buzzAuthService } = await import("../services/index.js");
    _authService = buzzAuthService;
  }
  return _authService;
}

// ============================================================
// Native JWT Verification (no external dependencies)
// ============================================================

/**
 * Base64url decode to Uint8Array
 */
function base64urlDecode(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode JWT header and payload without verification
 */
function decodeJwtParts(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Uint8Array;
} {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT structure");
  }

  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
  const signingInput = `${parts[0]}.${parts[1]}`;
  const signature = base64urlDecode(parts[2]);

  return { header, payload, signingInput, signature };
}

/**
 * Verify HMAC signature (HS256/HS384/HS512)
 */
async function verifyHmac(
  signingInput: string,
  signature: Uint8Array,
  secret: string,
  algorithm: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC" },
    false,
    ["verify"],
  );

  const hashAlgo = algorithm === "HS384" ? "SHA-384" : algorithm === "HS512" ? "SHA-512" : "SHA-256";

  return crypto.subtle.verify(
    { name: "HMAC", hash: hashAlgo },
    key,
    signature,
    new TextEncoder().encode(signingInput),
  );
}

/**
 * Verify RSA/ECDSA signature using JWKS public key
 */
async function verifyAsymmetric(
  signingInput: string,
  signature: Uint8Array,
  publicKey: WebCryptoKey,
  algorithm: string,
): Promise<boolean> {
  const algo = algorithm.startsWith("RS") ? "RSASSA-PKCS1-v1_5" : "ECDSA";

  const hashAlgo = algorithm === "RS384" || algorithm === "ES384"
    ? "SHA-384"
    : algorithm === "RS512" || algorithm === "ES512"
      ? "SHA-512"
      : "SHA-256";

  if (algo === "RSASSA-PKCS1-v1_5") {
    return crypto.subtle.verify(
      { name: algo, hash: hashAlgo },
      publicKey,
      signature,
      new TextEncoder().encode(signingInput),
    );
  }

  return false;
}

/**
 * Import a JWK as a CryptoKey for verification
 */
async function importJwk(jwk: Record<string, unknown>, algorithm: string): Promise<WebCryptoKey> {
  const isRSA = algorithm.startsWith("RS");

  const keyData = {
    kty: jwk.kty as string,
    n: jwk.n as string,
    e: jwk.e as string,
    alg: algorithm,
    ext: true,
    key_ops: ["verify"] as WebKeyUsage[],
  };

  return crypto.subtle.importKey(
    "jwk",
    keyData,
    {
      name: isRSA ? "RSASSA-PKCS1-v1_5" : "ECDSA",
      hash: isRSA ? "SHA-256" : undefined,
      namedCurve: isRSA ? undefined : (jwk.crv as string),
    },
    true,
    ["verify"],
  );
}

/**
 * Fetch JWKS and find the matching key by kid
 */
async function fetchJwksKey(
  jwksUri: string,
  kid: string,
  algorithm: string,
): Promise<WebCryptoKey | null> {
  try {
    const response = await fetch(jwksUri, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const jwks = await response.json();
    const keys = jwks.keys as Array<Record<string, unknown>>;

    const matchingKey = keys.find((k) => k.kid === kid);
    if (!matchingKey) return null;

    return importJwk(matchingKey, algorithm);
  } catch {
    return null;
  }
}

/**
 * Verify a JWT token and return the decoded payload.
 *
 * Verification order:
 * 1. If PRIVY_APP_ID is set, use Privy's JWKS endpoint
 * 2. If JWT_SECRET is set, use HMAC verification
 * 3. If neither, skip verification (dev mode — log warning)
 */
export async function verifyJwtToken(
  token: string,
): Promise<Record<string, unknown> | null> {
  try {
    const { header, payload, signingInput, signature } = decodeJwtParts(token);
    const alg = header.alg as string;
    const kid = header.kid as string | undefined;

    // Check expiry
    const exp = payload.exp as number | undefined;
    if (exp && Date.now() >= exp * 1000) {
      logger.debug("JWT expired", { exp });
      return null;
    }

    // Check not-before
    const nbf = payload.nbf as number | undefined;
    if (nbf && Date.now() < nbf * 1000) {
      logger.debug("JWT not yet valid", { nbf });
      return null;
    }

    // Try Privy JWKS verification first
    const privyAppId = process.env.PRIVY_APP_ID;
    if (privyAppId && kid && (alg === "RS256" || alg === "ES256")) {
      const jwksUri = `https://auth.privy.io/api/v1/apps/${privyAppId}/jwks.json`;
      const publicKey = await fetchJwksKey(jwksUri, kid, alg);

      if (publicKey) {
        const valid = await verifyAsymmetric(signingInput, signature, publicKey, alg);
        if (valid) return payload;
        logger.debug("Privy JWKS signature verification failed");
      }
    }

    // Fall back to HMAC verification with shared secret
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && (alg === "HS256" || alg === "HS384" || alg === "HS512")) {
      const valid = await verifyHmac(signingInput, signature, jwtSecret, alg);
      if (valid) return payload;
      logger.debug("HMAC signature verification failed");
    }

    // Dev mode: no verification configured, accept token as-is
    if (!privyAppId && !jwtSecret) {
      logger.warn("JWT verification skipped — no PRIVY_APP_ID or JWT_SECRET configured (dev mode)");
      return payload;
    }

    return null;
  } catch (err) {
    logger.debug("JWT verification error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ============================================================
// Express Middleware
// ============================================================

/**
 * Extract Bearer token from request.
 * Skips API keys (beely_xxx) — those are handled by API key middleware.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.startsWith("beely_")) return null;
    return token;
  }
  return null;
}

/**
 * JWT authentication middleware.
 * Verifies Privy access tokens and attaches agent to request.
 *
 * Returns:
 * - 401 if no valid JWT provided
 * - 403 if agent is suspended
 * - Calls next() with req.agent attached on success
 */
export const requireJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: "NO_JWT_TOKEN",
          message: "Authorization header with valid JWT required",
          hint: "Login via Privy to get an access token",
          statusCode: 401,
        },
      });
      return;
    }

    const payload = await verifyJwtToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_JWT",
          message: "Invalid or expired access token",
          statusCode: 401,
        },
      });
      return;
    }

    // Extract Privy DID from `sub` claim
    const privyDid = payload.sub as string | undefined;
    if (!privyDid) {
      res.status(401).json({
        success: false,
        error: {
          code: "MISSING_SUBJECT",
          message: "Token missing subject claim",
          statusCode: 401,
        },
      });
      return;
    }

    const authService = await getAuthService();
    const agent = await authService.getAgentByPrivyDid(privyDid);

    if (!agent) {
      res.status(401).json({
        success: false,
        error: {
          code: "AGENT_NOT_FOUND",
          message: "No agent record found for this user. Please sync your profile first.",
          hint: "POST /api/v1/agents/sync to create your agent record",
          statusCode: 401,
        },
      });
      return;
    }

    if (agent.suspendedAt) {
      res.status(403).json({
        success: false,
        error: {
          code: "AGENT_SUSPENDED",
          message: "Your account has been suspended",
          statusCode: 403,
        },
      });
      return;
    }

    req.agent = {
      id: agent.id,
      agentId: agent.id,
      username: agent.username,
      name: agent.name,
      role: agent.role,
      claimStatus: agent.claimStatus,
      description: agent.description,
      badges: (agent.badges || []).map((b: any) => ({
        provider: b.provider,
        verified: b.verified,
        reputationScore: b.reputationScore || 0,
      })),
    };

    logger.debug("JWT authenticated", {
      agentId: agent.id,
      name: agent.name,
      path: req.path,
    });

    next();
  } catch (err: any) {
    logger.error("JWT auth middleware error", {
      error: err.message,
      path: req.path,
    });

    res.status(401).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication check failed",
        statusCode: 401,
      },
    });
  }
};

/**
 * Optional JWT authentication.
 * Attaches agent if valid JWT present, continues otherwise.
 */
export const optionalJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = extractBearerToken(req);

    if (token) {
      const payload = await verifyJwtToken(token);

      if (payload?.sub) {
        const authService = await getAuthService();
        const agent = await authService.getAgentByPrivyDid(payload.sub as string);

        if (agent && !agent.suspendedAt) {
          req.agent = {
            id: agent.id,
            agentId: agent.id,
            username: agent.username,
            name: agent.name,
            role: agent.role,
            claimStatus: agent.claimStatus,
            description: agent.description,
            badges: (agent.badges || []).map((b: any) => ({
              provider: b.provider,
              verified: b.verified,
              reputationScore: b.reputationScore || 0,
            })),
          };

          logger.debug("Optional JWT: agent authenticated", {
            agentId: agent.id,
          });
        }
      }
    }
  } catch (err) {
    logger.debug("Optional JWT: invalid token ignored", { error: err });
  }

  next();
};
