/**
 * Payment Type Definitions
 * Handles spawn fees, revenue distribution, and micropayments
 * Supports Base (EVM) and Solana chains via CDP facilitator.
 */
/**
 * Supported payment chains
 */
export type PaymentChain = "base" | "solana";
/**
 * Payment status lifecycle
 */
export declare enum PaymentStatus {
    PENDING = "pending",// Created, awaiting confirmation
    CONFIRMED = "confirmed",// Blockchain confirmed
    FAILED = "failed",// Transaction failed
    REFUNDED = "refunded",// Refunded to agent
    DISPUTED = "disputed"
}
/**
 * Payment type categories
 */
export declare enum PaymentType {
    SPAWN_FEE = "spawn_fee",// Room creation fee
    HOST_REVENUE = "host_revenue",// Payment to room host
    PARTICIPANT_REVENUE = "participant_revenue",// Payment to speakers
    PLATFORM_FEE = "platform_fee",// Platform cut
    REFUND = "refund"
}
/**
 * Spawn fee request (x402)
 */
export interface SpawnFeeRequest {
    agentId: string;
    roomId: string;
    amount: number;
    agentName: string;
    walletAddress: string;
    chain?: PaymentChain;
}
/**
 * x402 payment transaction
 */
export interface X402Transaction {
    transactionId: string;
    paymentId: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    fromAddress: string;
    toAddress: string;
    chain: PaymentChain;
    blockchainHash?: string;
    createdAt: Date;
    confirmedAt?: Date;
    failureReason?: string;
}
/**
 * Payment record in database
 */
export interface Payment {
    id: string;
    agentId: string;
    roomId: string;
    type: PaymentType;
    amount: number;
    status: PaymentStatus;
    chain: PaymentChain;
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
    totalRoomRevenue: number;
    hostAmount: number;
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
    amount: number;
    reason: "selected_messages" | "participation" | "bonus";
    messageCount: number;
    quality: number;
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
    balance: number;
    totalEarned: number;
    totalSpent: number;
    pendingPayments: number;
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
    minimumSpawnFee: number;
    maximumSpawnFee: number;
    hostRevenuePercentage: number;
    participantRevenuePercentage: number;
    platformFeePercentage: number;
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
    amount?: number;
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
//# sourceMappingURL=payment.d.ts.map