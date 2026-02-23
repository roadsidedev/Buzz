/**
 * Zod Validation Schemas
 * Runtime validation for API requests and responses
 */

import { z } from "zod";

/**
 * Agent Schemas
 */
export const VerifiedAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  avatar: z.string().url(),
  erc8004Address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  verifiedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  verification_status: z.string().optional(),
  badge: z.string().optional(),
});

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  erc8004Address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  avatarUrl: z.string().url().optional(),
});

/**
 * Room Schemas
 */
export const CreateRoomRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(["debate", "coding", "research", "trading", "simulation"]),
  objective: z.string().max(500).optional(),
  maxParticipants: z.number().int().min(2).max(10).default(4),
  isPublic: z.boolean().default(true),
  spawnFee: z.number().int().min(0).optional(),
  categoryId: z.string().uuid().optional(),
});

export const RoomSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  status: z.enum(["pending", "live", "completed", "cancelled"]),
  hostAgentId: z.string().uuid(),
  objective: z.string().nullable(),
  maxParticipants: z.number().int(),
  currentParticipants: z.number().int(),
  viewerCount: z.number().int(),
  spawnFee: z.number().int(),
  startedAt: z.date().nullable(),
  endedAt: z.date().nullable(),
  createdAt: z.date(),
});

/**
 * User/Human Schemas
 */
export const UserSchema = z.object({
  id: z.string().uuid(),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  email: z.string().email().optional(),
  username: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Auth Schemas
 */
export const LoginRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string(),
  message: z.string(),
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
  expiresIn: z.number().int(),
});

/**
 * Discovery Schemas
 */
export const DiscoveryFeedRequestSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  type: z.enum(["all", "live", "rooms", "podcasts", "audio"]).default("all"),
  categoryId: z.string().uuid().optional(),
  searchQuery: z.string().optional(),
});

export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(200),
  categoryId: z.string().uuid().optional(),
  type: z.enum(["agents", "rooms", "all"]).default("all"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

/**
 * Payment Schemas
 */
export const PaymentIntentSchema = z.object({
  amount: z.number().int().min(1),
  currency: z.enum(["USDC", "ETH", "SOL"]).default("USDC"),
  recipientAgentId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  tipAmount: z.number().int().min(0).optional(),
});

/**
 * Message/Transcript Schemas
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  agentId: z.string().uuid(),
  content: z.string(),
  score: z.number().min(0).max(100),
  selectedAt: z.date().nullable(),
  createdAt: z.date(),
});

/**
 * Platform Stats Schema
 */
export const PlatformStatsSchema = z.object({
  activeAgents: z.number().int().min(0),
  totalLivestreams: z.number().int().min(0),
  totalPodcasts: z.number().int().min(0),
});

/**
 * Helper to validate and throw on error
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Helper to validate without throwing
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Type exports
 */
export type ValidatedAgent = z.infer<typeof VerifiedAgentSchema>;
export type ValidatedCreateAgent = z.infer<typeof CreateAgentRequestSchema>;
export type ValidatedRoom = z.infer<typeof RoomSchema>;
export type ValidatedCreateRoom = z.infer<typeof CreateRoomRequestSchema>;
export type ValidatedUser = z.infer<typeof UserSchema>;
export type ValidatedLoginRequest = z.infer<typeof LoginRequestSchema>;
export type ValidatedDiscoveryRequest = z.infer<
  typeof DiscoveryFeedRequestSchema
>;
export type ValidatedSearchRequest = z.infer<typeof SearchRequestSchema>;
export type ValidatedPaymentIntent = z.infer<typeof PaymentIntentSchema>;
export type ValidatedMessage = z.infer<typeof MessageSchema>;
export type ValidatedPlatformStats = z.infer<typeof PlatformStatsSchema>;
