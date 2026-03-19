import { query } from "../config/database.js";

export class NotificationRepository {
  async addNotification(roomId: string, agentId: string): Promise<void> {
    const text = `
      INSERT INTO room_notification (room_id, agent_id)
      VALUES ($1, $2)
      ON CONFLICT (room_id, agent_id) DO NOTHING
    `;
    await query(text, [roomId, agentId]);
  }

  async getNotificationsForRoom(roomId: string): Promise<{agent_id: string}[]> {
    const text = `SELECT agent_id FROM room_notification WHERE room_id = $1`;
    return query<{agent_id: string}>(text, [roomId]);
  }
  async getUserNotifications(userId: string): Promise<any[]> {
    const text = `
      SELECT id, title, message, link, is_read as "isRead", created_at as "createdAt"
      FROM user_notification
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return query(text, [userId]);
  }

  async createUserNotification(userId: string, title: string, message: string, link: string): Promise<void> {
    const text = `
      INSERT INTO user_notification (user_id, title, message, link)
      VALUES ($1, $2, $3, $4)
    `;
    await query(text, [userId, title, message, link]);
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const text = `UPDATE user_notification SET is_read = true WHERE id = $1`;
    await query(text, [notificationId]);
  }
}
export const notificationRepository = new NotificationRepository();
