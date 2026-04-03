/**
 * WebRTC Audio Bridge Service
 *
 * Streams TTS-generated audio to Jam rooms via the SFU (Mediasoup).
 * Used by the frontend to inject AI agent audio into the room so all
 * listeners (WebRTC peers) can hear it.
 */

import { Device } from "mediasoup-client";

export interface WebRTCAudioBridgeConfig {
  /** SFU HTTP API URL (e.g. http://localhost:30002) */
  sfuUrl: string;
  /** Room ID */
  roomId: string;
  /** Agent/peer ID for the producer */
  agentId: string;
}

export class WebRTCAudioBridge {
  private device: Device | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producer: any = null;
  private consumers: Map<string, any> = new Map();
  private config: WebRTCAudioBridgeConfig;
  private isConnected: boolean = false;
  private isConnecting: boolean = false;

  constructor(config: WebRTCAudioBridgeConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.isConnecting) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!this.isConnecting) { clearInterval(check); resolve(); }
        }, 100);
      });
      if (this.isConnected) return;
    }

    this.isConnecting = true;

    try {
      this.device = new Device();
      const routerRtpCapabilities = await this.fetchRouterCapabilities();
      await this.device.load({ routerRtpCapabilities });
      this.sendTransport = await this.createSendTransport();
      this.recvTransport = await this.createRecvTransport();
      this.isConnected = true;
      console.log("[AudioBridge] Connected to SFU", { roomId: this.config.roomId });
    } catch (error) {
      console.error("[AudioBridge] Failed to connect:", error);
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private async fetchRouterCapabilities(): Promise<any> {
    const response = await fetch(
      `${this.config.sfuUrl}/rooms/${this.config.roomId}/router-rtp-capabilities`,
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch router capabilities: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data.rtpCapabilities;
  }

  private async createSendTransport(): Promise<any> {
    if (!this.device) throw new Error("Device not loaded");

    const response = await fetch(
      `${this.config.sfuUrl}/rooms/${this.config.roomId}/create-transport`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producing: true,
          consuming: false,
          rtpCapabilities: this.device.rtpCapabilities,
          peerId: this.config.agentId,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create send transport: ${response.status} ${text}`);
    }

    const { transportOptions } = await response.json();
    const transport = this.device.createSendTransport(transportOptions);

    transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await fetch(`${this.config.sfuUrl}/transports/${transport.id}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dtlsParameters }),
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    transport.on("produce", async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const response = await fetch(
          `${this.config.sfuUrl}/transports/${transport.id}/produce`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, rtpParameters, appData }),
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Produce failed: ${response.status} ${text}`);
        }
        const { id } = await response.json();
        callback({ id });
      } catch (error) {
        errback(error as Error);
      }
    });

    return transport;
  }

  private async createRecvTransport(): Promise<any> {
    if (!this.device) throw new Error("Device not loaded");

    const response = await fetch(
      `${this.config.sfuUrl}/rooms/${this.config.roomId}/create-transport`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producing: false,
          consuming: true,
          rtpCapabilities: this.device.rtpCapabilities,
          peerId: this.config.agentId,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create recv transport: ${response.status} ${text}`);
    }

    const { transportOptions } = await response.json();
    const transport = this.device.createRecvTransport(transportOptions);

    transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await fetch(`${this.config.sfuUrl}/transports/${transport.id}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dtlsParameters }),
        });
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    return transport;
  }

  async streamAudio(audioBuffer: ArrayBuffer, messageId: string): Promise<void> {
    if (!this.isConnected || !this.sendTransport) {
      throw new Error("Not connected to SFU");
    }

    if (this.producer) {
      try { this.producer.close(); } catch { /* ignore */ }
      this.producer = null;
    }

    const audioContext = new AudioContext({ sampleRate: 48000 });

    try {
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
      const destination = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(destination);
      source.connect(audioContext.destination);

      const track = destination.stream.getAudioTracks()[0];
      track.enabled = true;

      this.producer = await this.sendTransport.produce({
        track,
        codecOptions: { opusStereo: 1, opusDtx: 1 },
        appData: { messageId },
      });

      console.log("[AudioBridge] Producing audio", { producerId: this.producer.id, messageId });

      source.start();

      return new Promise((resolve) => {
        source.onended = () => {
          this.stopStreaming();
          audioContext.close().catch(() => {});
          resolve();
        };
      });
    } catch (error) {
      audioContext.close().catch(() => {});
      console.error("[AudioBridge] Failed to stream audio:", error);
      throw error;
    }
  }

  stopStreaming(): void {
    if (this.producer) {
      try { this.producer.close(); } catch { /* ignore */ }
      this.producer = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopStreaming();
    for (const consumer of this.consumers.values()) {
      try { consumer.close(); } catch { /* ignore */ }
    }
    this.consumers.clear();
    if (this.sendTransport) {
      try { this.sendTransport.close(); } catch { /* ignore */ }
      this.sendTransport = null;
    }
    if (this.recvTransport) {
      try { this.recvTransport.close(); } catch { /* ignore */ }
      this.recvTransport = null;
    }
    this.device = null;
    this.isConnected = false;
    console.log("[AudioBridge] Disconnected from SFU");
  }

  isReady(): boolean {
    return this.isConnected && this.sendTransport !== null;
  }
}

export function createWebRTCAudioBridge(config: WebRTCAudioBridgeConfig): WebRTCAudioBridge {
  return new WebRTCAudioBridge(config);
}
