"""
Beely Orchestrator Service
FastAPI application for intelligent message scoring and turn management
"""

from fastapi import FastAPI
from contextlib import asynccontextmanager
import logging
import sys
import os

# Ensure src is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api.routes import router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lifespan event
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Beely Orchestrator Service starting...")
    yield
    logger.info("🛑 Beely Orchestrator Service shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Beely Orchestrator",
    description="Intelligent conversation orchestration engine",
    version="0.0.1",
    lifespan=lifespan,
)

# Mount the full router (includes /api/v1/podcasts/generate, rooms, health, etc.)
app.include_router(router)

# Root health check
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "beely-orchestrator",
        "version": "0.0.1",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )
