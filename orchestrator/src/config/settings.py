"""Configuration management for Orchestrator Service."""

import os
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    """Application settings from environment variables."""

    # Server
    SERVICE_NAME: str = "ClawZz Orchestrator"
    SERVICE_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = "development"
    DEBUG: bool = False

    # FastAPI - Use Railway's PORT if available
    FASTAPI_HOST: str = "0.0.0.0"
    FASTAPI_PORT: int = int(os.getenv("PORT", "5000"))
    CORS_ORIGINS: list[str] = ["http://localhost:4000", "http://localhost:3000"]

    # PostgreSQL
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/clawzz"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 3600

    # LLM Provider configuration (provider-agnostic)
    # Supported providers: "anthropic", "openai", "nvidia", "kimi", "gemini", "openrouter", "none"
    LLM_PROVIDER: str = "anthropic"
    LLM_API_KEY: str = ""
    # Optional: explicit API URL for providers that expose HTTP endpoints
    LLM_API_URL: str = ""
    
    # Model configurations (defaults per provider)
    # Anthropic models
    SCORING_MODEL: str = "claude-3-5-sonnet-20241022"
    MODERATION_MODEL: str = "claude-3-5-haiku-20241022"
    
    # NVIDIA NIM models (alternatives - set LLM_PROVIDER=nvidia)
    # SCORING_MODEL: str = "meta/llama-3.3-70b-instruct"
    # SCORING_MODEL: str = "qwen/qwen-3.5-397b"
    # SCORING_MODEL: str = "deepseek-ai/deepseek-r1"
    
    # Kimi models (set LLM_PROVIDER=kimi)
    # SCORING_MODEL: str = "moonshotai/kimi-k2-5"

    # Phase 1 API Gateway Integration
    API_GATEWAY_BASE_URL: str = "http://localhost:4000"
    API_GATEWAY_TIMEOUT: int = 10

    # Orchestration Parameters
    MAX_CANDIDATES_PER_TURN: int = 10
    MIN_SCORE_THRESHOLD: float = 50.0
    TURN_TIMEOUT_SECONDS: int = 30
    MESSAGE_QUEUE_MAX_SIZE: int = 100

    # Scoring Weights (must sum to 100)
    SCORING_WEIGHT_RELEVANCE: float = 0.35
    SCORING_WEIGHT_NOVELTY: float = 0.25
    SCORING_WEIGHT_COHERENCE: float = 0.20
    SCORING_WEIGHT_ACTIONABILITY: float = 0.15
    SCORING_WEIGHT_ENGAGEMENT: float = 0.05

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True


settings = Settings()
