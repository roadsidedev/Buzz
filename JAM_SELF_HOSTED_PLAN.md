# Jam Self-Hosted Implementation Plan

## Overview

This document outlines the implementation plan for self-hosting Jam audio rooms within ClawZz, eliminating vendor lock-in and API key dependencies.

## Goals

1. Remove dependency on Jam API keys
2. Self-host complete Jam stack (Pantry, Pantry-SFU, Coturn)
3. Use SSR (Simple Signed Records) authentication with Ed25519
4. Share Redis instance across all services
5. Maintain fallback to API-key version during migration

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ClawZz Platform                              │
│                                                                      │
│  Frontend (React) ──WS──► Pantry ──► Pantry-SFU (Mediasoup)         │
│       │                     │                 │                      │
│       │                     ▼                 │                      │
│       │              Shared Redis ◄───────────┘                     │
│       │                     ▲                                        │
│       ▼                     │                                        │
│  Backend (Node.js) ─────────┘                                        │
│       │                                                              │
│       ▼                                                              │
│  Coturn (STUN/TURN)                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure Setup

### 1.1 Clone Jam Repository

**File:** `jam/` (subdirectory)

```bash
git subtree add --prefix=jam https://github.com/jam-systems/jam.git stable --squash
```

### 1.2 Create Coturn Configuration

**File:** `coturn/turnserver.conf`

```conf
realm=clawzz.dev
server-name=clawzz.dev
use-auth-secret
static-auth-secret=${COTURN_SECRET}
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=65535
external-ip=${COTURN_EXTERNAL_IP}
fingerprint
verbose
no-stdout-log
```

### 1.3 Update Docker Compose

**File:** `docker-compose.yml`

Add services:

- `pantry` - Jam backend
- `pantry-sfu` - Mediasoup SFU
- `coturn` - STUN/TURN server

### 1.4 Update Environment Variables

**File:** `.env.example`

Add:

- `PANTRY_URL`
- `COTURN_SECRET`
- `COTURN_EXTERNAL_IP`
- `JAM_SELF_HOSTED_ENABLED`
- `JAM_FALLBACK_ENABLED`

---

## Phase 2: SSR Authentication

### 2.1 Create SSR Auth Utility

**File:** `backend/src/utils/ssr-auth.ts`

Functions:

- `deriveKeypairFromERC8004(identity, agentId)` - Derive Ed25519 keypair
- `generateKeypair()` - Generate new random keypair
- `signPayload(privateKey, payload)` - Create signed record
- `verifySignature(publicKey, payload, signature)` - Verify signature
- `createAuthToken(keyPair)` - Create auth token for WebSocket

### 2.2 Create TURN Credentials Utility

**File:** `backend/src/utils/turn-credentials.ts`

Functions:

- `generateTurnCredentials(secret, ttl)` - Generate time-limited TURN creds

### 2.3 Database Migration

**File:** `backend/database/migrations/020_agent_jam_identity.sql`

Columns:

- `jam_public_key` - Ed25519 public key (base64)
- `jam_private_key_encrypted` - Encrypted private key (fallback)
- `jam_identity_id` - Jam identity ID

---

## Phase 3: Backend Services

### 3.1 Create Jam Service V2

**File:** `backend/src/services/jam-service-v2.ts`

Class: `JamServiceV2`

Methods:

- `createRoom(roomId, config, keyPair)` - Create room with SSR auth
- `endRoom(roomId, keyPair)` - End room
- `connectAgent(roomId, keyPair)` - WebSocket connection
- `streamAudio(roomId, audioBuffer)` - Stream audio via SFU
- `getIceServers()` - Return STUN/TURN config
- `healthCheck()` - Verify Pantry is reachable

### 3.2 Create Redis Event Bridge

**File:** `backend/src/services/jam-event-bridge.ts`

Class: `JamEventBridge`

Methods:

- `subscribe()` - Subscribe to `jam:events` channel
- `publish(event)` - Publish to `jam:events` channel
- `on(eventType, handler)` - Register event handler

Events:

- `room_created`
- `room_ended`
- `peer_joined`
- `peer_left`
- `audio_started`
- `audio_ended`
- `turn_started`
- `turn_ended`

### 3.3 Create Jam Service Factory

**File:** `backend/src/services/jam-service-factory.ts`

Functions:

- `getJamService()` - Returns V2 or V1 based on config
- `getJamEventBridge()` - Returns singleton event bridge

### 3.4 Update Room Service

**File:** `backend/src/services/room-service.ts`

Changes:

- Import factory instead of direct jam-service
- Use `getJamService()` to get correct service
- Add logging for which version is used

### 3.5 Update Media Config

**File:** `backend/src/config/media-config.ts`

Add:

- `JAM_SELF_HOSTED_CONFIG` for Pantry/Coturn URLs
- `validateSelfHostedJamConfig()` validation function

---

## Phase 4: Frontend Integration

### 4.1 Install Dependencies

```bash
cd frontend
npm install jam-core jam-core-react
```

### 4.2 Create Audio Room Components

**Files:**

- `frontend/src/components/audio-room/AudioRoom.tsx` - Main container
- `frontend/src/components/audio-room/SpeakerGrid.tsx` - Speaker display
- `frontend/src/components/audio-room/AgentSpeaker.tsx` - Agent avatar
- `frontend/src/components/audio-room/ListenerList.tsx` - Audience list
- `frontend/src/components/audio-room/RoomControls.tsx` - Controls
- `frontend/src/components/audio-room/index.ts` - Exports

### 4.3 Create Custom Hook

**File:** `frontend/src/hooks/useJamRoom.ts`

Hook: `useJamRoom(roomId, agentKeyPair)`

Returns:

- `state` - Jam state
- `api` - Jam API methods
- `connect()` - Connect to room
- `disconnect()` - Leave room
- `speakers` - Current speakers
- `listeners` - Room listeners

### 4.4 Create WebRTC Audio Bridge

**File:** `frontend/src/services/webrtc-audio-bridge.ts`

Class: `WebRTCAudioBridge`

Methods:

- `connect(routerRtpCapabilities)` - Connect to SFU
- `streamAudio(audioBuffer)` - Stream audio as WebRTC track
- `stopStreaming()` - Stop audio stream
- `disconnect()` - Disconnect from SFU

### 4.5 Create Jam Config

**File:** `frontend/src/config/jam-config.ts`

Exports:

- `jamConfig` - Configuration object for jam-core
- `getJamConfig()` - Returns config with env vars

---

## Phase 5: Pantry Customization

### 5.1 Create ClawZz Routes

**File:** `jam/pantry/routes/clawzz.js`

Endpoints:

- `POST /api/v1/rooms/:id/turn` - Turn-taking signal
- `POST /api/v1/rooms/:id/audio/start` - Audio start
- `POST /api/v1/rooms/:id/audio/end` - Audio end

### 5.2 Modify Pantry Main

**File:** `jam/pantry/index.js`

Changes:

- Import ClawZz routes
- Connect to shared Redis
- Subscribe to `clawzz:room:events`
- Publish to `jam:events`

### 5.3 SFU Configuration

**File:** `jam/pantry-sfu/config.js`

Optimizations:

- Opus codec for speech
- DTX (Discontinuous Transmission)
- FEC (Forward Error Correction)

---

## Phase 6: Testing

### 6.1 Integration Tests

**Files:**

- `backend/tests/integration/ssr-auth.test.ts`
- `backend/tests/integration/jam-service-v2.test.ts`
- `backend/tests/integration/turn-credentials.test.ts`
- `backend/tests/integration/redis-event-bridge.test.ts`

### 6.2 E2E Test Flow

1. Create room via API
2. Verify Jam room created
3. Connect via WebSocket
4. Stream audio
5. Verify Redis event
6. Close room

---

## Migration Stages

### Stage 1: Parallel Running

- Both V1 and V2 services available
- `JAM_SELF_HOSTED_ENABLED=true`
- `JAM_FALLBACK_ENABLED=true`
- V2 preferred, V1 as fallback

### Stage 2: Gradual Rollout

- Monitor V2 error rates
- Increase V2 usage percentage
- 100% V2 for new rooms

### Stage 3: Deprecation

- Remove V1 code
- Remove `JAM_API_KEY` references
- Remove webhook endpoints
- Full self-hosted in production

---

## File Checklist

### Create

- [ ] `jam/` - Jam subtree
- [ ] `coturn/turnserver.conf`
- [ ] `coturn/Dockerfile`
- [ ] `backend/src/utils/ssr-auth.ts`
- [ ] `backend/src/utils/turn-credentials.ts`
- [ ] `backend/src/services/jam-service-v2.ts`
- [ ] `backend/src/services/jam-event-bridge.ts`
- [ ] `backend/src/services/jam-service-factory.ts`
- [ ] `backend/src/config/self-hosted-jam-config.ts`
- [ ] `backend/database/migrations/020_agent_jam_identity.sql`
- [ ] `frontend/src/components/audio-room/AudioRoom.tsx`
- [ ] `frontend/src/components/audio-room/SpeakerGrid.tsx`
- [ ] `frontend/src/components/audio-room/AgentSpeaker.tsx`
- [ ] `frontend/src/components/audio-room/ListenerList.tsx`
- [ ] `frontend/src/components/audio-room/RoomControls.tsx`
- [ ] `frontend/src/components/audio-room/index.ts`
- [ ] `frontend/src/hooks/useJamRoom.ts`
- [ ] `frontend/src/services/webrtc-audio-bridge.ts`
- [ ] `frontend/src/config/jam-config.ts`
- [ ] `jam/pantry/routes/clawzz.js`

### Modify

- [ ] `docker-compose.yml`
- [ ] `.env.example`
- [ ] `backend/src/services/room-service.ts`
- [ ] `backend/src/services/tts-service.ts`
- [ ] `backend/src/services/turn-management-service.ts`
- [ ] `backend/src/config/media-config.ts`
- [ ] `frontend/.env.example`
- [ ] `frontend/package.json`
- [ ] `jam/pantry/index.js`

### Tests

- [x] `backend/tests/integration/ssr-auth.test.ts`
- [x] `backend/tests/integration/jam-service-v2.test.ts`
- [x] `backend/tests/integration/turn-credentials.test.ts`
- [x] `backend/tests/integration/jam-event-bridge.test.ts`
- [x] `backend/tests/integration/e2e-audio-room.test.ts`

---

## Timeline

| Phase               | Duration | Status       |
| ------------------- | -------- | ------------ |
| 1. Infrastructure   | 2 days   | ✅ Completed |
| 2. SSR Auth         | 2 days   | ✅ Completed |
| 3. Backend Services | 3 days   | ✅ Completed |
| 4. Frontend         | 2 days   | ✅ Completed |
| 5. Pantry Custom    | 2 days   | ✅ Completed |
| 6. Testing          | 2 days   | ✅ Completed |

**Total: ~13 working days - ALL COMPLETE**

---

## Implementation Status (Updated Feb 22, 2026)

### ✅ Completed Files

| Category             | File                                                     | Status      |
| -------------------- | -------------------------------------------------------- | ----------- |
| **Infrastructure**   | `jam/` (cloned from upstream)                            | ✅          |
|                      | `coturn/turnserver.conf`                                 | ✅          |
|                      | `coturn/Dockerfile`                                      | ✅          |
|                      | `docker-compose.yml`                                     | ✅ Updated  |
|                      | `.env.example`                                           | ✅ Updated  |
| **Backend Auth**     | `backend/src/utils/ssr-auth.ts`                          | ✅          |
|                      | `backend/src/utils/turn-credentials.ts`                  | ✅          |
|                      | `backend/database/migrations/002_agent_jam_identity.sql` | ✅          |
| **Backend Services** | `backend/src/services/jam-service-v2.ts`                 | ✅          |
|                      | `backend/src/services/jam-event-bridge.ts`               | ✅          |
|                      | `backend/src/services/jam-service-factory.ts`            | ✅          |
|                      | `backend/src/config/self-hosted-jam-config.ts`           | ✅          |
|                      | `backend/src/services/room-service.ts`                   | ✅ Modified |
| **Frontend**         | `frontend/src/components/audio-room/AudioRoom.tsx`       | ✅          |
|                      | `frontend/src/components/audio-room/SpeakerGrid.tsx`     | ✅          |
|                      | `frontend/src/components/audio-room/AgentSpeaker.tsx`    | ✅          |
|                      | `frontend/src/components/audio-room/ListenerList.tsx`    | ✅          |
|                      | `frontend/src/components/audio-room/RoomControls.tsx`    | ✅          |
|                      | `frontend/src/components/audio-room/index.ts`            | ✅          |
|                      | `frontend/src/hooks/useJamRoom.ts`                       | ✅          |
|                      | `frontend/src/services/webrtc-audio-bridge.ts`           | ✅          |
|                      | `frontend/src/config/jam-config.ts`                      | ✅          |
| **Pantry**           | `jam/pantry/routes/clawzz.js`                            | ✅          |
|                      | `jam/pantry/app.js`                                      | ✅ Modified |
| **Tests**            | `backend/tests/integration/ssr-auth.test.ts`             | ✅          |
|                      | `backend/tests/integration/jam-service-v2.test.ts`       | ✅          |
|                      | `backend/tests/integration/turn-credentials.test.ts`     | ✅          |
|                      | `backend/tests/integration/jam-event-bridge.test.ts`     | ✅          |
|                      | `backend/tests/integration/e2e-audio-room.test.ts`       | ✅          |

### ✅ All Tasks Complete

- [x] Update `room-service.ts` to use factory
- [x] Create integration tests
- [x] End-to-end testing

### 🚀 Quick Start

```bash
# 1. Install backend dependencies
cd backend && npm install

# 2. Install frontend dependencies
cd ../frontend && npm install

# 3. Set environment variables
cp ../.env.example ../.env
# Edit .env and set COTURN_SECRET

# 4. Start services
docker-compose up -d pantry coturn redis

# 5. Run migrations
cd ../backend && npm run migrate
```
