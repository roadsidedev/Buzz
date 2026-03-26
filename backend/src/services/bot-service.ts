// @ts-nocheck
import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs";
import { logger } from "../utils/logger.js";
import { ServiceUnavailableError } from "../utils/errors.js";

// Helper to find a local browser executable
function findBrowserExecutable(): string | undefined {
  const paths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

interface BotAudioJob {
  base64Audio: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class BotService {
  private browser: Browser | null = null;
  private pages: Map<string, { page: Page; queue: BotAudioJob[]; playing: boolean }> = new Map();
  private frontendUrl: string;

  constructor() {
    this.frontendUrl = process.env.VITE_URL || process.env.FRONTEND_URL || "http://localhost:3000";
  }

  /**
   * Initialize a bot participant in a room by navigating a headless
   * browser to the livestream page and intercepting the microphone API.
   */
  async joinRoom(roomId: string, botName: string = "RadioBot"): Promise<void> {
    if (this.pages.has(roomId)) {
      return; // Already joined
    }

    try {
      if (!this.browser) {
        const executablePath = findBrowserExecutable();
        this.browser = await puppeteer.launch({
          headless: true,
          executablePath,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--autoplay-policy=no-user-gesture-required",
            "--use-fake-ui-for-media-stream",
            "--disable-web-security" // Avoid CORS if needed
          ],
        });
      }

      const page = await this.browser.newPage();
      
      // Inject synthetic microphone
      await page.evaluateOnNewDocument(() => {
        // @ts-ignore
        window.__audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // @ts-ignore
        window.__dest = window.__audioCtx.createMediaStreamDestination();
        
        // Hook WebRTC API to create a fake microphone stream
        // Mock media devices for Jam SDK
        if (!(window as any).navigator) (window as any).navigator = {} as any;
        if (!(window as any).navigator.mediaDevices) (window as any).navigator.mediaDevices = {} as any;
        (window as any).navigator.mediaDevices.getUserMedia = async (constraints: any) => {
          // Instead of actual mic, this will use the media we pipe into chromium
          // Or we can construct a fake stream if we need it
          console.log("[Bot] Intercepted getUserMedia", constraints);
          // Return an empty audio stream for now just to satisfy the API
          // Actually, since we're injecting via page.addScriptTag later, we don't need a real mock here
          // but we mock it just to prevent errors
          // creating a mock audio track is possible using Web Audio API
          const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          return dest.stream;
        };

        // Inject playback function exposed to Node context
        // @ts-ignore
        window.playBotAudioBase64 = async (base64Str: string): Promise<number> => {
          try {
            const binaryString = atob(base64Str);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            // @ts-ignore
            const audioBuffer = await window.__audioCtx.decodeAudioData(bytes.buffer);
            // @ts-ignore
            const source = window.__audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            // @ts-ignore
            source.connect(window.__dest);
            // @ts-ignore
            source.connect(window.__audioCtx.destination); // (Optional) Also play to fake speakers
            
            source.start(0);
            
            return new Promise((resolve) => {
              source.onended = () => resolve(audioBuffer.duration * 1000);
            });
          } catch (e: any) {
            console.error("Bot audio error", e);
            throw e;
          }
        };
      });

      // Pass flag bypass=true or bot=true to ensure the UI logs in or connects as a generic agent
      // Note: In real production, we'd inject localStorage with a proper JWT JWT token before navigating.
      await page.goto(`${this.frontendUrl}/room/${roomId}/live?bot=true`);

      // Automate any 'join' or 'unmute' clicks if necessary.
      // The injected getUserMedia will auto-grant.
      // E.g., if there's an unmute button to click:
      // await page.waitForSelector('button[aria-label="Unmute"]', { timeout: 10000 });
      // await page.click('button[aria-label="Unmute"]');
      
      this.pages.set(roomId, { page, queue: [], playing: false });
      logger.info("Bot successfully joined room", { roomId, botName });

    } catch (err) {
      logger.error("Failed to join bot to room", { roomId, error: err instanceof Error ? err.message : String(err) });
      throw new ServiceUnavailableError("BotService", { err });
    }
  }

  /**
   * Leave the room and clean up the page resources.
   */
  async leaveRoom(roomId: string): Promise<void> {
    const session = this.pages.get(roomId);
    if (session) {
      await session.page.close().catch(() => {});
      this.pages.delete(roomId);
      logger.info("Bot left room", { roomId });
    }
    
    if (this.pages.size === 0 && this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  /**
   * Stream a PCM or MP3 buffer into the room's WebRTC audio track.
   * Resolves when the audio finishes playing.
   */
  async streamAudioBuffer(roomId: string, buffer: Buffer): Promise<void> {
    const session = this.pages.get(roomId);
    if (!session) {
      // Auto-join if not already there
      await this.joinRoom(roomId);
    }
    const currentSession = this.pages.get(roomId)!;

    return new Promise((resolve, reject) => {
      currentSession.queue.push({
        base64Audio: buffer.toString('base64'),
        resolve,
        reject
      });
      this.processQueue(roomId);
    });
  }

  private async processQueue(roomId: string) {
    const session = this.pages.get(roomId);
    if (!session || session.playing || session.queue.length === 0) {
      return;
    }

    session.playing = true;
    const job = session.queue.shift()!;

    try {
      const durationMs = await session.page.evaluate((b64) => {
        // @ts-ignore
        return window.playBotAudioBase64(b64);
      }, job.base64Audio) as number;
      
      logger.info(`Played audio chunk in bot`, { roomId, durationMs });
      job.resolve();
    } catch (err) {
      logger.error(`Failed to play audio in bot`, { roomId, error: err instanceof Error ? err.message : String(err) });
      job.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      session.playing = false;
      // Yield to event loop, then process next in queue
      setTimeout(() => this.processQueue(roomId), 10);
    }
  }
}

// Singleton instance
let botServiceInstance: BotService | null = null;

export function getBotService(): BotService {
  if (!botServiceInstance) {
    botServiceInstance = new BotService();
  }
  return botServiceInstance;
}
