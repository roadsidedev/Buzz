/**
 * Payment Repository
 * Data access layer for payment queries
 */

import type { Payment, PaymentStatus, PaymentType } from "../../common/types/index.js";
import { query, queryOne } from "../config/database.js";
import { logger } from "../utils/logger.js";
import { encryptDatabaseField, decryptDatabaseField } from "../config/database-encryption-config.js";

interface PaymentRow {
  id: string;
  agent_id: string;
  room_id: string | null;
  type: string;
  amount: number;
  status: string;
  x402_transaction_id: string | null;
  blockchain_hash: string | null;
  failure_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

/**
 * Payment Repository
 * Handles all payment database operations
 */
export class PaymentRepository {
  /**
   * Create a new payment
   */
  async create(payment: {
    id: string;
    agent_id: string;
    room_id?: string;
    type: string;
    amount: number;
    status: string;
  }): Promise<Payment> {
    const text = `
      INSERT INTO payment (id, agent_id, room_id, type, amount, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, agent_id, room_id, type, amount, status, x402_transaction_id, blockchain_hash, failure_reason, created_at, confirmed_at, completed_at, updated_at
    `;

    const row = await queryOne<PaymentRow>(text, [
      payment.id,
      payment.agent_id,
      payment.room_id || null,
      payment.type,
      payment.amount,
      payment.status,
    ]);

    if (!row) {
      throw new Error("Failed to create payment");
    }

    logger.info("Payment created in database", {
      paymentId: payment.id,
      agentId: payment.agent_id,
      amount: payment.amount,
      type: payment.type,
    });

    return this.mapRowToPayment(row);
  }

  /**
   * Get payment by ID
   */
  async getById(id: string): Promise<Payment | null> {
    const text = `
      SELECT id, agent_id, room_id, type, amount, status, x402_transaction_id, blockchain_hash, failure_reason, created_at, confirmed_at, completed_at, updated_at
      FROM payment
      WHERE id = $1
    `;

    const row = await queryOne<PaymentRow>(text, [id]);

    if (!row) {
      logger.debug("Payment not found", { paymentId: id });
      return null;
    }

    return this.mapRowToPayment(row);
  }

  /**
   * Get payments by agent ID
   */
  async getByAgentId(agentId: string, limit: number = 50): Promise<Payment[]> {
    const text = `
      SELECT id, agent_id, room_id, type, amount, status, x402_transaction_id, blockchain_hash, failure_reason, created_at, confirmed_at, completed_at, updated_at
      FROM payment
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const rows = await query<PaymentRow>(text, [agentId, limit]);

    logger.debug("Fetched agent payments", {
      agentId,
      count: rows.length,
    });

    return rows.map((row) => this.mapRowToPayment(row));
  }

  /**
   * Get payments by room ID
   */
  async getByRoomId(roomId: string): Promise<Payment[]> {
    const text = `
      SELECT id, agent_id, room_id, type, amount, status, x402_transaction_id, blockchain_hash, failure_reason, created_at, confirmed_at, completed_at, updated_at
      FROM payment
      WHERE room_id = $1
      ORDER BY created_at DESC
    `;

    const rows = await query<PaymentRow>(text, [roomId]);

    logger.debug("Fetched room payments", {
      roomId,
      count: rows.length,
    });

    return rows.map((row) => this.mapRowToPayment(row));
  }

  /**
   * Update payment status with encrypted transaction info
   */
  async updateStatus(
    paymentId: string,
    status: PaymentStatus,
    x402TransactionId?: string,
    blockchainHash?: string
  ): Promise<void> {
    const encryptedTxId = encryptDatabaseField("payment", "x402_transaction_id", x402TransactionId);
    const encryptedHash = encryptDatabaseField("payment", "blockchain_hash", blockchainHash);

    const text = `
      UPDATE payment
      SET status = $1, x402_transaction_id = COALESCE($2, x402_transaction_id), blockchain_hash = COALESCE($3, blockchain_hash), confirmed_at = CASE WHEN $1 = 'confirmed' THEN NOW() ELSE confirmed_at END, updated_at = NOW()
      WHERE id = $4
    `;

    await query(text, [status, encryptedTxId || null, encryptedHash || null, paymentId]);

    logger.info("Payment status updated with encrypted PII", {
      paymentId,
      status,
    });
  }

  /**
   * Set payment failure reason
   */
  async setFailureReason(paymentId: string, reason: string): Promise<void> {
    const text = `
      UPDATE payment
      SET status = 'failed', failure_reason = $1, updated_at = NOW()
      WHERE id = $2
    `;

    await query(text, [reason, paymentId]);

    logger.info("Payment marked as failed", {
      paymentId,
      reason,
    });
  }

  /**
   * Map database row to Payment with decryption
   */
  private mapRowToPayment(row: PaymentRow): Payment {
    const decryptedTxId = decryptDatabaseField("payment", "x402_transaction_id", row.x402_transaction_id);
    const decryptedHash = decryptDatabaseField("payment", "blockchain_hash", row.blockchain_hash);

    return {
      id: row.id,
      agentId: row.agent_id,
      roomId: row.room_id || undefined,
      type: row.type as PaymentType,
      amount: row.amount,
      status: row.status as PaymentStatus,
      x402TransactionId: decryptedTxId || row.x402_transaction_id || undefined,
      blockchainHash: decryptedHash || row.blockchain_hash || undefined,
      createdAt: new Date(row.created_at),
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      failureReason: row.failure_reason || undefined,
    };
  }
}

export const paymentRepository = new PaymentRepository();
