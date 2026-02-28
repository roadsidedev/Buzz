/**
 * DEPRECATED: SIWA Auth Routes
 *
 * This file has been replaced by the new Moltbook-style auth system.
 * All SIWA endpoints have been removed.
 *
 * New auth routes are in:
 *   - auth-routes.ts — /auth/me, /auth/status, /auth/claim, etc.
 *   - agent-routes.ts — /agents/register
 *   - badge-routes.ts — /agents/me/verify/erc8004, /agents/me/verify/said
 *
 * This file is kept as a stub to prevent import errors during migration.
 * It can be safely deleted once all references are removed.
 */

import { Router } from "express";
const router = Router();
export default router;
