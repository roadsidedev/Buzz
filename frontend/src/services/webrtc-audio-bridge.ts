/**
 * WebRTC Audio Bridge Service
 *
 * Handles streaming TTS-generated audio to Jam rooms via WebRTC.
 * Used for AI agents that need to stream pre-generated audio.
 */

import { Device } from "mediasoup-client";

export interface WebRTCAudioBridgeConfig {
  pantrySfuUrl: string;
  roomId: string;
  agentId: string;
}

export interface AudioTrack {
  id: string;
  audioBuffer: ArrayBuffer;
  messageId: string;
}

export class WebRTCAudioBridge {
  private device: Device | null = null;
  private sendTransport: any = null;
  private recvTransport: any = null;
  private producer: any = null;
  private consumers: Map<string, any> = new Map();
  private config: WebRTCAudioBridgeConfig;
  private isConnected: boolean = false;

  constructor(config: WebRTCAudioBridgeConfig) {
    this.config = config;
  }

  /**
   * Connect to the SFU
   */
  async connect(): Promise<void> {
    try {
      this.device = new Device();

      // Fetch router RTP capabilities from SFU
      const routerRtpCapabilities = await this.fetchRouterCapabilities();

      await this.device.load({ routerRtpCapabilities });

      // Create send transport
      this.sendTransport = await this.createSendTransport();

      // Create receive transport
      this.recvTransport = await this.createRecvTransport();

      this.isConnected = true;

      console.log("WebRTC Audio Bridge connected", {
        roomId: this.config.roomId,
      });
    } catch (error) {
      console.error("Failed to connect WebRTC Audio Bridge", error);
      throw error;
    }
  }

  /**
   * Fetch router RTP capabilities from SFU
   */
  private async fetchRouterCapabilities(): Promise<any> {
    const response = await fetch(
      `${this.config.pantrySfuUrl}/rooms/${this.config.roomId}/router-rtp-capabilities`,
    );

    if (!response.ok) {
      throw new Error("Failed to fetch router capabilities");
    }

    return response.json();
  }

  /**
   * Create send transport for producing audio
   */
  private async createSendTransport(): Promise<any> {
    if (!this.device) {
      throw new Error("Device not loaded");
    }

    const response = await fetch(
      `${this.config.pantrySfuUrl}/rooms/${this.config.roomId}/create-transport`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "send" }),
      },
    );

    const { transportOptions } = await response.json();

    const transport = this.device.createSendTransport(transportOptions);

    transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await fetch(
          `${this.config.pantrySfuUrl}/transports/${transport.id}/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dtlsParameters }),
          },
        );
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    transport.on(
      "produce",
      async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const response = await fetch(
            `${this.config.pantrySfuUrl}/transports/${transport.id}/produce`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind, rtpParameters }),
            },
          );

          const { id } = await response.json();
          callback({ id });
        } catch (error) {
          errback(error as Error);
        }
      },
    );

    return transport;
  }

  /**
   * Create receive transport for consuming audio
   */
  private async createRecvTransport(): Promise<any> {
    if (!this.device) {
      throw new Error("Device not loaded");
    }

    const response = await fetch(
      `${this.config.pantrySfuUrl}/rooms/${this.config.roomId}/create-transport`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "recv" }),
      },
    );

    const { transportOptions } = await response.json();

    const transport = this.device.createRecvTransport(transportOptions);

    transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
      try {
        await fetch(
          `${this.config.pantrySfuUrl}/transports/${transport.id}/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dtlsParameters }),
          },
        );
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    return transport;
  }

  /**
   * Stream audio to the room
   */
  async streamAudio(
    audioBuffer: ArrayBuffer,
    messageId: string,
  ): Promise<void> {
    if (!this.isConnected || !this.sendTransport) {
      throw new Error("Not connected to SFU");
    }

    try {
      // Convert audio buffer to MediaStreamTrack
      const audioContext = new AudioContext();
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);

      // Create media stream destination
      const destination = audioContext.createMediaStreamDestination();
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(destination);

      // Get audio track
      const track = destination.stream.getAudioTracks()[0];

      // Produce the track
      this.producer = await this.sendTransport.produce({
        track,
        codecOptions: {
          opus: {
            stereo: 0,
            dtx: true,
            fec: true,
          },
        },
        appData: { messageId },
      });

      // Start playback
      source.start();

      return new Promise((resolve) => {
        source.onended = () => {
          this.stopStreaming();
          audioContext.close();
          resolve();
        };
      });
    } catch (error) {
      console.error("Failed to stream audio", error);
      throw error;
    }
  }

  /**
   * Stop streaming audio
   */
  stopStreaming(): void {
    if (this.producer) {
      this.producer.close();
      this.producer = null;
    }
  }

  /**
   * Consume audio from another speaker
   */
  async consumeAudio(producerId: string): Promise<MediaStreamTrack> {
    if (!this.isConnected || !this.recvTransport || !this.device) {
      throw new Error("Not connected to SFU");
    }

    const response = await fetch(
      `${this.config.pantrySfuUrl}/rooms/${this.config.roomId}/consume`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transportId: this.recvTransport.id,
          producerId,
          rtpCapabilities: this.device.rtpCapabilities,
        }),
      },
    );

    const { consumerOptions } = await response.json();

    const consumer = await this.recvTransport.consume(consumerOptions);

    this.consumers.set(consumer.id, consumer);

    // Resume the consumer
    await fetch(`${this.config.pantrySfuUrl}/consumers/${consumer.id}/resume`, {
      method: "POST",
    });

    return consumer.track;
  }

  /**
   * Disconnect from SFU
   */
  async disconnect(): Promise<void> {
    this.stopStreaming();

    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.device = null;
    this.isConnected = false;

    console.log("WebRTC Audio Bridge disconnected");
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

/**
 * Create WebRTC Audio Bridge
 */
export function createWebRTCAudioBridge(
  config: WebRTCAudioBridgeConfig,
): WebRTCAudioBridge {
  return new WebRTCAudioBridge(config);
}
