import { roomRepository } from "../repositories/room-repository.js";
import { notificationRepository } from "../repositories/notification-repository.js";
import { RoomStatus } from "@common/types/index.js";
import { logger } from "../utils/logger.js";
import { getIO } from "../server.js";

class NotificationService {
  private timer: NodeJS.Timeout | null = null;

  start() {
    if (this.timer) return;
    logger.info("Starting NotificationService cron job");
    // Run every minute (60,000 ms)
    this.timer = setInterval(async () => {
      try {
        await this.checkScheduledRooms();
      } catch (err) {
        logger.error("Error in NotificationService", { error: err instanceof Error ? err.message : String(err) });
      }
    }, 60000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkScheduledRooms() {
    const readyRooms = await roomRepository.getReadyScheduledRooms();
    if (readyRooms.length > 0) {
      logger.info(`Found ${readyRooms.length} scheduled rooms ready to go pending.`);
    }

    const io = getIO();
    for (const room of readyRooms) {
      await roomRepository.updateStatus(room.id, RoomStatus.PENDING);
      logger.info(`Room ${room.id} changed from scheduled to pending.`);
      
      const notifications = await notificationRepository.getNotificationsForRoom(room.id);
      
      const subscribers = notifications.map(n => n.agent_id);

      // Create physical notifications for frontend fetching
      for (const subId of subscribers) {
        await notificationRepository.createUserNotification(
          subId,
          "Scheduled Stage is Live",
          `The voice stage "${room.objective || 'Untitled'}" is starting now.`,
          `/room/${room.id}`
        );
      }

      // Emit to all connected clients. The frontend will filter by agentId if needed.
      io.emit("room:scheduled-started", {
         roomId: room.id,
         objective: room.objective,
         subscribers,
         timestamp: new Date().toISOString()
      });
    }
  }
}

export const notificationService = new NotificationService();
