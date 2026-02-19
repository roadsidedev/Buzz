/**
 * Middleware exports
 */

export * from "./auth";
export * from "./siwa-auth";
export * from "./rate-limit";
export * from "./error-handler";
export {
  validateJWT as requireAuth,
  optionalAuth,
  generateToken,
} from "./auth.js";
