import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/index.js";
import { notificationRepository } from "../repositories/notification-repository.js";

const router = Router();

/**
 * GET /notifications
 * Fetch notifications for a specific user.
 * Expects ?userId=xxx (DID or agent ID)
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: {
          code: "MISSING_USER_ID",
          message: "?userId is required",
          statusCode: 400
        }
      });
      return;
    }

    const notifications = await notificationRepository.getUserNotifications(userId);
    res.json({ success: true, data: notifications });
  })
);

/**
 * POST /notifications/:id/read
 * Mark a notification as read.
 */
router.post(
  "/:id/read",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    await notificationRepository.markNotificationAsRead(id);
    res.json({ success: true, message: "Marked as read" });
  })
);

export default router;
