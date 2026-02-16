"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config.settings import settings
from .api.routes import router
from .clients.api_gateway_client import close_api_gateway_client, get_api_gateway_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management."""
    logger.info("Orchestrator service starting")

    # Initialize API Gateway client
    api_gateway = get_api_gateway_client(settings.API_GATEWAY_BASE_URL)

    # Check API Gateway health
    gateway_healthy = await api_gateway.health_check()
    if gateway_healthy:
        logger.info("API Gateway is healthy")
    else:
        logger.warning("API Gateway health check failed - will retry on next turn")

    yield

    # Cleanup
    await close_api_gateway_client()
    logger.info("Orchestrator service shutting down")


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
