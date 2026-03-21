/**
 * Any Auth Middleware
 * Supports either API key or legacy auth (now just API key)
 */

import { requireApiKey } from "./api-key-auth.js";

export const requireAnyAuth = requireApiKey;
