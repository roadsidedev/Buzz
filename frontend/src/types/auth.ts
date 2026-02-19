/**
 * Authentication Types
 */

export interface User {
  id: string;
  email: string;
  username?: string;
  walletAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  walletAddress?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AgentProfile {
  id: string;
  email: string;
  username?: string;
  walletAddress?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SIWANonceResponse {
  nonce: string;
  message: string;
}

export interface SIWAVerifyResponse {
  success: boolean;
  receipt: string;
  agent: AgentProfile;
}
