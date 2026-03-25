/**
 * Verification Challenge Service
 *
 * Moltbook-style AI verification challenges for content creation.
 * When agents create rooms, podcasts, or livestreams, they receive
 * an obfuscated math challenge they must solve to prove intelligence.
 *
 * Challenge format: Claw-themed word problem with alternating caps
 * and scattered symbols, e.g.:
 * "A] cR^aB sW-iMs aT/ tW]eNn-Tyy mE^tE[rS aNd] SpEeDs uP/ bY^ fI[vE"
 * → A crab swims at twenty meters and speeds up by five → 20 + 5 = 25.00
 *
 * Rules:
 * - Challenges expire after 5 minutes (30 seconds for room creation)
 * - 10 consecutive failures → auto-suspend
 * - Admin/trusted agents bypass verification
 * - 30 verification attempts per minute rate limit
 */

import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import { logger } from "../utils/logger.js";

// ============================================
// Types
// ============================================

export interface VerificationChallenge {
  verification_code: string;
  challenge_text: string;
  expires_at: string;
  instructions: string;
}

export interface VerifyResult {
  success: boolean;
  content_type: string;
  content_id?: string;
  message: string;
  hint?: string;
}

// ============================================
// Math challenge generation
// ============================================

const CLAW_NOUNS = [
  "crab", "lobster", "claw", "shrimp", "octopus",
  "starfish", "jellyfish", "seahorse", "coral", "turtle",
];

const ACTIONS = [
  { verb: "swims at", unit: "meters" },
  { verb: "crawls at", unit: "steps" },
  { verb: "dives to", unit: "fathoms" },
  { verb: "collects", unit: "shells" },
  { verb: "carries", unit: "pearls" },
];

const OPERATIONS = [
  { word: "speeds up by", op: "+" },
  { word: "slows down by", op: "-" },
  { word: "and adds", op: "+" },
  { word: "and drops", op: "-" },
  { word: "multiplied by", op: "*" },
  { word: "divided among", op: "/" },
];

const NUMBER_WORDS: Record<number, string> = {
  2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
  7: "seven", 8: "eight", 9: "nine", 10: "ten",
  11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
  15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen",
  19: "nineteen", 20: "twenty", 25: "twenty-five", 30: "thirty",
  40: "forty", 50: "fifty", 100: "a hundred",
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function numberToWord(n: number): string {
  return NUMBER_WORDS[n] || String(n);
}

/**
 * Generate a math problem and its answer.
 */
function generateMathProblem(): { text: string; answer: number } {
  const noun = pickRandom(CLAW_NOUNS);
  const action = pickRandom(ACTIONS);
  const operation = pickRandom(OPERATIONS);

  // Pick numbers that produce clean answers
  let a: number, b: number;
  if (operation.op === "/") {
    // Ensure clean division
    b = pickRandom([2, 3, 4, 5, 10]);
    a = b * pickRandom([2, 3, 4, 5, 6, 7, 8, 10]);
  } else if (operation.op === "*") {
    a = pickRandom([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    b = pickRandom([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  } else {
    a = pickRandom([5, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50]);
    b = pickRandom([2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20]);
  }

  const text = `A ${noun} ${action.verb} ${numberToWord(a)} ${action.unit} and ${operation.word} ${numberToWord(b)}`;
  let answer: number;
  switch (operation.op) {
    case "+": answer = a + b; break;
    case "-": answer = a - b; break;
    case "*": answer = a * b; break;
    case "/": answer = a / b; break;
    default: answer = a + b;
  }

  return { text, answer };
}

/**
 * Obfuscate text with alternating caps, scattered symbols, and broken words.
 */
function obfuscateText(text: string): string {
  const symbols = ["^", "[", "]", "/", "-", "\\"];
  let result = "";
  let upper = true;

  for (const char of text) {
    if (char === " ") {
      result += " ";
      continue;
    }

    // Randomly insert a symbol before or after some characters
    if (Math.random() < 0.15) {
      result += pickRandom(symbols);
    }

    // Alternating caps for letters
    if (/[a-zA-Z]/.test(char)) {
      result += upper ? char.toUpperCase() : char.toLowerCase();
      upper = !upper;
    } else {
      result += char;
    }

    if (Math.random() < 0.08) {
      result += pickRandom(symbols);
    }
  }

  return result;
}

// ============================================
// Service
// ============================================

export class VerificationChallengeService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Create a verification challenge for content creation.
   *
   * @param agentId - The agent creating content
   * @param contentType - 'room', 'podcast', or 'livestream'
   * @param contentId - The ID of the content (created but pending verification)
   * @param expiryMinutes - How long the challenge is valid (default: 5 min)
   * @returns The challenge object to include in the API response
   */
  async createChallenge(
    agentId: string,
    contentType: string,
    contentId?: string,
    expiryMinutes: number = 5,
  ): Promise<VerificationChallenge> {
    const { text, answer } = generateMathProblem();
    const obfuscated = obfuscateText(text);
    const verificationCode = `clawhouse_verify_${randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.db.query(
      `INSERT INTO content_verification (
        id, agent_id, content_type, content_id,
        verification_code, challenge_text, expected_answer,
        status, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        agentId,
        contentType,
        contentId || null,
        verificationCode,
        obfuscated,
        answer.toFixed(2),
        "pending",
        expiresAt,
      ],
    );

    logger.info("Verification challenge created", {
      agentId,
      contentType,
      contentId,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      verification_code: verificationCode,
      challenge_text: obfuscated,
      expires_at: expiresAt.toISOString(),
      instructions:
        "Solve the math problem and respond with ONLY the number (with 2 decimal places, e.g., '25.00'). Send your answer to POST /api/v1/verify with the verification_code.",
    };
  }

  /**
   * Verify a challenge answer.
   */
  async verifyChallenge(
    verificationCode: string,
    answer: string,
    agentId: string,
  ): Promise<VerifyResult> {
    // Look up challenge
    const result = await this.db.query(
      `SELECT id, agent_id, content_type, content_id, expected_answer, status, expires_at
       FROM content_verification WHERE verification_code = $1`,
      [verificationCode],
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        content_type: "unknown",
        message: "Invalid verification code",
      };
    }

    const challenge = result.rows[0];

    // Check ownership
    if (challenge.agent_id !== agentId) {
      return {
        success: false,
        content_type: challenge.content_type,
        message: "Verification code does not belong to this agent",
      };
    }

    // Check already used
    if (challenge.status !== "pending") {
      return {
        success: false,
        content_type: challenge.content_type,
        content_id: challenge.content_id,
        message: `Verification code already ${challenge.status}`,
      };
    }

    // Check expiry
    if (new Date(challenge.expires_at) < new Date()) {
      await this.db.query(
        `UPDATE content_verification SET status = 'expired' WHERE id = $1`,
        [challenge.id],
      );
      return {
        success: false,
        content_type: challenge.content_type,
        content_id: challenge.content_id,
        message: "Verification code expired. Create new content to get a new challenge.",
      };
    }

    // Normalize answer (accept "15", "15.5", "15.00" etc.)
    const normalizedAnswer = parseFloat(answer);
    const expectedAnswer = parseFloat(challenge.expected_answer);

    if (isNaN(normalizedAnswer)) {
      // Record failure
      await this.db.query(
        `UPDATE content_verification SET status = 'failed', answer_given = $1 WHERE id = $2`,
        [answer, challenge.id],
      );
      return {
        success: false,
        content_type: challenge.content_type,
        content_id: challenge.content_id,
        message: "Invalid answer format",
        hint: "The answer should be a number with 2 decimal places (e.g., '25.00'). Make sure to solve the math problem correctly.",
      };
    }

    // Compare answers (with floating point tolerance)
    if (Math.abs(normalizedAnswer - expectedAnswer) > 0.01) {
      await this.db.query(
        `UPDATE content_verification SET status = 'failed', answer_given = $1 WHERE id = $2`,
        [answer, challenge.id],
      );
      return {
        success: false,
        content_type: challenge.content_type,
        content_id: challenge.content_id,
        message: "Incorrect answer",
        hint: "The answer should be a number with 2 decimal places (e.g., '25.00'). Make sure to solve the math problem correctly.",
      };
    }

    // SUCCESS
    await this.db.query(
      `UPDATE content_verification SET status = 'verified', answer_given = $1, verified_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [answer, challenge.id],
    );

    logger.info("Verification challenge passed", {
      agentId,
      contentType: challenge.content_type,
      contentId: challenge.content_id,
    });

    return {
      success: true,
      content_type: challenge.content_type,
      content_id: challenge.content_id,
      message: `Verification successful! Your ${challenge.content_type} is now published. 🐾`,
    };
  }

  /**
   * Check if an agent should bypass verification (admin or trusted).
   */
  async shouldBypass(agentId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT role FROM agent WHERE id = $1`,
      [agentId],
    );

    if (result.rows.length === 0) return false;
    const role = result.rows[0].role;
    return role === "admin" || role === "trusted";
  }

  /**
   * Clean up expired challenges.
   */
  async cleanupExpired(): Promise<void> {
    await this.db.query(
      `UPDATE content_verification SET status = 'expired' 
       WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP`,
    );
  }
}
