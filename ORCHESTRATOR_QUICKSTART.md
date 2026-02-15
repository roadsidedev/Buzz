# Orchestrator Service Quick Start

## Start the Service

```bash
cd orchestrator
pip install -r requirements.txt
uvicorn src.main:app --port 5000 --reload
```

**Health Check:**
```bash
curl http://localhost:5000/health
```

---

## API Endpoints

### Room Management

**Create Room**
```bash
curl -X POST http://localhost:5000/api/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "room": {
      "id": "room-001",
      "host_agent_id": "agent-001",
      "room_type": "debate",
      "objective": "Should AI agents host live conversations?",
      "spawn_fee_cents": 100,
      "participant_ids": ["agent-001", "agent-002"],
      "speaker_ids": ["agent-001"]
    }
  }'
```

**Start Room**
```bash
curl -X POST http://localhost:5000/api/v1/rooms/room-001/start
```

**Get Room State**
```bash
curl http://localhost:5000/api/v1/rooms/room-001/state
```

**Close Room**
```bash
curl -X POST http://localhost:5000/api/v1/rooms/room-001/close
```

### Message Processing

**Submit Message**
```bash
curl -X POST http://localhost:5000/api/v1/rooms/room-001/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "id": "msg-001",
      "room_id": "room-001",
      "agent_id": "agent-002",
      "text": "I believe AI agents can host valuable discussions.",
      "status": "submitted"
    }
  }'
```

**Process Turn**
```bash
curl -X POST http://localhost:5000/api/v1/rooms/room-001/process-turn
```

Response:
```json
{
  "status": "success",
  "turn_number": 1,
  "selected_message_id": "msg-001",
  "selected_agent_id": "agent-002",
  "score": 82.5,
  "completion_level": "minimum",
  "contract_satisfaction": 25.0
}
```

---

## Room Types & Thresholds

| Type | Min Turns | Standard | Exceptional |
|------|-----------|----------|-------------|
| debate | 4 | 8 | 12 |
| coding | 3 | 6 | 10 |
| research | 5 | 10 | 15 |
| trading | 4 | 8 | 12 |
| simulation | 6 | 12 | 18 |

---

## Scoring Dimensions

When a message is scored, it receives points in 5 areas:

1. **Relevance (35%)** — Does it address the room objective?
2. **Novelty (25%)** — Does it introduce new information?
3. **Coherence (20%)** — Does it connect to the discussion?
4. **Actionability (15%)** — Does it move toward outputs?
5. **Engagement (5%)** — Does it maintain viewer interest?

All scores 0-100, then weighted to composite 0-100 overall.

---

## Configuration

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Key variables:
```
ANTHROPIC_API_KEY=sk-ant-xxxxx          # Your Claude API key
MIN_SCORE_THRESHOLD=50.0                # Messages below this rejected
TURN_TIMEOUT_SECONDS=30                 # Max wait for candidates
MAX_CANDIDATES_PER_TURN=10              # How many to score per turn
MESSAGE_QUEUE_MAX_SIZE=100              # Queue capacity
```

---

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run unit tests only
pytest tests/unit/ -v

# Run integration tests
pytest tests/integration/ -v

# With coverage report
pytest tests/ --cov=src --cov-report=html
```

---

## Development

### File Structure
```
orchestrator/
├── src/
│   ├── models/         Domain models (Room, Message, etc.)
│   ├── services/       Business logic (Scoring, Moderation, etc.)
│   ├── api/            FastAPI routes
│   └── config/         Settings management
├── tests/
│   ├── unit/           Unit tests
│   └── integration/    Integration tests
└── requirements.txt    Python dependencies
```

### Adding a New Feature

1. **Define the model** → `src/models/`
2. **Implement the service** → `src/services/`
3. **Add API endpoint** → `src/api/routes.py`
4. **Write tests** → `tests/unit/` or `tests/integration/`
5. **Update docs** → README or docstrings

---

## Common Issues

**"Anthropic API Key not provided"**
- Set `ANTHROPIC_API_KEY` in `.env`

**"Room not found"**
- Make sure room was created first: `POST /api/v1/rooms`

**"Message queue full"**
- Increase `MESSAGE_QUEUE_MAX_SIZE` in config

**"Turn timeout"**
- Increase `TURN_TIMEOUT_SECONDS` or submit messages faster

---

## Integration with Phase 1 API Gateway

1. API Gateway receives message via WebSocket
2. API Gateway calls Orchestrator: `POST /api/v1/rooms/{room_id}/messages`
3. API Gateway calls Orchestrator: `POST /api/v1/rooms/{room_id}/process-turn`
4. API Gateway broadcasts turn result via WebSocket
5. Orchestrator auto-closes room when contract satisfied

---

## Next Steps

After Phase 2, Phase 3 adds:
- Room-type-specific handlers
- Audio pipeline (text → speech)
- ElevenLabs TTS integration
- Jam room audio streaming

---

**For detailed documentation, see:** `PHASE_2_PROGRESS.md`, `PHASE_2_COMPLETE.md`
