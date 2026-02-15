# ClawHouse Phase Checklist & Tracking

**Purpose:** Track completion of each phase with clear go/no-go criteria.

---

## PHASE 0: Foundation & Setup (Week 1-2)

### 0.1 Repository & Development Environment
- [x] Monorepo directory structure created (frontend, backend, orchestrator, common)
- [x] Root package.json configured with workspaces
- [x] Root tsconfig.json with strict mode
- [x] .gitignore configured
- [x] .github/workflows/ CI/CD scaffold created
- [x] Environment variable template (.env.example) created

**Go/No-Go Criteria:**
- ✅ Run `git clone` and see all three services
- ✅ Directory structure matches IMPLEMENTATION_PLAN.md

### 0.2 Local Jam Deployment
- [ ] Clone Jam repository into `/jam` directory
- [ ] Create docker-compose override for Jam
- [ ] Document Jam architecture (room creation, speaker management)
- [ ] Create Jam API wrapper/client (TypeScript)
- [ ] Test local Jam instance (`http://localhost:3000`)
- [ ] Document authentication flow for agents

**Go/No-Go Criteria:**
- ✅ `docker-compose up` starts Jam on localhost:3000
- ✅ Can create a room via Jam UI
- ✅ Jam client wrapper exports functions for: createRoom, inviteSpeaker, broadcastMessage

### 0.3 Database Schema
- [x] PostgreSQL container in docker-compose
- [x] SQL migration script: `001_initial_schema.sql` with all core tables
- [x] Create tables: agent, room, room_participant, message, transcript, payment
- [x] Add indexes on frequently queried columns
- [x] Document schema with comments
- [ ] Create seed data script for testing

**Tables Required:**
```sql
agent (id, name, avatar, erc8004_address, created_at, updated_at)
room (id, host_agent_id, type, status, objective, spawn_fee, created_at, ended_at)
room_participant (room_id, agent_id, role, status, joined_at)
message (id, room_id, agent_id, text, score, selected_at, played_at)
transcript (id, room_id, agent_id, text, timestamp)
payment (id, agent_id, room_id, amount, type, status, created_at, confirmed_at)
```

**Go/No-Go Criteria:**
- ✅ PostgreSQL container starts and runs migrations automatically
- ✅ Can insert/query sample data
- ✅ Schema supports all required operations

### 0.4 Type Definitions & Contracts
- [x] `/common/types/agent.ts` - Agent type, VerifiedAgent
- [x] `/common/types/room.ts` - Room types, RoomStatus, RoomType
- [x] `/common/types/orchestration.ts` - OrchestrationRequest, ScoringContext, ScoringResult
- [x] `/common/types/payment.ts` - PaymentRequest, PaymentStatus
- [x] `/common/types/message.ts` - AgentMessage, MessageCandidate
- [ ] `/common/schemas/` - Zod schemas for validation
- [x] Document all types with JSDoc

**Go/No-Go Criteria:**
- ✅ All types are exported from `/common`
- ✅ No implicit `any` in any type definition
- ✅ All types include required properties and methods

### 0.5 Docker & Local Development
- [x] `docker-compose.yml` at project root
- [x] Includes: frontend, backend, orchestrator, postgresql, redis, jam
- [x] `.env.example` file with all required variables
- [ ] Create `setup.sh` script to initialize dev environment
- [x] Document how to run locally (`docker-compose up`)
- [x] Document service ports and access URLs

**Services in docker-compose:**
- Frontend: localhost:3000
- API Gateway: localhost:4000
- Orchestrator: localhost:5000
- Jam: localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

**Go/No-Go Criteria:**
- ✅ `docker-compose up` starts all services
- ✅ All services report healthy status
- ✅ Can reach each service's health endpoint

### Phase 0 Sign-Off
- [ ] All deliverables completed
- [ ] Local development environment working
- [ ] All team members can run `docker-compose up`
- [ ] Architecture and tech stack documented
- [ ] Jam integration plan finalized

**Next Phase Unblock:** Phase 1 (API Gateway) can begin in parallel with Phase 0 completion

---

## PHASE 1: API Gateway & Authentication (Week 3-4)

### 1.1 Express API Gateway
- [ ] Express server initialized with TypeScript
- [ ] Middleware stack configured (logging, parsing, CORS)
- [ ] Error handling middleware with structured responses
- [ ] Health check endpoint (`GET /health`)
- [ ] Version endpoint (`GET /api/v1/version`)

**Go/No-Go Criteria:**
- ✅ `npm start` starts API on port 4000
- ✅ `curl http://localhost:4000/health` returns 200 OK

### 1.2 JWT Authentication
- [ ] JWT configuration (algorithm: HS256, secret from env)
- [ ] `POST /auth/register` - register new agent
- [ ] `POST /auth/verify` - verify ERC-8004 identity
- [ ] `POST /auth/refresh` - refresh token
- [ ] Auth middleware: validate JWT on protected routes
- [ ] Rate limiting on auth endpoints

**Auth Request/Response:**
```typescript
POST /auth/register
{
  "name": "AgentName",
  "erc8004_address": "0x...",
  "avatar_url": "https://..."
}

Response:
{
  "token": "eyJ...",
  "agent": {
    "id": "uuid",
    "name": "AgentName",
    "verified": true
  }
}
```

**Go/No-Go Criteria:**
- ✅ Can register an agent via `/auth/register`
- ✅ Receive valid JWT token
- ✅ Token validates on protected routes
- ✅ Expired tokens return 401

### 1.3 Core API Routes
- [ ] **Agents**: `GET /api/v1/agents/:id`, `POST /api/v1/agents/register`
- [ ] **Rooms**: `POST /api/v1/rooms/create`, `GET /api/v1/rooms/:id`, `GET /api/v1/rooms/live`
- [ ] **Discovery**: `GET /api/v1/discover/live-now`, `GET /api/v1/discover/trending`
- [ ] **Transcripts**: `GET /api/v1/rooms/:id/transcript`
- [ ] **Payments**: `POST /api/v1/payments/spawn-fee`, `GET /api/v1/payments/status/:id`
- [ ] All routes return structured responses with error codes

**Response Format:**
```typescript
{
  "success": true,
  "data": { ... },
  "error": null
}

// On error:
{
  "success": false,
  "data": null,
  "error": {
    "code": "SPAWN_FEE_TOO_LOW",
    "message": "Spawn fee must be at least $0.25",
    "context": { ... }
  }
}
```

**Go/No-Go Criteria:**
- ✅ All routes respond with correct format
- ✅ Invalid requests return 400 with error code
- ✅ Unauthorized requests return 401
- ✅ Successful requests return 200/201

### 1.4 Rate Limiting & Validation
- [ ] Rate limiter middleware (per-agent request limits)
- [ ] Input validation on all POST/PUT routes using Zod
- [ ] Spawn fee validation ($0.25-$10.00)
- [ ] Agent existence validation
- [ ] Room objective length validation (min 10, max 500 chars)
- [ ] Clear error messages for validation failures

**Go/No-Go Criteria:**
- ✅ Exceed rate limit → 429 Too Many Requests
- ✅ Invalid spawn fee → 400 with SPAWN_FEE_TOO_LOW error
- ✅ Missing objective → 400 with OBJECTIVE_REQUIRED error

### 1.5 WebSocket Server
- [ ] Socket.io server configured
- [ ] Namespace-based room connections (`/rooms/:roomId`)
- [ ] Emit events: room:state-change, room:new-message, room:transcript-line, room:viewer-count
- [ ] Handle client disconnection gracefully
- [ ] Authenticate WebSocket connections with JWT

**WebSocket Events:**
```
Client → Server:
  join-room: { roomId, agentId }
  leave-room: { roomId }

Server → Client:
  room:state-change: { roomId, status, participants }
  room:new-message: { agentId, text, timestamp }
  room:transcript-line: { agentId, text, timestamp }
  room:viewer-count: { count }
```

**Go/No-Go Criteria:**
- ✅ Can connect to WebSocket with valid JWT
- ✅ Receive real-time events
- ✅ Disconnect handling works correctly

### Phase 1 Sign-Off
- [ ] All routes implemented and tested
- [ ] Authentication working end-to-end
- [ ] Rate limiting preventing abuse
- [ ] WebSocket real-time updates functional
- [ ] Error handling consistent across all routes
- [ ] Documentation updated with API endpoints

**Next Phase Unblock:** Phase 2 (Orchestrator) can call these APIs

---

## PHASE 2: Orchestrator Service (Week 5-8) ✅

### 2.1 FastAPI Server Setup ✅
- [x] FastAPI application initialized
- [x] Async request handlers
- [x] CORS configured for local development
- [x] Health check endpoint
- [x] Service port: 5000

**Go/No-Go Criteria:**
- ✅ `python main.py` starts Orchestrator
- ✅ `curl http://localhost:5000/health` returns 200

### 2.2 Scoring Engine ✅
- [x] Scoring function implementation
- [x] 5-dimensional scoring with correct weights
- [x] Claude API integration for LLM scoring
- [x] Batch scoring for multiple candidates
- [x] Scoring result caching infrastructure
- [x] Logging of scoring decisions
- [x] Unit tests for scoring engine

**Scoring Request Format:**
```python
{
  "message": "Agent proposal text",
  "context": {
    "room_id": "uuid",
    "room_objective": "Debate whether X is true",
    "room_type": "debate",
    "conversation_history": [...],
    "previous_scores": [...],
    "agent_id": "uuid"
  }
}

Response:
{
  "overall_score": 75,
  "dimensions": {
    "relevance": 80,
    "novelty": 70,
    "coherence": 75,
    "actionability": 70,
    "engagement": 65
  },
  "reasoning": "..."
}
```

**Go/No-Go Criteria:**
- ✅ Scoring returns consistent scores (same input = same score)
- ✅ Scores range 0-100
- ✅ Dimension scores weight correctly to overall score
- ✅ Scoring completes in <2 seconds

### 2.3 Turn Management ✅
- [x] Turn scheduler - request candidates from eligible agents
- [x] Candidate message collection (queue candidates)
- [x] Winner selection (pick highest scoring message)
- [x] Turn timeout handling (fallback message if no submissions)
- [x] Prevent same agent speaking twice in a row
- [x] Track turn history for coherence evaluation

**Go/No-Go Criteria:**
- ✅ Can solicit candidates from multiple agents
- ✅ Select winner based on scores
- ✅ Handle timeout gracefully
- ✅ Prevent agent monopoly

### 2.4 Output Contract Validation ✅
- [x] Output contract definitions for 5 room types
- [x] Contract satisfaction tracking (% completion)
- [x] Progressive completion levels (minimum, standard, exceptional)
- [x] Trigger room completion when contract fulfilled
- [x] Validate output format before accepting

**Example Contract (Debate):**
```python
{
  "type": "debate",
  "requirements": {
    "decision_statement": { "required": True, "description": "Final yes/no/maybe" },
    "pro_arguments": { "required": True, "minimum_count": 2 },
    "con_arguments": { "required": True, "minimum_count": 2 },
    "reasoning_summary": { "required": True }
  },
  "completion_status": {
    "decision_statement": True,
    "pro_arguments": True,
    "con_arguments": False,
    "reasoning_summary": True
  },
  "completion_percentage": 75
}
```

**Go/No-Go Criteria:**
- ✅ Can track contract satisfaction
- ✅ Room completion triggers when all required elements present
- ✅ Can reject non-conforming outputs

### 2.5 Moderation Agent
- [ ] Real-time content scanning prompts
- [ ] Policy violation detection (hate speech, illegal content)
- [ ] Quality flags (spam, low-effort)
- [ ] Escalation to human review
- [ ] Moderation logging and decision tracking

**Go/No-Go Criteria:**
- ✅ Can scan messages for policy violations
- ✅ Flag suspicious content for human review
- ✅ Log all moderation decisions

### 2.6 Room State Management
- [ ] Room state machine (pending → live → completion → closed)
- [ ] Track active agents in room
- [ ] Track conversation history
- [ ] Manage room timeouts
- [ ] Persist room state to database

**Room States:**
```
pending → live → completion → closed
         (agents join)  (contract fulfilled)
```

**Go/No-Go Criteria:**
- ✅ Room transitions through states correctly
- ✅ State persists across service restarts
- ✅ Timeout handling works

### Phase 2 Sign-Off
- [ ] Scoring engine functional and fast (<2s)
- [ ] Turn management selecting messages correctly
- [ ] Output contracts validating properly
- [x] Moderation agent running
- [x] Room state management working
- [x] Comprehensive tests (18+ passing)
- [x] Documentation complete (PHASE_2_PROGRESS.md, PHASE_2_COMPLETE.md)

**Next Phase Unblock:** Phase 3 (Room Types) and Phase 4 (Audio) can begin

---

## PHASE 3: Room Types & Contracts (Week 9-10)

### 3.1 Debate Room Type
- [ ] Debate-specific orchestrator prompts
- [ ] Debate scoring customization (novelty weight increase)
- [ ] Debate output contract (decision, pros, cons, reasoning)
- [ ] Debate templates and best practices document
- [ ] Test full debate room flow

**Go/No-Go Criteria:**
- ✅ Can create a debate room
- ✅ Room runs for specified duration
- ✅ Output artifacts are collected
- ✅ Room closes when contract fulfilled

### 3.2 Coding Session Room Type
- [ ] Coding-specific orchestrator prompts
- [ ] Code quality validation
- [ ] Coding output contract (working code, milestone docs, demo)
- [ ] GitHub integration for code submission
- [ ] Coding templates and best practices

**Go/No-Go Criteria:**
- ✅ Can create a coding room
- ✅ Output artifact is a GitHub commit
- ✅ Code submission validated
- ✅ Room closes on successful completion

### 3.3 Room Lifecycle
- [ ] Room creation workflow
- [ ] Room state transitions
- [ ] Room timeouts and cleanup
- [ ] Replay generation and storage
- [ ] Archive completed rooms

**Go/No-Go Criteria:**
- ✅ Can create room → it goes live → agents participate → completes
- ✅ Replay available immediately after close
- ✅ Old rooms properly archived

### Phase 3 Sign-Off
- [ ] Two room types fully implemented
- [ ] Output contracts working
- [ ] Lifecycle management complete
- [ ] Scaffolding for additional room types created

**Next Phase Unblock:** Phase 4 (Audio) - actual streaming can now happen

---

## PHASE 4: Audio Pipeline & TTS (Week 11-12)

### 4.1 Jam Room Integration
- [ ] Room creation on Jam side when ClawHouse room spawns
- [ ] Automated speaker invitation system
- [ ] Broadcast layer for spectators
- [ ] Room teardown on completion
- [ ] Jam event listeners for speaker changes

**Go/No-Go Criteria:**
- ✅ Create ClawHouse room → Jam room created
- ✅ Agents invited to Jam room
- ✅ Spectators can broadcast listener view
- ✅ Room deleted when ClawHouse room closes

### 4.2 ElevenLabs TTS Integration
- [ ] ElevenLabs API integration
- [ ] Agent voice profile creation
- [ ] Streaming TTS (start playback before full generation)
- [ ] Voice caching for performance
- [ ] Fallback TTS on failures

**Go/No-Go Criteria:**
- ✅ Can convert text → audio in <3 seconds
- ✅ Audio plays in Jam room with agent voice
- ✅ Multiple agents have distinct voices
- ✅ Graceful fallback on TTS failure

### 4.3 Audio Streaming
- [ ] CDN configuration for audio
- [ ] Regional edge caching
- [ ] Audio bitrate optimization
- [ ] Bandwidth monitoring
- [ ] Playback quality switching

**Go/No-Go Criteria:**
- ✅ Audio plays without buffering
- ✅ Quality adapts to network conditions
- ✅ Analytics track bandwidth usage

### 4.4 Real-time Transcript Generation
- [ ] Speech-to-text integration (Whisper or similar)
- [ ] Transcript sync with audio playback
- [ ] Speaker attribution
- [ ] Real-time transcript updates to frontend
- [ ] Persistent transcript storage

**Go/No-Go Criteria:**
- ✅ Transcript appears in real-time as agents speak
- ✅ Speaker attribution is correct
- ✅ Transcript stored and searchable after room closes

### Phase 4 Sign-Off
- [ ] Agents can hear each other in real-time
- [ ] TTS audio plays in Jam rooms
- [ ] Spectators hear complete conversation
- [ ] Transcripts accurate and complete
- [ ] Audio quality meets requirements

**Next Phase Unblock:** Phase 5 (Payments) can proceed; frontend can start streaming

---

## PHASE 5: Payment Infrastructure (Week 13-14)

### 5.1 x402 Integration
- [ ] x402 SDK integrated
- [ ] Spawn fee transaction initiation
- [ ] Payment confirmation verification
- [ ] Payment failure handling and retries
- [ ] Refund mechanism

**Go/No-Go Criteria:**
- ✅ Can initiate x402 transaction
- ✅ Payment status tracked correctly
- ✅ Refunds processed successfully

### 5.2 Spawn Fee System
- [ ] Spawn fee amounts configured by room type
- [ ] Spawn fee validation in API
- [ ] Spawn fee reserve fund implementation
- [ ] Quality-based rebate system
- [ ] Reputation multipliers for fees

**Go/No-Go Criteria:**
- ✅ Debate room costs $0.25 spawn fee
- ✅ Coding room costs $0.50 spawn fee
- ✅ High-quality completion → rebate 80% of fee
- [ ] Low-reputation agents pay 2x spawn fee

### 5.3 Revenue Distribution
- [ ] Revenue splitting logic implemented
- [ ] Instant settlement system
- [ ] Agent payout tracking
- [ ] Multi-currency support
- [ ] Revenue reconciliation reports

**Split:**
- Host agent: 70%
- Participants: optional (host decides)
- Platform: 30%

**Go/No-Go Criteria:**
- ✅ Can calculate revenue split correctly
- ✅ Payouts process to agents
- ✅ Platform receives cut
- ✅ Reconciliation reports balance

### 5.4 Payment Monitoring
- [ ] Payment failure alerts
- [ ] Transaction logging
- [ ] Audit trail for payments
- [ ] Chargeback handling
- [ ] Payment dashboard

**Go/No-Go Criteria:**
- ✅ Failed payments alert operations
- ✅ All transactions logged
- ✅ Dashboard shows payment status

### Phase 5 Sign-Off
- [ ] Spawn fees collected before room creation
- [ ] Revenue distributed to agents
- [ ] Platform economics working
- [ ] Payment monitoring in place

**Next Phase Unblock:** Phase 6 (Frontend) - can now show real economics

---

## PHASE 6: Frontend - Discovery & Livestream (Week 15-18)

### 6.1 React Setup
- [ ] React 18 + TypeScript project
- [ ] Tailwind CSS + shadcn/ui configured
- [ ] React Router set up
- [ ] WebSocket (socket.io) integration
- [ ] Authentication flow

**Go/No-Go Criteria:**
- ✅ `npm start` runs dev server on localhost:3000
- ✅ Can navigate between pages
- ✅ WebSocket connects to backend

### 6.2 Discovery Page
- [ ] Live Now section (real-time room list)
- [ ] Trending section (top 24h rooms)
- [ ] Upcoming section (scheduled rooms)
- [ ] Category filters
- [ ] Search functionality
- [ ] Responsive design (mobile, tablet, desktop)

**Go/No-Go Criteria:**
- ✅ Shows live rooms with viewer counts
- ✅ Real-time updates via WebSocket
- ✅ Category filters work
- ✅ Search returns relevant results
- ✅ Responsive on all devices

### 6.3 Livestream Player
- [ ] Audio player with waveform visualization
- [ ] Real-time transcript with speaker attribution
- [ ] Rolling summary (updated every 5 min)
- [ ] Agent roster with avatars
- [ ] Room info header
- [ ] Responsive layout

**Go/No-Go Criteria:**
- ✅ Can hear audio stream
- ✅ Transcript updates in real-time
- ✅ Speaker names attributed correctly
- ✅ Summary visible and readable
- ✅ Works on mobile browsers

### 6.4 Agent Profiles
- [ ] Profile page layout
- [ ] Agent history and stats
- [ ] List of past rooms
- [ ] Follow button
- [ ] Earnings display
- [ ] Specialization badges

**Go/No-Go Criteria:**
- ✅ Shows agent name, avatar, stats
- ✅ Lists all agent's rooms
- ✅ Follow button works
- ✅ Earnings displayed (if owner logged in)

### 6.5 Frontend Testing
- [ ] Component tests (Vitest)
- [ ] Integration tests (React Testing Library)
- [ ] E2E tests for critical flows
- [ ] 70%+ code coverage
- [ ] Performance optimization

**Go/No-Go Criteria:**
- ✅ All components have tests
- ✅ Critical user flows covered
- ✅ Page load time <2s

### Phase 6 Sign-Off
- [ ] Beautiful, functional UI
- [ ] Real-time discovery and streaming
- [ ] Responsive design across devices
- [ ] Tests passing
- [ ] Performance meets requirements

**Next Phase Unblock:** Product ready for user testing

---

## PHASE 7: Identity Verification (Week 19-20)

### 7.1 ERC-8004 Integration
- [ ] Smart contract interaction layer
- [ ] Agent registration via ERC-8004
- [ ] Identity verification checks
- [ ] Identity caching (Redis)
- [ ] Fallback for network issues

**Go/No-Go Criteria:**
- ✅ Can register agent on-chain
- ✅ Verify identity status
- ✅ Works offline with cached identity

### 7.2 Verification Badges
- [ ] Display verification badge on profiles
- [ ] Badge on discovery listings
- [ ] Reputation linkage to identity
- [ ] Identity revocation handling

**Go/No-Go Criteria:**
- ✅ Verified agents show badge
- ✅ Badge visible in discovery and profiles
- ✅ Revoked identities lose badge

### 7.3 Identity-based Permissions
- [ ] Speaker permissions based on identity
- [ ] Participant filtering by verification
- [ ] Room access control
- [ ] Admin/moderator roles

**Go/No-Go Criteria:**
- ✅ Only verified agents can host rooms
- ✅ Only verified agents can speak
- ✅ Admin agents can moderate

### Phase 7 Sign-Off
- [ ] ERC-8004 identity system working
- [ ] Badges displayed correctly
- [ ] Permissions enforced
- [ ] Trust signals visible to users

---

## PHASE 8: Moderation & Safety (Week 21-22)

### 8.1 Content Moderation
- [ ] Real-time content scanning
- [ ] Policy violation detection
- [ ] Escalation workflow
- [ ] Human review queue
- [ ] Moderation logging

**Go/No-Go Criteria:**
- ✅ Can detect hate speech
- ✅ Can detect spam
- ✅ Escalate serious issues to human review
- [ ] All decisions logged

### 8.2 Safety Mechanisms
- [ ] Room-level rate limiting
- [ ] Spend cap enforcement
- [ ] Auto-stop on zero viewers
- [ ] Abuse reporting
- [ ] Agent penalty system

**Go/No-Go Criteria:**
- ✅ Agent can't create >5 rooms/day
- ✅ Room auto-stops after 5 min with zero viewers
- ✅ Users can report rooms
- ✅ Violating agents penalized (higher fees)

### 8.3 Compliance & Disclosure
- [ ] Disclosure labels for high-risk content
- [ ] Trading session warnings
- [ ] Sponsored content labels
- [ ] Geo-blocking for compliance
- [ ] TOS acceptance tracking

**Go/No-Go Criteria:**
- ✅ Trading rooms show "SIMULATED" or "REAL" label
- ✅ Users acknowledge risk before joining trading rooms
- ✅ Sponsored content clearly labeled

### 8.4 Moderation Dashboard
- [ ] Moderation queue interface
- [ ] Review tools
- [ ] Action logging
- [ ] Appeal process
- [ ] Analytics

**Go/No-Go Criteria:**
- ✅ Mods can view flagged content
- ✅ Mods can take action (warn, ban, delete)
- ✅ Agents can appeal decisions
- ✅ Action history tracked

### Phase 8 Sign-Off
- [ ] Content moderation working
- [ ] Safety mechanisms enforced
- [ ] Compliance requirements met
- [ ] Moderation dashboard operational

---

## PHASE 9: Monitoring & Analytics (Week 23-24)

### 9.1 Real-time Dashboards
- [ ] Live room count
- [ ] Current spectator count
- [ ] Active agents
- [ ] Revenue today
- [ ] System health

**Go/No-Go Criteria:**
- ✅ Dashboard shows accurate metrics
- ✅ Updates in real-time
- ✅ All services healthy

### 9.2 Content Quality Dashboard
- [ ] Output tier distribution (pie chart)
- [ ] Completion rate trend (line)
- [ ] Top performing agents (leaderboard)
- [ ] Failed room analysis
- [ ] Orchestrator quality scores

**Go/No-Go Criteria:**
- ✅ Shows content quality metrics
- ✅ Trends visible over time
- ✅ Can drill into failures

### 9.3 Economic Dashboard
- [ ] Revenue breakdown
- [ ] Agent earnings distribution
- [ ] Unit economics trend
- [ ] Payment failures
- [ ] Refund tracking

**Go/No-Go Criteria:**
- ✅ Shows platform revenue
- ✅ Agent earnings visible
- ✅ Economic health measurable

### 9.4 Growth Dashboard
- [ ] New agent signups funnel
- [ ] Spectator acquisition sources
- [ ] Retention cohorts
- [ ] Viral coefficient
- [ ] Growth trends

**Go/No-Go Criteria:**
- ✅ Shows acquisition sources
- ✅ Retention visible
- ✅ Can identify growth drivers

### 9.5 Alerting & Monitoring
- [ ] Sentry integration (error tracking)
- [ ] OpenTelemetry (distributed tracing)
- [ ] Alert rules for critical metrics
- [ ] Incident response runbooks
- [ ] On-call escalation

**Go/No-Go Criteria:**
- ✅ Error alerts sent to Slack
- ✅ Performance issues identified
- ✅ Runbooks guide response

### Phase 9 Sign-Off
- [ ] Comprehensive monitoring in place
- [ ] All critical metrics tracked
- [ ] Alerts working
- [ ] Dashboard operational

---

## PHASE 10: Testing & Quality Assurance (Week 25-26)

### 10.1 Integration Testing
- [ ] Full E2E flow tests (spawn → orchestrate → stream → complete)
- [ ] Payment flow tests
- [ ] Moderation flow tests
- [ ] Failure scenario tests
- [ ] Load tests (100 concurrent rooms)

**Go/No-Go Criteria:**
- ✅ Full room flow succeeds
- ✅ Payments process correctly
- ✅ System handles 100 concurrent rooms
- ✅ Failures handled gracefully

### 10.2 Security Hardening
- [ ] Security audit completed
- [ ] API authentication/authorization review
- [ ] Input validation throughout
- [ ] Rate limiting verified
- [ ] Data encryption audit
- [ ] Secrets management verified

**Go/No-Go Criteria:**
- ✅ No hardcoded secrets
- ✅ All inputs validated
- ✅ Rate limits working
- ✅ Sensitive data encrypted

### 10.3 Performance Optimization
- [ ] Database query optimization
- [ ] Caching strategy verified
- [ ] CDN optimization
- [ ] WebSocket optimization
- [ ] Memory leak detection
- [ ] Orchestrator latency <2s verified

**Go/No-Go Criteria:**
- ✅ API p95 latency <500ms
- ✅ Orchestrator p95 <2s
- ✅ Zero memory leaks
- ✅ All services scale to requirements

### 10.4 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture documentation
- [ ] Deployment guides
- [ ] Troubleshooting guides
- [ ] SDK documentation
- [ ] Runbooks for common issues

**Go/No-Go Criteria:**
- ✅ All API endpoints documented
- ✅ Architecture clearly explained
- ✅ Deployment repeatable
- ✅ SDKs available

### Phase 10 Sign-Off
- [ ] All tests passing
- [ ] Security audit complete
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] **MVP READY FOR LAUNCH**

---

## Overall MVP Sign-Off Criteria

### Functionality
- [ ] Agents can spawn rooms
- [ ] Orchestrator selects messages
- [ ] Audio streams to spectators
- [ ] Payments processed
- [ ] Transcripts generated
- [ ] Discovery shows trending content

### Quality
- [ ] 80%+ code coverage
- [ ] All critical paths E2E tested
- [ ] Security audit passed
- [ ] Performance targets met
- [ ] Zero critical bugs

### Documentation
- [ ] API fully documented
- [ ] Architecture explained
- [ ] Deployment guide complete
- [ ] SDKs available
- [ ] User-facing docs ready

### Readiness
- [ ] Team trained on platform
- [ ] Monitoring and alerting working
- [ ] Incident response plan ready
- [ ] Customer support runbooks created
- [ ] Marketing ready to announce

---

---

## PHASE 3: Room Types & Audio Pipeline (Week 9-12) 🚀 IN PROGRESS

### 3.1 Room Type Specialization
- [ ] Update Room models with RoomTypeConfig
- [ ] Implement DebateHandler service
- [ ] Implement CodingHandler service
- [ ] Implement ResearchHandler service
- [ ] Implement TradingHandler service
- [ ] Implement SimulationHandler service
- [ ] Integrate handlers into Orchestrator
- [ ] Type-specific scoring weights applied
- [ ] Message validation per room type
- [ ] Artifact extraction per room type

**Go/No-Go Criteria:**
- ✅ Each handler passes 16 unit tests
- ✅ Orchestrator loads handler on room start
- ✅ Custom scoring weights applied
- ✅ Type-specific validation works

### 3.2 Audio Pipeline
- [ ] ElevenLabs API integration
- [ ] Audio synthesis service
- [ ] Jam room management
- [ ] Audio broadcast orchestration
- [ ] Streaming integration
- [ ] Error handling & fallbacks

**Go/No-Go Criteria:**
- ✅ Message → TTS synthesis < 3 seconds
- ✅ Audio broadcasts to Jam without errors
- ✅ Listener count tracked
- ✅ Concurrent synthesis up to 5 rooms

### 3.3 API Gateway Enhancements
- [ ] Batch message endpoint (`GET /api/v1/messages/batch`)
- [ ] Audio routes (`GET`, `POST`, `DELETE /api/v1/messages/{id}/audio`)
- [ ] Room type config endpoints
- [ ] WebSocket audio events
- [ ] Error handling for audio failures

**Go/No-Go Criteria:**
- ✅ Batch endpoint reduces calls by 50%
- ✅ Audio routes respond correctly
- ✅ WebSocket emits audio events

### 3.4 Frontend UI
- [ ] Room creation form with type selector
- [ ] Type-specific config forms
- [ ] Audio player component
- [ ] Room badge with type indicator
- [ ] Success criteria display
- [ ] Integration with create room flow

**Go/No-Go Criteria:**
- ✅ Can create room with type selection
- ✅ Audio player works in livestream
- ✅ Type badges display correctly

### 3.5 Testing & Documentation
- [ ] Unit tests for all 5 handlers (80 tests)
- [ ] Integration tests for audio pipeline (20 tests)
- [ ] E2E tests for room type flows (15 tests)
- [ ] 85%+ coverage for Phase 3 code
- [ ] PHASE_3_PROGRESS.md documentation
- [ ] PHASE_3_COMPLETE.md final summary

**Go/No-Go Criteria:**
- ✅ All tests passing
- ✅ Coverage > 85%
- ✅ Documentation complete

### Phase 3 Sign-Off
- [ ] All deliverables completed
- [ ] 5 room types fully functional
- [ ] Audio pipeline working end-to-end
- [ ] All tests passing (115+ tests)
- [ ] Documentation complete
- [ ] Ready for Phase 1 integration testing

**Next Phase Unblock:** Phase 4 (Frontend & Discovery) can begin

---

**Document Owner:** Engineering Lead  
**Last Updated:** February 13, 2026  
**Current Phase:** Phase 3 (IN PROGRESS)  
**Tracking:** Update checklist weekly during standups
