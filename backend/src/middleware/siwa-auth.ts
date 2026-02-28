/**
 * DEPRECATED: SIWA Auth Middleware
 *
 * Replaced by api-key-auth.ts middleware.
 * This file is kept as a stub to prevent import errors.
 */

import { Request, Response, NextFunction } from "express";

export const verifySIWAReceipt = (req: Request, res: Response, next: NextFunction) => {
  res.status(410).json({
    success: false,
    error: {
      code: "DEPRECATED",
      message: "SIWA authentication has been removed. Use API key auth instead. Register at POST /api/v1/agents/register",
      statusCode: 410,
    },
  });
};

export const optionalSIWA = (req: Request, res: Response, next: NextFunction) => {
  next();
};
