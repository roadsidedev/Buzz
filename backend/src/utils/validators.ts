/**
 * Input validation utilities using Zod schemas
 */

import { z } from "zod";
import { ValidationError } from "./errors.js";

// Room type enum
const RoomTypeEnum = z.enum(["debate", "coding", "research", "trading", "simulation", "podcast", "livestream", "brainstorm"]);

// Spawn fee validator (25 cents to $100)
const SpawnFeeSchema = z
  .number()
  .min(25, "Spawn fee must be at least $0.25")
  .max(10000, "Spawn fee cannot exceed $100.00")
  .int("Spawn fee must be in cents");

// Objective validator (10-500 chars)
const ObjectiveSchema = z
  .string()
  .min(10, "Objective must be at least 10 characters")
  .max(500, "Objective cannot exceed 500 characters")
  .trim();

// Message text validator (1-5000 chars)
const MessageTextSchema = z
  .string()
  .min(1, "Message cannot be empty")
  .max(5000, "Message cannot exceed 5000 characters")
  .trim();

// Agent name validator
const AgentNameSchema = z
  .string()
  .min(2, "Agent name must be at least 2 characters")
  .max(100, "Agent name cannot exceed 100 characters")
  .trim();

// Ethereum address validator
const EthAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

// URL validator
const UrlSchema = z.string().url("Invalid URL format").optional();

/**
 * Register request validator
 */
export const RegisterRequestSchema = z.object({
  name: AgentNameSchema,
  erc8004Address: EthAddressSchema,
  avatarUrl: UrlSchema,
});

export type ValidatedRegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Create room request validator
 */
export const CreateRoomRequestSchema = z.object({
  type: RoomTypeEnum,
  objective: ObjectiveSchema,
  spawnFee: SpawnFeeSchema,
  invitedAgentIds: z.array(z.string().uuid()).optional(),
  scheduledFor: z.string().datetime().or(z.date()).optional(),
});

export type ValidatedCreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

/**
 * Submit message request validator
 */
export const SubmitMessageRequestSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  text: MessageTextSchema,
});

export type ValidatedSubmitMessageRequest = z.infer<
  typeof SubmitMessageRequestSchema
>;

/**
 * Join room request validator
 */
export const JoinRoomRequestSchema = z.object({
  roomId: z.string().uuid("Invalid room ID"),
  agentId: z.string().uuid("Invalid agent ID"),
});

export type ValidatedJoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;

/**
 * Generic validation wrapper
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.errors.reduce(
        (acc, err) => {
          const field = err.path.join(".");
          acc[field] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );
      throw new ValidationError("Input validation failed", { fieldErrors });
    }
    throw error;
  }
}

/**
 * Validate spawn fee specifically
 */
export function validateSpawnFee(amount: unknown): number {
  return validate(SpawnFeeSchema, amount);
}

/**
 * Validate objective
 */
export function validateObjective(objective: unknown): string {
  return validate(ObjectiveSchema, objective);
}

/**
 * Validate Ethereum address
 */
export function validateEthereumAddress(address: unknown): string {
  return validate(EthAddressSchema, address);
}

/**
 * Validate message text
 */
export function validateMessageText(text: unknown): string {
  return validate(MessageTextSchema, text);
}

// ============================================================================
// PODCAST VALIDATORS
// ============================================================================

// Podcast title validator (2-255 chars)
const PodcastTitleSchema = z
  .string()
  .min(2, "Podcast title must be at least 2 characters")
  .max(255, "Podcast title cannot exceed 255 characters")
  .trim();

// Podcast description validator (optional, 0-2000 chars)
const PodcastDescriptionSchema = z
  .string()
  .max(2000, "Description cannot exceed 2000 characters")
  .trim()
  .optional();

// Category validator
const CategorySchema = z.enum(["tech", "finance", "creative", "dev", "research", "other"]);

// Voice ID validator (optional)
const VoiceIdSchema = z
  .string()
  .min(1, "Voice ID required")
  .max(100, "Voice ID invalid")
  .optional();

/**
 * Create podcast request validator
 */
export const CreatePodcastRequestSchema = z.object({
  title: PodcastTitleSchema,
  description: PodcastDescriptionSchema,
  category: CategorySchema,
  coverImageUrl: UrlSchema,
});

export type ValidatedCreatePodcastRequest = z.infer<typeof CreatePodcastRequestSchema>;

/**
 * Update podcast request validator
 */
export const UpdatePodcastSchema = z.object({
  title: PodcastTitleSchema.optional(),
  description: PodcastDescriptionSchema,
  category: CategorySchema.optional(),
  coverImageUrl: UrlSchema,
  status: z.enum(["active", "inactive", "archived"]).optional(),
});

export type ValidatedUpdatePodcastRequest = z.infer<typeof UpdatePodcastSchema>;

/**
 * Create episode request validator
 */
export const CreateEpisodeRequestSchema = z.object({
  title: z
    .string()
    .min(2, "Episode title must be at least 2 characters")
    .max(255, "Episode title cannot exceed 255 characters")
    .trim(),
  description: PodcastDescriptionSchema,
  sourceUrls: z
    .array(z.string().url("Invalid URL in sourceUrls"))
    .optional(),
  voicePreferences: z
    .object({
      primaryVoiceId: VoiceIdSchema,
      secondaryVoiceId: VoiceIdSchema,
    })
    .optional(),
});

export type ValidatedCreateEpisodeRequest = z.infer<typeof CreateEpisodeRequestSchema>;
