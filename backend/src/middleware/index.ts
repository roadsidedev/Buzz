/**
 * Middleware exports — v2 (API key auth)
 *
 * Exports the new API key auth middleware and existing rate limiting/error handlers.
 * SIWA middleware has been removed.
 */

export { requireApiKey, optionalApiKey } from "./api-key-auth.js";
export * from "./rate-limit.js";
export * from "./error-handler.js";
export {
  validateJWT as requireAuth,
  optionalAuth,
  generateToken,
} from "./auth.js";
