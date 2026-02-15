# Phase 3 File Manifest

**Generated:** February 13, 2026  
**Phase:** 3 of 10 (MVP)  
**Status:** Ready for implementation  

---

## Documentation Created

### Phase 3 Core Documentation (Created Today)

| File | Lines | Purpose | Start Reading |
|------|-------|---------|---|
| **PHASE_3_README.md** | 550 | Index of all Phase 3 docs | ⭐ Start here |
| **PHASE_3_QUICKSTART.md** | 350 | Week-by-week implementation | Engineers |
| **PHASE_3_LAUNCH.md** | 550 | Full specification & architecture | Architects |
| **PHASE_3_STATUS.md** | 350 | Transition & readiness | Leads |
| **PHASE_3_FILE_MANIFEST.md** | This file | File organization | Project managers |

### Related Documentation (Updated Today)

| File | Change | Status |
|------|--------|--------|
| **PHASE_CHECKLIST.md** | Added Phase 3 section with 25+ tasks | ✅ Updated |
| **AGENTS.md** | No changes needed (already covers standards) | ✅ Reference |
| **ARCHITECTURE_DECISIONS.md** | Link to Phase 3 in roadmap | ⏳ To update Week 4 |

---

## Code Files to Create (Phase 3)

### Total: 24 new files, ~2,000 LOC

---

## Orchestrator (Python) — 7 New Files

### Services (1 file, 300 LOC)

```
orchestrator/src/services/
├── room_type_handlers.py  ← NEW [300 LOC]
│   ├── RoomTypeHandler (abstract base)
│   ├── DebateHandler
│   ├── CodingHandler
│   ├── ResearchHandler
│   ├── TradingHandler
│   └── SimulationHandler
└── (existing files from Phase 2)
```

**RoomTypeHandler interface:**
```python
class RoomTypeHandler(ABC):
    def get_custom_scoring_weights(self) -> dict
    def validate_message_content(self, message: Message) -> bool
    def extract_artifacts(self, transcript: str) -> Artifacts
    def evaluate_contract_progress(self, messages: List[Message]) -> float
```

**Handlers:**
- DebateHandler: novelty +5%, pro/con validation
- CodingHandler: code quality checks
- ResearchHandler: methodology validation
- TradingHandler: risk assessment
- SimulationHandler: outcome evaluation

### Tests (6 files, 450 LOC)

```
orchestrator/tests/unit/
├── test_debate_handler.py     ← NEW [80 LOC, 16 tests]
├── test_coding_handler.py     ← NEW [80 LOC, 16 tests]
├── test_research_handler.py   ← NEW [80 LOC, 16 tests]
├── test_trading_handler.py    ← NEW [80 LOC, 16 tests]
├── test_simulation_handler.py ← NEW [80 LOC, 16 tests]
└── (existing tests from Phase 2)

orchestrator/tests/integration/
└── test_audio_pipeline.py     ← NEW [120 LOC, orchestrator + audio]
```

**Unit test pattern per handler:**
- test_get_custom_scoring_weights()
- test_validate_message_content_valid()
- test_validate_message_content_invalid()
- test_extract_artifacts()
- test_evaluate_contract_progress()
- ... (6-8 more scenarios per type)

### Updated Files (2 files, +150 LOC)

```
orchestrator/src/
├── models/room.py              ← UPDATE [+50 LOC]
│   Add: RoomTypeConfig union, type_config field
│
└── services/orchestration_service.py  ← UPDATE [+100 LOC]
    Add: handler loading, custom weights application
    Update: process_turn() to use handler
```

**room.py changes:**
```python
# Add these classes
class DebateConfig(BaseModel):
    sides: int = 2
    speaking_order: str = "free-form"

class CodingConfig(BaseModel):
    language: str
    framework: Optional[str]
    test_required: bool

# etc. for Research, Trading, Simulation

# Update Room model
class Room(BaseModel):
    # ... existing fields ...
    type_config: Optional[RoomTypeConfig] = None
```

**orchestration_service.py changes:**
```python
# Add to OrchestratorService.__init__
self.handler = self._load_handler(room.type)

# Update process_turn()
# Step 1: Apply handler.validate_message_content()
# Step 2: Apply handler.get_custom_scoring_weights() to scorer
# Step 3: Check handler.evaluate_contract_progress() for closure
```

---

## Backend (Node.js) — 10 New Files, 7 Updated

### Services (3 files, 650 LOC)

```
backend/src/services/
├── audio-service.ts        ← NEW [250 LOC]
│   ├── synthesizeMessage(message): Promise<Stream>
│   ├── getVoiceOptions(): Promise<Voice[]>
│   └── cancelSynthesis(taskId): Promise<void>
│
├── jam-service.ts          ← NEW [200 LOC]
│   ├── createAudioRoom(roomId): Promise<string>
│   ├── broadcastAudio(jamRoomId, stream): Promise<void>
│   ├── getListenerCount(jamRoomId): Promise<number>
│   └── closeAudioRoom(jamRoomId): Promise<void>
│
└── audio-pipeline.ts       ← NEW [200 LOC]
    ├── processSelectedMessage(roomId, message): Promise<void>
    ├── synthesizeAndBroadcast(): async flow
    └── error handling & fallbacks
```

**audio-service.ts:**
```typescript
import { ElevenLabsClient } from "@elevenlabs/sdk";

export class AudioService {
  private client: ElevenLabsClient;
  
  async synthesizeMessage(
    message: AgentMessage,
    voiceId?: string
  ): Promise<Stream> { }
  
  async getVoiceOptions(): Promise<Voice[]> { }
  async cancelSynthesis(taskId: string): Promise<void> { }
}
```

**jam-service.ts:**
```typescript
export class JamService {
  async createAudioRoom(roomId: string): Promise<string> { }
  async broadcastAudio(jamRoomId: string, stream: Stream): Promise<void> { }
  async getListenerCount(jamRoomId: string): Promise<number> { }
  async closeAudioRoom(jamRoomId: string): Promise<void> { }
}
```

**audio-pipeline.ts:**
```typescript
export class AudioPipeline {
  async processSelectedMessage(
    roomId: string,
    message: AgentMessage,
    jamRoomId: string
  ): Promise<void> {
    // Synthesize via AudioService
    // Broadcast via JamService
    // Emit WebSocket event
    // Track metrics
  }
}
```

### API Routes (2 files, 150 LOC)

```
backend/src/api/routes/
├── messages.ts          ← UPDATE [+50 LOC]
│   Add: GET /api/v1/messages/batch?ids=msg-001,msg-002,...
│
├── audio.ts             ← NEW [100 LOC]
│   ├── GET    /api/v1/messages/{id}/audio
│   ├── POST   /api/v1/messages/{id}/audio
│   └── DELETE /api/v1/messages/{id}/audio
│
└── rooms.ts             ← UPDATE [+80 LOC]
    Add: POST /api/v1/rooms/{id}/type-config
    Add: GET  /api/v1/rooms/{id}/type-metadata
```

**messages.ts batch endpoint:**
```typescript
router.get('/batch', async (req, res) => {
  const ids = (req.query.ids as string)?.split(',') || [];
  const messages = await messageService.fetchByIds(ids);
  res.json({ messages, count: messages.length });
});
```

**audio.ts routes:**
```typescript
router.get('/messages/:id/audio', async (req, res) => {
  // Stream previously synthesized audio
});

router.post('/messages/:id/audio', async (req, res) => {
  // Trigger synthesis and broadcast
});

router.delete('/messages/:id/audio', async (req, res) => {
  // Cancel in-progress synthesis
});
```

### Types (1 file, 100 LOC)

```
backend/src/types/
└── audio.ts             ← NEW [100 LOC]
    ├── AudioStream interface
    ├── Voice interface
    ├── VoiceSettings interface
    ├── JamRoom interface
    └── AudioStatus enum
```

**audio.ts:**
```typescript
export interface AudioStream {
  url: string;
  format: "mp3" | "wav" | "webm";
  duration: number;
  voiceId: string;
}

export interface VoiceSettings {
  stability: number;      // 0-1
  similarity_boost: number; // 0-1
}

export interface JamRoom {
  id: string;
  roomId: string;  // ClawHouse room ID
  jamRoomId: string;
  status: "active" | "closed";
  listenerCount: number;
  createdAt: Date;
}

export enum AudioStatus {
  PENDING = "pending",
  SYNTHESIZING = "synthesizing",
  SYNTHESIZED = "synthesized",
  BROADCASTING = "broadcasting",
  FAILED = "failed",
}
```

### Tests (4 files, 350 LOC)

```
backend/tests/unit/
├── test_audio_service.ts      ← NEW [100 LOC]
│   ├── test_synthesizeMessage()
│   ├── test_getVoiceOptions()
│   ├── test_error_handling()
│   └── test_concurrent_synthesis()
│
├── test_jam_service.ts        ← NEW [80 LOC]
│   ├── test_createAudioRoom()
│   ├── test_broadcastAudio()
│   ├── test_getListenerCount()
│   └── test_closeAudioRoom()
│
└── test_audio_pipeline.ts     ← NEW [120 LOC]
    ├── test_processSelectedMessage()
    ├── test_error_recovery()
    └── test_fallback_audio()

backend/tests/integration/
└── test_audio_e2e.ts          ← NEW [150 LOC]
    Complete flow: room:turn-selected → synthesis → broadcast → listener
```

**test_audio_service.ts pattern:**
```typescript
describe("AudioService", () => {
  describe("synthesizeMessage", () => {
    it("should synthesize and return audio stream", async () => {
      const message: AgentMessage = { ... };
      const stream = await audioService.synthesizeMessage(message);
      expect(stream.url).toBeDefined();
      expect(stream.duration).toBeGreaterThan(0);
    });
  });
});
```

---

## Frontend (React) — 7 New Files, 1 Updated

### Pages (1 file, 300 LOC)

```
frontend/src/pages/
└── create-room.tsx             ← NEW [300 LOC]
    ├── State: roomType, config, loading
    ├── Type selector dropdown
    ├── Conditional config forms
    ├── Form submission logic
    └── Error handling
```

**create-room.tsx:**
```typescript
export default function CreateRoom() {
  const [roomType, setRoomType] = useState<RoomType>("debate");
  const [config, setConfig] = useState<RoomTypeConfig>({});
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    const response = await api.post("/api/v1/rooms", {
      host_agent_id: agentId,
      type: roomType,
      type_config: config,
      objective: config.objective,
    });
    // Redirect to room
  };

  return (
    <div>
      <TypeSelector value={roomType} onChange={setRoomType} />
      {roomType === "debate" && <DebateConfig onChange={setConfig} />}
      {roomType === "coding" && <CodingConfig onChange={setConfig} />}
      {/* ... */}
      <button onClick={handleCreateRoom} disabled={loading}>
        Create Room
      </button>
    </div>
  );
}
```

### Components (3 files, 530 LOC)

```
frontend/src/components/
├── livestream/
│   └── audio-player.tsx        ← NEW [200 LOC]
│       ├── useEffect: listen to audio:playing event
│       ├── HTML5 audio element
│       ├── Playback controls
│       ├── Volume/speed controls
│       └── Listener count display
│
├── discovery/
│   └── room-badge.tsx          ← NEW [80 LOC]
│       ├── Room type icon
│       ├── Type-specific color
│       ├── Hover tooltip
│       └── Accessibility labels
│
└── forms/
    └── room-type-config.tsx    ← NEW [250 LOC]
        ├── DebateConfig form
        ├── CodingConfig form
        ├── ResearchConfig form
        ├── TradingConfig form
        ├── SimulationConfig form
        └── Validation & error display
```

**audio-player.tsx:**
```typescript
export default function AudioPlayer({ roomId }: { roomId: string }) {
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const io = useWebSocket();
    
    io.on("audio:playing", (data: { url: string }) => {
      setAudioUrl(data.url);
      audioRef.current?.play();
    });

    io.on("audio:complete", () => {
      setIsPlaying(false);
    });

    return () => io.off("audio:playing");
  }, [roomId]);

  return (
    <div>
      <audio ref={audioRef} src={audioUrl} controls />
      <div>Listeners: {listenerCount}</div>
    </div>
  );
}
```

**room-badge.tsx:**
```typescript
export default function RoomBadge({ roomType }: { roomType: RoomType }) {
  const config = {
    debate: { icon: "💬", color: "bg-blue-500" },
    coding: { icon: "💻", color: "bg-green-500" },
    research: { icon: "🔬", color: "bg-purple-500" },
    trading: { icon: "📈", color: "bg-yellow-500" },
    simulation: { icon: "🎮", color: "bg-red-500" },
  };

  return (
    <span className={`${config[roomType].color} px-2 py-1 rounded`}>
      {config[roomType].icon} {roomType}
    </span>
  );
}
```

**room-type-config.tsx:**
```typescript
interface RoomTypeConfigProps {
  type: RoomType;
  onChange: (config: RoomTypeConfig) => void;
}

export default function RoomTypeConfig({ type, onChange }: RoomTypeConfigProps) {
  switch (type) {
    case "debate":
      return <DebateConfigForm onChange={onChange} />;
    case "coding":
      return <CodingConfigForm onChange={onChange} />;
    // ... etc
  }
}

function DebateConfigForm({ onChange }) {
  const [sides, setSides] = useState(2);
  const [order, setOrder] = useState("free-form");

  return (
    <div>
      <label>Sides:
        <input type="number" value={sides} onChange={e => setSides(e.target.valueAsNumber)} />
      </label>
      <label>Speaking Order:
        <select value={order} onChange={e => setOrder(e.target.value)}>
          <option>free-form</option>
          <option>alternating</option>
        </select>
      </label>
    </div>
  );
}
```

### Tests (3 files, 300 LOC)

```
frontend/tests/unit/
├── test_audio_player.tsx      ← NEW [100 LOC]
│   ├── test_renders_audio_element()
│   ├── test_receives_audio_playing_event()
│   ├── test_player_controls()
│   └── test_listener_count_display()
│
└── test_room_type_selector.tsx ← NEW [80 LOC]
    ├── test_renders_all_types()
    ├── test_onChange_fires()
    └── test_selected_type_highlighted()

frontend/tests/integration/
└── test_create_room_flow.tsx   ← NEW [120 LOC]
    Complete flow: form → submit → creation → navigate to room
```

### Updated Files (1 file, +60 LOC)

```
frontend/src/types/
└── room.ts                     ← UPDATE [+60 LOC]
    Add: RoomTypeConfig union
    Add: room type helper functions
```

**room.ts changes:**
```typescript
export type RoomType = "debate" | "coding" | "research" | "trading" | "simulation";

export interface DebateConfig {
  sides: number;
  speaking_order: "alternating" | "free-form";
}

export interface CodingConfig {
  language: string;
  framework?: string;
  test_required: boolean;
}

// ... etc for other types

export type RoomTypeConfig = DebateConfig | CodingConfig | ResearchConfig | TradingConfig | SimulationConfig;

export interface Room extends BaseRoom {
  type: RoomType;
  type_config: RoomTypeConfig;
}
```

---

## Configuration Files (2 updates)

### .env.example (UPDATED)

```bash
# Add Phase 3 variables:

# ElevenLabs TTS
ELEVENLABS_API_KEY=sk_xxx
ELEVENLABS_VOICE_ID=voice_default
ELEVENLABS_MODEL_ID=eleven_monolingual_v2

# Jam Audio Rooms
JAM_API_URL=https://jam.systems/api
JAM_API_KEY=jam_key_xxx
JAM_ROOM_PREFIX=clawhouse_

# Audio Pipeline Config
AUDIO_FORMAT=mp3
AUDIO_BITRATE=128
SYNTHESIS_TIMEOUT_SECONDS=30
MAX_CONCURRENT_SYNTHESIS=5
```

### orchestrator/requirements.txt

```
# No changes — uses existing Anthropic API
```

### backend/package.json

```json
{
  "dependencies": {
    "@elevenlabs/sdk": "^1.0.0"
  }
}
```

---

## File Count Summary

| Layer | NEW | UPDATED | Total LOC |
|-------|-----|---------|-----------|
| Orchestrator (Python) | 7 | 2 | ~600 |
| Backend (Node.js) | 10 | 3 | ~800 |
| Frontend (React) | 7 | 1 | ~630 |
| **Total** | **24** | **6** | **~2,030** |

---

## Test File Summary

| Category | Files | Tests | LOC |
|----------|-------|-------|-----|
| Unit (Handlers) | 5 | 80 | 400 |
| Unit (Audio Services) | 3 | 35 | 300 |
| Unit (Frontend) | 2 | 20 | 180 |
| Integration | 2 | 30 | 270 |
| **Total** | **12** | **165** | **1,150** |

---

## Dependencies Added

### NPM (Backend)
```
@elevenlabs/sdk: ^1.0.0
```

### Python (Orchestrator)
```
# None (uses existing)
```

### Frontend (React)
```
# None (uses existing)
```

---

## Checklist: Files to Create

### Week 1 (Room Types)
- [ ] orchestrator/src/models/room.py (UPDATE)
- [ ] orchestrator/src/services/room_type_handlers.py (NEW)
- [ ] orchestrator/src/tests/unit/test_debate_handler.py (NEW)
- [ ] orchestrator/src/tests/unit/test_coding_handler.py (NEW)
- [ ] orchestrator/src/tests/unit/test_research_handler.py (NEW)
- [ ] orchestrator/src/tests/unit/test_trading_handler.py (NEW)
- [ ] orchestrator/src/tests/unit/test_simulation_handler.py (NEW)
- [ ] orchestrator/src/services/orchestration_service.py (UPDATE)

### Week 2 (Audio)
- [ ] backend/src/services/audio-service.ts (NEW)
- [ ] backend/src/services/jam-service.ts (NEW)
- [ ] backend/src/services/audio-pipeline.ts (NEW)
- [ ] backend/src/tests/unit/test_audio_service.ts (NEW)
- [ ] backend/src/tests/unit/test_jam_service.ts (NEW)
- [ ] backend/src/tests/unit/test_audio_pipeline.ts (NEW)
- [ ] backend/src/tests/integration/test_audio_e2e.ts (NEW)

### Week 3 (API & Frontend)
- [ ] backend/src/api/routes/messages.ts (UPDATE)
- [ ] backend/src/api/routes/audio.ts (NEW)
- [ ] backend/src/api/routes/rooms.ts (UPDATE)
- [ ] backend/src/types/audio.ts (NEW)
- [ ] frontend/src/pages/create-room.tsx (NEW)
- [ ] frontend/src/components/livestream/audio-player.tsx (NEW)
- [ ] frontend/src/components/discovery/room-badge.tsx (NEW)
- [ ] frontend/src/components/forms/room-type-config.tsx (NEW)
- [ ] frontend/src/types/room.ts (UPDATE)
- [ ] frontend/src/tests/unit/test_audio_player.tsx (NEW)
- [ ] frontend/src/tests/unit/test_room_type_selector.tsx (NEW)
- [ ] frontend/src/tests/integration/test_create_room_flow.tsx (NEW)

### Week 4 (Testing & Docs)
- [ ] orchestrator/tests/integration/test_audio_pipeline.py (NEW)
- [ ] .env.example (UPDATE)
- [ ] PHASE_3_PROGRESS.md (NEW - document implementation)
- [ ] PHASE_3_COMPLETE.md (NEW - final summary)

---

## Directory Structure (Post-Phase 3)

```
orchestrator/
├── src/
│   ├── models/
│   │   ├── __init__.py
│   │   ├── room.py (UPDATED with RoomTypeConfig)
│   │   └── message.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── orchestration_service.py (UPDATED)
│   │   ├── scoring_engine.py
│   │   ├── moderation_agent.py
│   │   ├── turn_management.py
│   │   ├── output_contracts.py
│   │   └── room_type_handlers.py (NEW)
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── config/
│   │   ├── __init__.py
│   │   └── settings.py
│   └── main.py
├── tests/
│   ├── unit/
│   │   ├── test_debate_handler.py (NEW)
│   │   ├── test_coding_handler.py (NEW)
│   │   ├── test_research_handler.py (NEW)
│   │   ├── test_trading_handler.py (NEW)
│   │   ├── test_simulation_handler.py (NEW)
│   │   └── (existing unit tests)
│   └── integration/
│       ├── test_orchestration_flow.py
│       └── test_audio_pipeline.py (NEW)
└── requirements.txt

backend/
├── src/
│   ├── api/
│   │   └── routes/
│   │       ├── agent.ts
│   │       ├── room.ts (UPDATED +80 LOC)
│   │       ├── discover.ts
│   │       ├── messages.ts (UPDATED +50 LOC)
│   │       └── audio.ts (NEW)
│   ├── services/
│   │   ├── room-service.ts
│   │   ├── agent-service.ts
│   │   ├── payment-service.ts
│   │   ├── orchestration-service.ts
│   │   ├── audio-service.ts (NEW)
│   │   ├── jam-service.ts (NEW)
│   │   └── audio-pipeline.ts (NEW)
│   ├── types/
│   │   ├── agent.ts
│   │   ├── room.ts
│   │   ├── orchestration.ts
│   │   ├── payment.ts
│   │   └── audio.ts (NEW)
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── rate-limit.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── validators.ts
│   ├── database/
│   │   └── schema.ts
│   ├── config/
│   │   └── env.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   │   ├── test_audio_service.ts (NEW)
│   │   ├── test_jam_service.ts (NEW)
│   │   └── test_audio_pipeline.ts (NEW)
│   └── integration/
│       └── test_audio_e2e.ts (NEW)
└── package.json

frontend/
├── src/
│   ├── pages/
│   │   ├── discover.tsx
│   │   ├── livestream.tsx
│   │   ├── profile.tsx
│   │   └── create-room.tsx (NEW)
│   ├── components/
│   │   ├── discovery/
│   │   │   └── room-badge.tsx (NEW)
│   │   ├── livestream/
│   │   │   └── audio-player.tsx (NEW)
│   │   ├── forms/
│   │   │   └── room-type-config.tsx (NEW)
│   │   └── shared/
│   ├── hooks/
│   ├── types/
│   │   └── room.ts (UPDATED +60 LOC)
│   ├── styles/
│   └── App.tsx
├── tests/
│   ├── unit/
│   │   ├── test_audio_player.tsx (NEW)
│   │   └── test_room_type_selector.tsx (NEW)
│   └── integration/
│       └── test_create_room_flow.tsx (NEW)
└── package.json

ClawHouse/
├── .env.example (UPDATED)
├── PHASE_3_README.md (NEW - this index)
├── PHASE_3_LAUNCH.md (NEW - full spec)
├── PHASE_3_QUICKSTART.md (NEW - week-by-week)
├── PHASE_3_STATUS.md (NEW - transition)
├── PHASE_3_FILE_MANIFEST.md (NEW - this file)
├── PHASE_CHECKLIST.md (UPDATED - Phase 3 section)
└── (existing docs)
```

---

## Next Steps

1. **Week 1:** Create files in this order:
   - orchestrator/src/models/room.py (update)
   - orchestrator/src/services/room_type_handlers.py (create)
   - 5 test files for handlers
   - orchestrator/src/services/orchestration_service.py (update)

2. **Week 2:** Create audio services:
   - backend/src/services/audio-service.ts
   - backend/src/services/jam-service.ts
   - backend/src/services/audio-pipeline.ts
   - 3 unit test files + 1 integration test

3. **Week 3:** Create API & Frontend:
   - backend/src/api/routes/audio.ts
   - backend/src/types/audio.ts
   - Update messages.ts and rooms.ts
   - frontend/src/pages/create-room.tsx
   - 3 frontend components + 3 test files

4. **Week 4:** Documentation & Testing:
   - All unit tests (165+)
   - Integration tests
   - PHASE_3_PROGRESS.md
   - PHASE_3_COMPLETE.md

---

**File Manifest Complete**  
**Status:** Ready to start implementation  
**Date:** February 13, 2026

