# Fix Plan: Muted Audio + 0 Listener Count in Live Rooms

## Problem Statement
When joining a live room hosted by radio-runner host agents:
1. No audio is heard — agent mics appear muted
2. User doesn't show up as a listener — count remains at 0

## Root Causes Identified

### ISSUE 1 (PRIMARY — No Audio): `tts:audio` event is NEVER emitted by backend
**File:** `backend/src/services/turn-management-service.ts`
- Frontend listens for `tts:audio` event at `room-live-page.tsx:355`
- Backend only emits `turn:completed` — never `tts:audio`
- Even if it did, `turn:completed` has no `audioBase64` field, only `audioUrl`
- The frontend's audio handler at line 315 checks `if (data.audioBase64)` which is always falsy

### ISSUE 2: `WebRTCAudioBridge.isConnected` is a private field
**File:** `frontend/src/pages/room-live-page.tsx:326`
```typescript
if (audioBridgeRef.current?.isConnected) {  // always undefined — private field
```
- `WebRTCAudioBridge` has `isConnected` as `private` (line 29 of `webrtc-audio-bridge.ts`)
- Public method is `isReady()`
- WebRTC audio path is dead code — always falls back to HTML5 `<audio>`

### ISSUE 3: Listener count stays at 0
**File:** `backend/src/server.ts:549-555`
- `participant:joined` event uses `socket.id` as `agentId` (cryptic socket ID, not real user)
- The frontend handler at `room-live-page.tsx:408-414` adds participants with `name: data.agentId.slice(0, 8)` which is a socket ID fragment
- The event IS emitted, but the data is meaningless — listeners appear as random strings

### ISSUE 4: Jam `soundMuted` defaults to `true`
**File:** `frontend/src/hooks/useJamRoom.ts:131`
```typescript
const isSoundMuted = (state as any).soundMuted ?? true;
```
- Jam WebRTC audio from other speakers is muted at the Jam layer
- Even though local UI shows unmuted, Jam's internal state defaults to muted

### ISSUE 5: No fallback for `turn:completed` audio
- `turn:completed` event only has `audioUrl`, no `audioBase64`
- Frontend's `tts:audio` handler only processes `audioBase64`
- Even if frontend listened to `turn:completed`, no playback path handles URL-only audio

---

## Fixes

### Fix 1: Emit `tts:audio` event with base64 audio payload
**File:** `backend/src/services/turn-management-service.ts`

**Change:** Add a new `_emitTtsAudio` method and call it after synthesis in `_synthesizeAndStream`.

```typescript
// New method to add after _emitTurnCompleted:
private async _emitTtsAudio(
  room: Room,
  message: RoomMessage,
  audioBuffer: Buffer,
  durationMs: number,
  audioUrl: string | null,
): Promise<void> {
  try {
    const { getIO } = await import("../server.js");
    const io = getIO();

    const audioBase64 = audioBuffer.toString("base64");

    io.to(`room:${room.id}`).emit("tts:audio", {
      roomId: room.id,
      messageId: message.id,
      agentId: message.agentId,
      text: message.text,
      audioBase64,
      audioUrl: audioUrl ?? null,
      durationMs,
      provider: "elevenlabs",
      timestamp: new Date().toISOString(),
    });

    logger.debug("tts:audio event emitted", { 
      roomId: room.id, 
      messageId: message.id,
      audioSize: audioBuffer.length,
    });
  } catch (wsErr) {
    logger.error("Failed to emit tts:audio event", { error: wsErr });
  }
}
```

**Call site change in `_synthesizeAndStream`** (after line 507, before `_emitTurnCompleted`):
```typescript
// Emit tts:audio event with base64 payload so frontend can play immediately
await this._emitTtsAudio(room, message, audioBuffer, durationMs, audioUrl);
```

### Fix 2: Use `isReady()` instead of accessing private `isConnected`
**File:** `frontend/src/pages/room-live-page.tsx:326`

**Change:**
```typescript
// BEFORE:
if (audioBridgeRef.current?.isConnected) {

// AFTER:
if (audioBridgeRef.current?.isReady()) {
```

### Fix 3: Fix listener tracking with proper user data
**File:** `backend/src/server.ts:549-555`

**Current code:**
```typescript
io.to(`room:${roomId}`).emit("participant:joined", {
  roomId,
  agentId: socket.id,
  role,
  timestamp: new Date().toISOString(),
});
```

**Problem:** `socket.id` is a cryptic socket identifier, not a real user identity. The frontend displays `agentId.slice(0, 8)` which looks like a random string.

**Fix:** The browser client sends `agentId` in the join data but the server ignores it. We should use the provided `agentId` if available, or at least mark it as anonymous with a proper label.

```typescript
io.to(`room:${roomId}`).emit("participant:joined", {
  roomId,
  agentId: data.agentId || socket.id,
  agentName: data.agentId ? undefined : "Anonymous Listener",
  role,
  timestamp: new Date().toISOString(),
});
```

**Frontend fix in `room-live-page.tsx:408-414`:**
```typescript
// BEFORE:
setParticipants((prev) => {
  if (prev.some((p) => p.id === data.agentId)) return prev
  return [...prev, { id: data.agentId, name: data.agentId.slice(0, 8), avatar: null, role: data.role }]
})

// AFTER:
setParticipants((prev) => {
  if (prev.some((p) => p.id === data.agentId)) return prev
  return [...prev, {
    id: data.agentId,
    name: data.agentName || (data.agentId.length > 8 ? `Listener ${prev.filter(p => p.role === "spectator").length + 1}` : data.agentId.slice(0, 8)),
    avatar: null,
    role: data.role
  }]
})
```

### Fix 4: Default `soundMuted` to `false` in useJamRoom
**File:** `frontend/src/hooks/useJamRoom.ts:131`

**Change:**
```typescript
// BEFORE:
const isSoundMuted = (state as any).soundMuted ?? true;

// AFTER:
const isSoundMuted = (state as any).soundMuted ?? false;
```

### Fix 5: Add `turn:completed` fallback audio handler
**File:** `frontend/src/pages/room-live-page.tsx`

**Add a listener for `turn:completed` that can play audio via URL when `tts:audio` doesn't provide base64:**

```typescript
// Add after the tts:audio handler useEffect (around line 357):
useEffect(() => {
  const handleTurnCompleted = async (data: any) => {
    if (data.roomId !== streamId) return
    if (!data.audioUrl) return

    console.log('[TTS] Playing audio via turn:completed URL fallback')
    if (audioPlayerRef.current) {
      audioPlayerRef.current.src = data.audioUrl
      audioPlayerRef.current.play().catch(e => 
        console.warn('[TTS] Audio play blocked (needs user interaction):', e)
      )
    }
  }
  wsService.on('turn:completed', handleTurnCompleted)
  return () => wsService.off('turn:completed', handleTurnCompleted)
}, [streamId])
```

---

## Testing Plan

1. **Start a live room** with radio-runner host agents
2. **Join as a listener** — verify:
   - Listener count increments to 1
   - Listener appears in the listeners panel with a readable name
3. **Wait for a turn** — verify:
   - Audio plays through HTML5 `<audio>` element (check browser dev tools)
   - Speaker tile shows speaking indicator
   - Console shows `[TTS] Received audio event` and `[TTS] Injecting audio via WebRTCAudioBridge` or HTML5 fallback
4. **Toggle mute button** — verify audio mutes/unmutes
5. **Check Jam state** — verify `soundMuted` is `false` by default

## Risk Assessment

- **Fix 1 (tts:audio event):** Low risk — adding a new event emission, no existing behavior changed. Base64 encoding of MP3 audio is standard.
- **Fix 2 (isReady):** Very low risk — simple method name correction.
- **Fix 3 (listener tracking):** Low risk — improves data quality, backward compatible.
- **Fix 4 (soundMuted default):** Low risk — aligns with user expectation (unmuted by default).
- **Fix 5 (turn:completed fallback):** Low risk — additive, only triggers if audioUrl is present.
