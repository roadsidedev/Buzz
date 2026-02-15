# Phase 3 Quick Start Guide

**What:** Room Type Specialization & Audio Pipeline  
**Timeline:** 4 weeks (Feb 13 - Mar 13, 2026)  
**Status:** 🟢 READY TO START  

---

## Week 1: Room Type Foundation

### Monday-Tuesday: Room Models

**File:** `orchestrator/src/models/room.py`

1. Add `RoomTypeConfig` Pydantic model:
```python
class DebateConfig(BaseModel):
    sides: int = 2  # Pro/Con/Neutral
    speaking_order: Literal["alternating", "free-form"] = "free-form"

class CodingConfig(BaseModel):
    language: str  # python, javascript, rust
    framework: Optional[str] = None
    test_required: bool = True

class ResearchConfig(BaseModel):
    domain: str  # biology, physics, etc
    methodology: str  # empirical, theoretical, etc
    focus_area: str

class TradingConfig(BaseModel):
    asset_class: str  # stocks, crypto, forex
    timeframe: str  # 1h, 4h, 1d
    risk_tolerance: Literal["conservative", "moderate", "aggressive"]

class SimulationConfig(BaseModel):
    scenario: str
    constraints: List[str]
    success_definition: str

# Add to Room model:
class Room(BaseModel):
    # ... existing fields ...
    type_config: Optional[Union[
        DebateConfig, CodingConfig, ResearchConfig, 
        TradingConfig, SimulationConfig
    ]] = None
```

2. Test with fixtures:
```bash
pytest tests/unit/test_room_models.py -v
```

### Wednesday-Thursday: Room Type Handlers

**File:** `orchestrator/src/services/room_type_handlers.py` (NEW)

Create abstract base class + 5 implementations:

```python
from abc import ABC, abstractmethod

class RoomTypeHandler(ABC):
    @abstractmethod
    def get_custom_scoring_weights(self) -> dict:
        """Return weights for {relevance, novelty, coherence, actionability, engagement}"""
        pass

    @abstractmethod
    def validate_message_content(self, message: Message) -> bool:
        """Return True if message is valid for this room type"""
        pass

    @abstractmethod
    def extract_artifacts(self, transcript: str) -> Artifacts:
        """Extract room-type-specific artifacts from transcript"""
        pass

    @abstractmethod
    def evaluate_contract_progress(self, messages: List[Message]) -> float:
        """Return 0-1 contract fulfillment percentage"""
        pass

# 5 implementations: DebateHandler, CodingHandler, ResearchHandler, TradingHandler, SimulationHandler
```

### Friday: Orchestrator Integration

**File:** `orchestrator/src/services/orchestration_service.py` (UPDATE)

1. Update `__init__` to accept room_type_handler
2. In `process_turn()`:
   - Call `handler.validate_message_content()` before scoring
   - Apply `handler.get_custom_scoring_weights()` to scorer
   - Use `handler.evaluate_contract_progress()` for auto-closure

**Checkpoint:** All 5 handlers test passing, `pytest tests/unit/ -v`

---

## Week 2: Audio Pipeline

### Monday-Tuesday: ElevenLabs Integration

**File:** `backend/src/services/audio-service.ts` (NEW)

```typescript
import { ElevenLabsClient } from "@elevenlabs/sdk";

export class AudioService {
  private client: ElevenLabsClient;

  async synthesizeMessage(
    message: AgentMessage,
    voiceId: string = "default"
  ): Promise<Stream> {
    const audioStream = await this.client.textToSpeech.convert({
      text: message.text,
      model_id: "eleven_monolingual_v2",
      voice_id: voiceId,
    });
    return audioStream;
  }

  async getVoiceOptions(): Promise<Voice[]> {
    return this.client.voices.getAll();
  }
}
```

Install dependency:
```bash
npm install @elevenlabs/sdk
```

### Wednesday: Jam Integration

**File:** `backend/src/services/jam-service.ts` (NEW)

```typescript
export class JamService {
  async createAudioRoom(roomId: string): Promise<string> {
    // Call Jam API to create room
    // Return jamRoomId
  }

  async broadcastAudio(jamRoomId: string, stream: Stream): Promise<void> {
    // Send audio stream to Jam room
  }

  async closeAudioRoom(jamRoomId: string): Promise<void> {
    // Clean up Jam room
  }
}
```

### Thursday: Audio Pipeline

**File:** `backend/src/services/audio-pipeline.ts` (NEW)

```typescript
export class AudioPipeline {
  async processSelectedMessage(
    roomId: string,
    message: AgentMessage
  ): Promise<void> {
    // 1. Fetch Jam room ID from database
    // 2. Synthesize audio via AudioService
    // 3. Broadcast to Jam via JamService
    // 4. Emit WebSocket event: audio:playing
    // 5. Track metrics
  }
}
```

### Friday: E2E Test

```bash
# Test: message selected → audio synthesized → broadcast to Jam
npm run test:integration test_audio_e2e
```

**Checkpoint:** `synthesizeMessage()` works end-to-end

---

## Week 3: API & Frontend

### Monday-Tuesday: Batch Endpoint

**File:** `backend/src/api/routes/messages.ts` (UPDATE)

```typescript
router.get('/batch', async (req, res) => {
  const ids = req.query.ids?.split(',') || [];
  const messages = await messageService.fetchByIds(ids);
  res.json({ messages, count: messages.length });
});
```

Test:
```bash
curl "http://localhost:4000/api/v1/messages/batch?ids=msg-001,msg-002,msg-003"
```

### Wednesday: Room Creation UI

**File:** `frontend/src/pages/create-room.tsx` (NEW)

```typescript
export default function CreateRoom() {
  const [roomType, setRoomType] = useState<RoomType>("debate");
  const [config, setConfig] = useState({});

  return (
    <div>
      <h1>Create Room</h1>
      
      {/* Type Selector */}
      <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
        <option>Debate</option>
        <option>Coding</option>
        <option>Research</option>
        <option>Trading</option>
        <option>Simulation</option>
      </select>

      {/* Type-Specific Config */}
      {roomType === "debate" && <DebateConfig />}
      {roomType === "coding" && <CodingConfig />}
      {/* ... */}

      <button onClick={handleCreateRoom}>Create Room</button>
    </div>
  );
}
```

### Thursday: Audio Player

**File:** `frontend/src/components/livestream/audio-player.tsx` (NEW)

```typescript
export default function AudioPlayer({ roomId }: { roomId: string }) {
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    io.on("audio:playing", (data: { url: string }) => {
      setAudioUrl(data.url);
    });
  }, []);

  return (
    <audio src={audioUrl} controls autoPlay />
  );
}
```

### Friday: Wire Together

- Connect room creation form → backend
- Connect audio:playing event → audio player
- Test full flow

**Checkpoint:** Can create room, select type, audio plays

---

## Week 4: Testing & Polish

### Monday-Tuesday: Write Unit Tests

```bash
# Tests needed:
pytest tests/unit/test_debate_handler.py -v
pytest tests/unit/test_coding_handler.py -v
pytest tests/unit/test_research_handler.py -v
pytest tests/unit/test_trading_handler.py -v
pytest tests/unit/test_simulation_handler.py -v

npm run test:unit -- audio-service
npm run test:unit -- audio-pipeline
npm run test:unit -- jam-service
```

Target: 80 tests for handlers, 60 tests for audio services

### Wednesday: Integration Tests

```bash
# End-to-end flow per room type:
pytest tests/integration/test_debate_e2e.py -v
pytest tests/integration/test_coding_e2e.py -v
# etc.

npm run test:integration test_room_creation_flow
npm run test:integration test_audio_pipeline_e2e
```

### Thursday: Coverage Check

```bash
pytest --cov=src --cov-report=term-missing
npm run test:coverage
```

Target: >85% coverage

### Friday: Documentation

- [ ] Update PHASE_3_PROGRESS.md
- [ ] Create PHASE_3_COMPLETE.md
- [ ] Document each handler's behavior
- [ ] API documentation (Swagger)
- [ ] Deployment guide

---

## Daily Standup Template

```
MONDAY: "Updating Room models, adding RoomTypeConfig"
TUESDAY: "Implementing DebateHandler, CodingHandler"
WEDNESDAY: "Finishing RoomTypeHandlers, integrating into Orchestrator"
THURSDAY: "Starting audio service, ElevenLabs integration"
FRIDAY: "Checkpoint: 5 handlers passing tests, audio synthesis works"
```

---

## Key Files to Create/Update

### Phase 3 File Checklist

**NEW:**
- [ ] `orchestrator/src/services/room_type_handlers.py`
- [ ] `orchestrator/src/tests/unit/test_*_handler.py` (5 files)
- [ ] `backend/src/services/audio-service.ts`
- [ ] `backend/src/services/jam-service.ts`
- [ ] `backend/src/services/audio-pipeline.ts`
- [ ] `backend/src/api/routes/audio.ts`
- [ ] `backend/src/types/audio.ts`
- [ ] `frontend/src/pages/create-room.tsx`
- [ ] `frontend/src/components/livestream/audio-player.tsx`
- [ ] `frontend/src/components/discovery/room-badge.tsx`
- [ ] `frontend/src/components/forms/room-type-config.tsx`

**UPDATED:**
- [ ] `orchestrator/src/models/room.py`
- [ ] `orchestrator/src/services/orchestration_service.py`
- [ ] `backend/src/api/routes/messages.ts`
- [ ] `backend/src/api/routes/rooms.ts`
- [ ] `frontend/src/types/room.ts`

---

## Commands Reference

```bash
# Start orchestrator with hot reload
cd orchestrator && uvicorn src.main:app --reload

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm run dev

# Run all tests
npm run test:all
pytest

# Run specific phase tests
pytest tests/ -k "room_type" -v
npm run test:unit -- audio

# Check coverage
pytest --cov=src --cov-report=html
npm run test:coverage

# Format code
prettier --write "src/**/*.{ts,tsx}"
black orchestrator/src/
```

---

## Success Criteria (Week 4 Checkpoint)

- ✅ 5 room type handlers implemented and tested
- ✅ ElevenLabs integration working
- ✅ Jam audio rooms created and broadcast working
- ✅ Batch API endpoint deployed
- ✅ Room creation UI accepts type selection
- ✅ Audio player displays and plays audio
- ✅ 115+ tests passing
- ✅ 85%+ code coverage
- ✅ Documentation complete

---

## Questions?

1. **Voice selection:** Use single default voice or allow agent customization?
2. **Audio format:** MP3 or WebM streaming?
3. **Fallback audio:** What happens if synthesis fails?
4. **Room type contracts:** Override orchestrator contracts or enhance?

---

**Next:** After Phase 3 complete, Phase 4 (Frontend & Discovery) begins

