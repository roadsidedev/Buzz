"""FastAPI application entry point."""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config.settings import settings
from .api.routes import router, get_orchestration_service, set_orchestration_service
from .services.llm_provider import get_provider
from .clients.api_gateway_client import close_api_gateway_client, get_api_gateway_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def validate_environment() -> None:
    """
    Validate required environment variables on startup.
    
    Raises:
        RuntimeError: If critical configuration is missing
    """
    # Redis is required for orchestrator state
    missing = []
    if not settings.REDIS_URL:
        missing.append("  • REDIS_URL: Redis connection for room state")

    # LLM provider validation: allow `none` for degraded mode, otherwise require a key
    provider = (settings.LLM_PROVIDER or "").lower()
    if provider and provider != "none":
        if not settings.LLM_API_KEY:
            missing.append(
                "  • LLM_API_KEY: API key for selected LLM provider"
            )

    if missing:
        logger.error("Missing required environment variables:")
        for msg in missing:
            logger.error(msg)
        raise RuntimeError(
            f"Missing {len(missing)} required environment variables. Check logs for details."
        )

    logger.info("Environment validation passed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Orchestrator service starting")
    
    # 1. VALIDATE ENVIRONMENT (now provider-agnostic)
    try:
        # Validate basic environment first - this will log missing configurable
        # values but we allow starting in degraded mode when provider=none.
        validate_environment()
    except RuntimeError as e:
        logger.error(f"Environment validation failed: {e}")
        sys.exit(1)

    # 1b. Initialize LLM provider (if configured)
    try:
        provider = None
        if settings.LLM_PROVIDER and settings.LLM_PROVIDER.lower() != "none":
            provider = get_provider(settings.LLM_PROVIDER, settings.LLM_API_KEY)
            logger.info("LLM provider set: %s", settings.LLM_PROVIDER)
        else:
            logger.info("LLM provider disabled (LLM_PROVIDER=none)")
    except Exception as e:
        logger.error("Failed to initialize LLM provider: %s", e)
        sys.exit(1)

    # 2. INITIALIZE ORCHESTRATION SERVICE
    logger.info("Initializing orchestration service...", {"redis_url": settings.REDIS_URL})
    try:
        # Inject provider into ScoringEngine by creating OrchestrationService
        # and setting it in routes so request handlers pick it up.
        from .services.scoring_engine import ScoringEngine
        from .services.orchestration_service import OrchestrationService

        logger.info("Creating OrchestrationService instance...")
        scoring_engine = ScoringEngine()
        orchestration_service = OrchestrationService()
        
        # If the scoring engine was able to initialize a provider client,
        # attach it to the orchestration service's scoring_engine.
        orchestration_service.scoring_engine = scoring_engine

        # Register singleton for routes BEFORE initialization
        logger.info("Setting orchestration service singleton...")
        set_orchestration_service(orchestration_service)
        
        # Now initialize (connects to Redis)
        logger.info("Calling orchestration_service.initialize()...")
        await orchestration_service.initialize()
        
        # Verify initialization
        if orchestration_service.room_state_manager is None:
            logger.error("Initialization completed but room_state_manager is still None!")
            raise RuntimeError("room_state_manager not initialized")
            
        logger.info("Orchestration service initialized successfully", {
            "room_state_manager_ready": True
        })
    except Exception as e:
        import traceback
        logger.error(f"Failed to initialize orchestration service: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)

    # 3. INITIALIZE API GATEWAY CLIENT
    logger.info("Initializing API Gateway client...")
    try:
        api_gateway = get_api_gateway_client(settings.API_GATEWAY_BASE_URL)
        gateway_healthy = await api_gateway.health_check()
        if gateway_healthy:
            logger.info("API Gateway is healthy")
        else:
            logger.warning("API Gateway health check failed - will retry on next turn")
    except Exception as e:
        logger.error(f"API Gateway initialization warning: {e}")
        # Don't exit - gateway may become available during runtime

    logger.info("Orchestrator service startup complete")
    yield

    # CLEANUP
    logger.info("Orchestrator service shutting down")
    try:
        await close_api_gateway_client()
        logger.info("API Gateway client closed")
    except Exception as e:
        logger.error(f"Error closing API Gateway client: {e}")
    
    logger.info("Orchestrator service shutdown complete")


# Initialize FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.SERVICE_VERSION,
    description="ClawZz Orchestrator: Message scoring and turn management",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint for container orchestration."""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "orchestrator.src.main:app",
        host=settings.FASTAPI_HOST,
        port=settings.FASTAPI_PORT,
        reload=settings.DEBUG,
    )
