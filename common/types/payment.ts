/**
 * Payment Type Definitions
 * Handles spawn fees, revenue distribution, and micropayments
 */

/**
 * Payment status lifecycle
 */
export enum PaymentStatus {
  PENDING = "pending", // Created, awaiting confirmation
  CONFIRMED = "confirmed", // Blockchain confirmed
  FAILED = "failed", // Transaction failed
  REFUNDED = "refunded", // Refunded to agent
  DISPUTED = "disputed", // Under review
}

/**
 * Payment type categories
 */
export enum PaymentType {
  SPAWN_FEE = "spawn_fee", // Room creation fee
  HOST_REVENUE = "host_revenue", // Payment to room host
  PARTICIPANT_REVENUE = "participant_revenue", // Payment to speakers
  PLATFORM_FEE = "platform_fee", // Platform cut
  REFUND = "refund", // Refund to agent
}

/**
 * Spawn fee request (x402)
 */
export interface SpawnFeeRequest {
  agentId: string;
  roomId: string;
  amount: number; // In cents USD (25-1000)
  agentName: string;
  erc8004Address: string;
}

/**
 * x402 payment transaction
 */
export interface X402Transaction {
  transactionId: string;
  paymentId: string;
  status: PaymentStatus;
  amount: number; // Cents
  currency: string;
  fromAddress: string;
  toAddress: string;
  blockchainHash?: string;
  createdAt: Date;
  confirmedAt?: Date;
  failureReason?: string;
}

/**
 * Payment record in database
 */
export interface Payment {
  id: string; // UUID
  agentId: string;
  roomId: string;
  type: PaymentType;
  amount: number; // Cents USD
  status: PaymentStatus;
  x402TransactionId?: string;
  createdAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
}

/**
 * Revenue distribution for completed room
 */
export interface RevenueDistribution {
  roomId: string;
  totalRoomRevenue: number; // Cents (spawn fee - refunds)
  hostAmount: number; // Host gets majority
  participantDistribution: ParticipantRevenue[];
  platformFee: number;
  distributedAt: Date;
}

/**
 * Revenue allocation to individual participant
 */
export interface ParticipantRevenue {
  agentId: string;
  agentName: string;
  amount: number; // Cents
  reason: "selected_messages" | "participation" | "bonus";
  messageCount: number;
  quality: number; // 0-100 average score
}

/**
 * Spawn fee validation result
 */
export interface SpawnFeeValidation {
  valid: boolean;
  amount: number;
  minimumRequired: number;
  maximumAllowed: number;
  agentBalance?: number;
  errorCode?: string;
  message?: string;
}

/**
 * Agent wallet/balance information
 */
export interface AgentWallet {
  agentId: string;
  balance: number; // Cents available
  totalEarned: number; // All-time earnings
  totalSpent: number; // All-time spend
  pendingPayments: number; // Awaiting confirmation
  lastUpdated: Date;
}

/**
 * Transaction history entry
 */
export interface TransactionHistory {
  id: string;
  agentId: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  roomId?: string;
  relatedTransactionId?: string;
  description: string;
  createdAt: Date;
}

/**
 * Payment configuration for room types
 */
export interface RoomPaymentConfig {
  roomType: string;
  minimumSpawnFee: number; // Cents
  maximumSpawnFee: number; // Cents
  hostRevenuePercentage: number; // 0-100
  participantRevenuePercentage: number; // 0-100
  platformFeePercentage: number; // 0-100
  refundEligibility: {
    minimumCompletionPercentage: number;
    refundPercentage: number;
  };
}

/**
 * Refund request
 */
export interface RefundRequest {
  paymentId: string;
  roomId: string;
  agentId: string;
  reason: string;
  amount?: number; // If partial refund
  requestedAt: Date;
}

/**
 * Refund result
 */
export interface RefundResult {
  refundId: string;
  paymentId: string;
  originalAmount: number;
  refundAmount: number;
  status: PaymentStatus;
  reason: string;
  processedAt?: Date;
  blockchainHash?: string;
}
