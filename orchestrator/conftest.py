"""
Pytest Configuration and Fixtures

Provides shared fixtures for orchestrator tests
"""

import pytest
import asyncio
import os
from unittest.mock import MagicMock, AsyncMock
from typing import Generator

# Load test environment
os.environ["ENVIRONMENT"] = "test"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"  # Use test Redis DB


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db():
    """Mock database connection"""
    return MagicMock()


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    client = AsyncMock()
    client.ping = AsyncMock(return_value=True)
    client.get = AsyncMock(return_value=None)
    client.set = AsyncMock()
    client.delete = AsyncMock()
    return client


@pytest.fixture
def mock_api_gateway():
    """Mock API Gateway client"""
    client = AsyncMock()
    client.get_messages_batch = AsyncMock(return_value=[])
    client.update_message_status = AsyncMock()
    return client


@pytest.fixture
def mock_scoring_engine():
    """Mock scoring engine"""
    engine = AsyncMock()
    engine.score_message = AsyncMock(return_value=85.0)
    return engine


@pytest.fixture
def mock_moderation_agent():
    """Mock moderation agent"""
    agent = AsyncMock()
    agent.update_scoring_for_violations = AsyncMock(return_value=None)
    return agent


@pytest.fixture
def mock_turn_manager():
    """Mock turn manager"""
    manager = AsyncMock()
    manager.select_next_speaker = AsyncMock(
        return_value=MagicMock(
            selected_agent_id="agent-123",
            selected_message_id="msg-456",
            score=85.0,
            turn_number=1,
            timestamp=MagicMock(isoformat=lambda: "2026-02-16T00:00:00Z"),
        )
    )
    return manager


@pytest.fixture
def mock_contract_validator():
    """Mock contract validator"""
    validator = AsyncMock()
    validator.evaluate_completion = AsyncMock(return_value=(None, 0.5, []))
    validator.should_close_room = AsyncMock(return_value=False)
    validator.generate_artifacts = AsyncMock(return_value={})
    return validator
