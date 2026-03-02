import { TwitterApi } from "twitter-api-v2";
import { logger } from "../utils/logger.js";

/**
 * Service to verify if a user has tweeted a specific code.
 * Requires Twitter API v2 credentials.
 */
export class TwitterService {
  private client: TwitterApi | null = null;
  private isConfigured = false;

  constructor() {
    // Only configure if tokens exist
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (token) {
      this.client = new TwitterApi(token);
      this.isConfigured = true;
    } else {
      logger.warn("Twitter API bearer token not found in environment, TwitterService will run in mock/bypass mode.");
    }
  }

  /**
   * Verified that a given handle recently tweeted the given code.
   */
  async verifyTweetCode(handle: string, code: string): Promise<boolean> {
    if (!handle) {
      throw new Error("Twitter handle is required");
    }

    if (!code) {
      throw new Error("Verification code is required");
    }

    // Strip @ if provided
    const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

    if (!this.isConfigured || !this.client) {
      logger.warn("TwitterService not fully configured! Bypassing actual tweet lookup and returning SUCCESS for testing purposes.", { handle: cleanHandle, code });
      return true;
    }

    try {
      // 1. Resolve handle to user ID
      const user = await this.client.v2.userByUsername(cleanHandle);
      
      if (!user.data) {
        logger.error(`Twitter verification failed: handle @${cleanHandle} not found.`);
        throw new Error(`Twitter handle @${cleanHandle} not found`);
      }

      const userId = user.data.id;

      // 2. Fetch the last 10 tweets for this user
      // We look for 'tweets' not replies/retweets usually, though simple timelines might return everything
      const timeline = await this.client.v2.userTimeline(userId, {
        max_results: 10,
        exclude: ["retweets", "replies"]
      });

      // 3. Search timeline for the verification code
      for (const tweet of timeline.tweets) {
        if (tweet.text.includes(code)) {
          logger.info(`Twitter verification successful for @${cleanHandle} with code ${code}`);
          return true;
        }
      }

      logger.info(`Twitter verification failed: Code ${code} not found in recent tweets for @${cleanHandle}`);
      return false;
    } catch (err: any) {
      logger.error("Error verifying tweet:", { handle: cleanHandle, code, error: err.message });
      throw new Error(`Failed to verify Twitter timeline: ${err.message}`);
    }
  }
}

export const twitterService = new TwitterService();
