/**
 * Jam Configuration for Frontend
 *
 * Provides configuration for connecting to self-hosted Jam services.
 */

export interface JamClientConfig {
  pantryUrl: string;
  stunUrl: string;
  turnUrl: string;
  turnCredentials?: {
    username: string;
    credential: string;
  };
  sfuEnabled: boolean;
  development: boolean;
}

/**
 * Get Jam configuration from environment
 */
export function getJamClientConfig(): JamClientConfig {
  return {
    pantryUrl:
      import.meta.env.VITE_PANTRY_URL || "http://localhost:3003/_/pantry",
    stunUrl: import.meta.env.VITE_STUN_URL || "stun:localhost:3478",
    turnUrl: import.meta.env.VITE_TURN_URL || "turn:localhost:3478",
    sfuEnabled: true,
    development: import.meta.env.DEV,
  };
}

/**
 * Create jam-core configuration
 */
export function createJamCoreConfig(config?: Partial<JamClientConfig>): any {
  const envConfig = getJamClientConfig();
  const finalConfig = { ...envConfig, ...config };

  return {
    jamConfig: {
      urls: {
        pantry: finalConfig.pantryUrl,
        stun: finalConfig.stunUrl,
        turn: finalConfig.turnUrl,
        turnCredentials: finalConfig.turnCredentials,
      },
      sfu: finalConfig.sfuEnabled,
      development: finalConfig.development,
    },
  };
}

/**
 * Fetch TURN credentials from backend
 */
export async function fetchTurnCredentials(
  apiBaseUrl: string = import.meta.env.VITE_API_URL ||
    "http://localhost:4000/api/v1",
): Promise<{ username: string; credential: string }> {
  const response = await fetch(`${apiBaseUrl}/jam/turn-credentials`);

  if (!response.ok) {
    throw new Error("Failed to fetch TURN credentials");
  }

  return response.json();
}

/**
 * Get ICE servers configuration
 */
export async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const credentials = await fetchTurnCredentials();
    const config = getJamClientConfig();

    return [
      {
        urls: config.stunUrl,
      },
      {
        urls: [config.turnUrl, `${config.turnUrl}?transport=tcp`],
        username: credentials.username,
        credential: credentials.credential,
      },
    ];
  } catch {
    // Fallback to STUN only
    const config = getJamClientConfig();
    return [
      {
        urls: config.stunUrl,
      },
    ];
  }
}
