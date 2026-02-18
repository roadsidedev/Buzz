"""FastAPI application entry point."""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config.settings import settings
from .api.routes import router, get_orchestration_service
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
    required_vars = {
        "ANTHROPIC_API_KEY": "Claude API key for message scoring",
        "REDIS_URL": "Redis connection for room state",
    }
    
    missing = []
    for var, description in required_vars.items():
        value = getattr(settings, var, None)
        if not value:
            missing.append(f"  • {var}: {description}")
    
    if missing:
        logger.error("Missing required environment variables:")
        for msg in missing:
            logger.error(msg)
        raise RuntimeError(
            f"Missing {len(missing)} required environment variables. "
            "Check logs for details."
        )
    
    logger.info("Environment validation passed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Orchestrator service starting")
    
    # 1. VALIDATE ENVIRONMENT
    try:
        validate_environment()
    except RuntimeError as e:
        logger.error(f"Environment validation failed: {e}")
        sys.exit(1)

    # 2. INITIALIZE ORCHESTRATION SERVICE
    logger.info("Initializing orchestration service...")
    try:
        orchestration_service = get_orchestration_service()
        await orchestration_service.initialize()
        logger.info("Orchestration service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize orchestration service: {e}")
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "orchestrator.src.main:app",
        host=settings.FASTAPI_HOST,
        port=settings.FASTAPI_PORT,
        reload=settings.DEBUG,
    )
