/**
 * Payment Service
 * Business logic for spawn fees and revenue distribution
 */

import crypto from "crypto";
import type {
  Payment,
  PaymentStatus,
  PaymentType,
} from "../../common/types/index.js";
import { PaymentError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { paymentRepository } from "../repositories/index.js";

interface ProcessPaymentInput {
  agentId: string;
  roomId: string;
  amount: number; // Cents
  type: PaymentType;
  erc8004Address: string;
}

/**
 * Payment Service
 * Handles spawn fees, revenue distribution, and payment processing via x402
 */
export class PaymentService {
  /**
   * Process a payment (spawn fee or revenue)
   */
  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    // Validate amount
    if (input.amount <= 0) {
      throw new ValidationError("Payment amount must be positive", {
        field: "amount",
        provided: input.amount,
      });
    }

    // Create payment record in database
    const payment = await paymentRepository.create({
      id: crypto.randomUUID(),
      agent_id: input.agentId,
      room_id: input.roomId,
      type: input.type,
      amount: input.amount,
      status: "pending",
    });

    logger.info("Payment initiated", {
      paymentId: payment.id,
      agentId: input.agentId,
      amount: input.amount,
      type: input.type,
    });

    // TODO: Call x402 SDK to process payment
    // const tx402 = await x402.createTransaction({
    //   to: input.erc8004Address,
    //   amount: input.amount,
    // });

    // Update payment with x402 transaction ID
    // await paymentRepository.updateStatus(payment.id, "confirmed", tx402.id, tx402.blockchainHash);

    return payment;
  }

  /**
   * Charge spawn fee for room creation
   */
  async chargeSpawnFee(
    agentId: string,
    roomId: string,
    spawnFee: number,
    erc8004Address: string,
  ): Promise<Payment> {
    return this.processPayment({
      agentId,
      roomId,
      amount: spawnFee,
      type: "spawn_fee",
      erc8004Address,
    });
  }

  /**
   * Distribute revenue to room participants
   */
  async distributeRevenue(
    roomId: string,
    hostAgentId: string,
    participantPayments: Array<{ agentId: string; amount: number }>,
  ): Promise<Payment[]> {
    const payments: Payment[] = [];

    // Host gets 60% of spawn fee (reduced by platform fee)
    const hostPayment = await this.processPayment({
      agentId: hostAgentId,
      roomId,
      amount: 0, // TODO: Calculate from spawn fee
      type: "host_revenue",
      erc8004Address: "", // TODO: Get from agent
    });

    payments.push(hostPayment);

    // Participants get 30% split
    for (const participant of participantPayments) {
      const payment = await this.processPayment({
        agentId: participant.agentId,
        roomId,
        amount: participant.amount,
        type: "participant_revenue",
        erc8004Address: "", // TODO: Get from agent
      });
      payments.push(payment);
    }

    logger.info("Revenue distributed", {
      roomId,
      payments: payments.length,
    });

    return payments;
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId: string): Promise<Payment> {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    logger.debug("Fetching payment status", { paymentId });

    return payment;
  }

  /**
   * Refund a payment
   */
  async refundPayment(paymentId: string, reason: string): Promise<Payment> {
    // Get original payment
    const payment = await this.getPaymentStatus(paymentId);

    // TODO: Call x402 refund API

    // Mark as refunded in database
    await paymentRepository.setFailureReason(paymentId, reason);

    logger.info("Payment refunded", { paymentId, reason });

    return payment;
  }

  /**
   * Charge podcast episode generation cost
   *
   * @param agentId - Agent being charged
   * @param episodeId - Episode being generated
   * @param costUsdc - Cost in USDC (micropayments)
   * @param description - Payment description
   * @returns Payment record
   * @throws ValidationError if cost invalid
   * @throws PaymentError if x402 fails
   */
  async chargeGenerationCost(
    agentId: string,
    episodeId: string,
    costUsdc: number,
    description?: string,
  ): Promise<Payment> {
    // Validate cost
    if (costUsdc <= 0) {
      throw new ValidationError("Generation cost must be positive", {
        field: "costUsdc",
        provided: costUsdc,
      });
    }

    // Create payment record in database
    const payment = await paymentRepository.create({
      id: crypto.randomUUID(),
      agent_id: agentId,
      room_id: undefined, // No room for podcast generation
      type: "podcast_generation",
      amount: Math.round(costUsdc * 100), // Convert to cents
      status: "pending",
    });

    logger.info("Podcast generation cost recorded", {
      paymentId: payment.id,
      agentId,
      episodeId,
      costUsdc,
      description,
    });

    // TODO: Call x402 SDK to charge
    // const tx402 = await x402.createTransaction({
    //   to: agent.erc8004Address,
    //   amount: costUsdc,
    //   description: description || `Podcast episode: ${episodeId}`,
    // });

    // TODO: Update payment status to confirmed
    // await paymentRepository.updateStatus(
    //   payment.id,
    //   "confirmed",
    //   tx402.id,
    //   tx402.blockchainHash
    // );

    return payment;
  }
}

export const paymentService = new PaymentService();
