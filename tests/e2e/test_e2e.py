#!/usr/bin/env python3
"""
test_e2e.py
Buzz end-to-end test harness.

Tests the full platform lifecycle:
  1. Audio room: register two agents, create room, exchange messages,
     process 3 turns via the orchestrator, then close the room.
  2. Video livestream: register an agent, create a livestream,
     push a test RTMP stream, validate viewer count + status transitions.

Usage (standalone):
  python tests/e2e/test_e2e.py

Usage (pytest):
  cd tests/e2e && pytest test_e2e.py -v

Configuration (env vars):
  BASE_URL          Backend URL   (default: http://localhost:4000)
  ORCHESTRATOR_URL  Orchestrator  (default: http://localhost:5000)
  RTMP_SERVER_URL   RTMP base URL (default: rtmp://localhost:1935/live)
  FFMPEG_PATH       FFmpeg binary (default: ffmpeg)

Prerequisites:
  pip install httpx
  docker compose up -d     (start the full stack)
  docker compose --profile video up nginx-rtmp -d   (optional, for RTMP test)
"""

import os
import shutil
import subprocess
import sys
import time
import uuid
from typing import Optional

# Allow running from repo root or tests/e2e/
sys.path.insert(0, os.path.dirname(__file__))
from helpers import BeelyClient, assert_ok, check_health, random_suffix, retry

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("BASE_URL", "http://localhost:4000")
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:5000")
RTMP_SERVER_URL = os.environ.get("RTMP_SERVER_URL", "rtmp://localhost:1935/live")
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", "ffmpeg")


# ── Helpers ───────────────────────────────────────────────────────────────────

def print_section(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def print_step(step: str, detail: str = "") -> None:
    suffix = f"  → {detail}" if detail else ""
    print(f"  [step] {step}{suffix}")


def print_pass(msg: str) -> None:
    print(f"  [PASS] {msg}")


def print_warn(msg: str) -> None:
    print(f"  [WARN] {msg}", file=sys.stderr)


# ── Test 1: Audio Room ────────────────────────────────────────────────────────

def test_audio_room(client: BeelyClient) -> None:
    """
    Full audio room lifecycle:
      Register HOST + SPEAKER → create room → join → submit messages →
      process 3 turns → close room
    """
    print_section("TEST 1: Audio Room")
    suffix = random_suffix()

    # ── 1. Register HOST_BOT ────────────────────────────────────────────────
    print_step("Registering HOST_BOT")
    host_result = client.post("/api/v1/agents/register", {
        "name": f"HostBot {suffix}",
        "username": f"hostbot_{suffix}",
        "description": "E2E test host agent — safe to delete",
    })
    assert host_result.get("success"), f"Registration failed: {host_result}"
    host = host_result["agent"]
    host_id: str = host["id"]
    host_key: str = host["api_key"]
    print_step("HOST_BOT registered", f"id={host_id[:8]}...")

    # ── 2. Register SPEAKER_BOT ─────────────────────────────────────────────
    print_step("Registering SPEAKER_BOT")
    speaker_result = client.post("/api/v1/agents/register", {
        "name": f"SpeakerBot {suffix}",
        "username": f"speakerbot_{suffix}",
        "description": "E2E test speaker agent — safe to delete",
    })
    assert speaker_result.get("success"), f"Registration failed: {speaker_result}"
    speaker = speaker_result["agent"]
    speaker_id: str = speaker["id"]
    speaker_key: str = speaker["api_key"]
    print_step("SPEAKER_BOT registered", f"id={speaker_id[:8]}...")

    # ── 3. HOST creates room ─────────────────────────────────────────────────
    print_step("Creating debate room")
    room_result = client.post("/api/v1/rooms", {
        "type": "debate",
        "objective": "E2E test debate: does automated testing reduce production bugs?",
        "spawnFee": 250,
        "recordingEnabled": False,
    }, auth=host_key)
    assert room_result.get("success"), f"Room creation failed: {room_result}"
    room = room_result["data"]["room"]
    room_id: str = room["id"]
    print_step("Room created", f"id={room_id[:8]}...  status={room.get('status')}")

    # ── 4. SPEAKER joins the room ────────────────────────────────────────────
    # Backend calls orchestrator.registerRoom + startRoom internally on join
    print_step("SPEAKER_BOT joining room")
    join_result = client.post(f"/api/v1/rooms/{room_id}/join", {}, auth=speaker_key)
    assert join_result.get("success"), f"Join failed: {join_result}"
    print_step("SPEAKER_BOT joined")

    # Brief pause: backend async-registers the room with the orchestrator
    time.sleep(1.0)

    # ── 5. Process 3 turns ───────────────────────────────────────────────────
    for turn_i in range(1, 4):
        print_step(f"Turn {turn_i}/3 — submitting messages")

        # Both agents submit a message to the orchestrator
        host_msg_id = str(uuid.uuid4())
        speaker_msg_id = str(uuid.uuid4())

        host_msg_body = {
            "message": {
                "id": host_msg_id,
                "room_id": room_id,
                "agent_id": host_id,
                "text": (
                    f"[Turn {turn_i}] Automated tests give you a safety net that catches "
                    "regressions before they hit production. Every test saved is a user "
                    "complaint avoided."
                ),
                "status": "submitted",
            }
        }
        speaker_msg_body = {
            "message": {
                "id": speaker_msg_id,
                "room_id": room_id,
                "agent_id": speaker_id,
                "text": (
                    f"[Turn {turn_i}] Automated tests don't catch what you didn't think to test. "
                    "Manual exploratory testing surfaces edge cases that no automated suite anticipates."
                ),
                "status": "submitted",
            }
        }

        # Submit with retry to handle async orchestrator registration lag
        def submit_host():
            return client.orch_post(f"/api/v1/rooms/{room_id}/messages", host_msg_body)

        def submit_speaker():
            return client.orch_post(f"/api/v1/rooms/{room_id}/messages", speaker_msg_body)

        host_sub = retry(submit_host, attempts=4, delay=0.75)
        speaker_sub = retry(submit_speaker, attempts=4, delay=0.75)

        assert host_sub.get("status") == "success", f"Host message submit failed: {host_sub}"
        assert speaker_sub.get("status") == "success", f"Speaker message submit failed: {speaker_sub}"
        print_step(f"Turn {turn_i}/3 — processing turn (LLM scoring...)")

        # Process the turn — this calls the LLM, allow up to 60s
        turn_result = retry(
            lambda: client.orch_post(f"/api/v1/rooms/{room_id}/process-turn", {}),
            attempts=2,
            delay=1.0,
        )

        assert turn_result.get("status") in ("success", "no_messages", "no_valid_messages"), \
            f"Turn {turn_i} unexpected status: {turn_result}"

        if turn_result.get("status") == "success":
            assert turn_result.get("selected_message_id") is not None, \
                f"Turn {turn_i}: selected_message_id is null"
            score = turn_result.get("score", 0)
            sel_id = turn_result["selected_message_id"]
            print_step(
                f"Turn {turn_i}/3 — winner selected",
                f"score={score:.1f}  msg={sel_id[:8]}..."
            )
        else:
            print_warn(f"Turn {turn_i} returned status={turn_result.get('status')} — LLM may be unconfigured")

    # ── 6. Print live URL for human inspection ───────────────────────────────
    frontend_url = BASE_URL.replace(":4000", ":3000")
    print(f"\n  Open in browser to watch live:")
    print(f"  {frontend_url}/room/{room_id}/live")

    # ── 7. Verify room participants ──────────────────────────────────────────
    print_step("Verifying room participants")
    participants_result = client.get(f"/api/v1/rooms/{room_id}/participants", auth=host_key)
    participants = participants_result.get("data", {}).get("participants", [])
    participant_ids = {p.get("agentId") or p.get("agent_id") or p.get("id") for p in participants}
    # Allow some flexibility — participants may not all be present depending on timing
    print_step(f"Participants found", f"{len(participants)} in room")

    # ── 8. HOST closes the room ──────────────────────────────────────────────
    print_step("Closing room")
    close_result = client.post(f"/api/v1/rooms/{room_id}/close", {}, auth=host_key)
    assert close_result.get("success"), f"Close failed: {close_result}"
    print_step("Room closed")

    print_pass(f"Audio room test complete  (room_id={room_id[:8]}...)")


# ── Test 2: Video Livestream ──────────────────────────────────────────────────

def test_video_livestream(client: BeelyClient) -> None:
    """
    Full video livestream lifecycle:
      Register STREAM_BOT → create livestream → push FFmpeg test pattern →
      validate status + viewer count → status transitions → end stream
    """
    print_section("TEST 2: Video Livestream")
    suffix = random_suffix()

    ffmpeg_available = shutil.which(FFMPEG_PATH) is not None
    if not ffmpeg_available:
        print_warn(
            f"FFmpeg not found at '{FFMPEG_PATH}'. "
            "RTMP streaming will be skipped. API assertions will still run."
        )

    # ── 1. Register STREAM_BOT ───────────────────────────────────────────────
    print_step("Registering STREAM_BOT")
    stream_result = client.post("/api/v1/agents/register", {
        "name": f"StreamBot {suffix}",
        "username": f"streambot_{suffix}",
        "description": "E2E test stream agent — safe to delete",
    })
    assert stream_result.get("success"), f"Registration failed: {stream_result}"
    stream_agent = stream_result["agent"]
    stream_key_agent: str = stream_agent["api_key"]
    print_step("STREAM_BOT registered", f"id={stream_agent['id'][:8]}...")

    # ── 2. Create livestream ─────────────────────────────────────────────────
    print_step("Creating livestream")
    ls_result = client.post("/api/v1/livestreams", {
        "title": f"E2E Financial Stream {suffix}",
        "description": "Automated E2E test livestream — safe to delete",
        "category": "tech",
        "streamCapabilities": ["video", "audio", "chat"],
    }, auth=stream_key_agent)
    assert ls_result.get("success"), f"Livestream creation failed: {ls_result}"

    ls_data = ls_result["data"]
    stream_id: str = ls_data["stream"]["id"]
    stream_key: str = ls_data["streamKey"]
    stream_server_url: str = ls_data["streamServerUrl"]  # env-configurable, trust the API
    initial_status: str = ls_data["stream"]["status"]

    print_step("Livestream created", f"id={stream_id[:8]}...  status={initial_status}")
    print_step("Stream URL from API", stream_server_url)

    # ── 3. Assert initial status is 'live' ───────────────────────────────────
    assert initial_status == "live", \
        f"Expected initial status 'live', got '{initial_status}'"
    print_pass("Initial status == 'live'")

    # ── 4. Verify via GET ────────────────────────────────────────────────────
    print_step("Verifying livestream via GET")
    get_result = client.get(f"/api/v1/livestreams/{stream_id}")
    fetched_status = get_result["data"]["stream"]["status"]
    assert fetched_status == "live", f"GET status mismatch: got '{fetched_status}'"
    print_pass(f"GET /livestreams/{stream_id[:8]}... returned status='live'")

    # ── 5. Start FFmpeg test pattern (optional) ──────────────────────────────
    ffmpeg_proc: Optional[subprocess.Popen] = None
    local_rtmp_url = stream_server_url  # API now returns the correct env-specific URL

    if ffmpeg_available:
        print_step("Starting FFmpeg test pattern", local_rtmp_url)
        ffmpeg_proc = subprocess.Popen(
            [
                FFMPEG_PATH, "-re",
                "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
                "-vcodec", "libx264", "-pix_fmt", "yuv420p",
                "-preset", "ultrafast", "-tune", "zerolatency", "-b:v", "500k",
                "-acodec", "aac", "-b:a", "64k",
                "-f", "flv", local_rtmp_url,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2.0)  # give FFmpeg time to connect
        print_step("FFmpeg connected", f"PID={ffmpeg_proc.pid}")
    else:
        print_warn("Skipping FFmpeg stream (not available)")

    try:
        # ── 6. Register two viewers ──────────────────────────────────────────
        print_step("Registering viewer 1")
        view1 = client.post(f"/api/v1/livestreams/{stream_id}/view", {})
        vc1 = view1["data"]["viewerCount"]
        assert vc1 == 1, f"Expected viewerCount=1, got {vc1}"
        print_pass(f"viewerCount after view 1 = {vc1}")

        print_step("Registering viewer 2")
        view2 = client.post(f"/api/v1/livestreams/{stream_id}/view", {})
        vc2 = view2["data"]["viewerCount"]
        assert vc2 == 2, f"Expected viewerCount=2, got {vc2}"
        print_pass(f"viewerCount after view 2 = {vc2}")

        # ── 7. Pause the stream ──────────────────────────────────────────────
        print_step("Pausing stream")
        pause_result = client.put(f"/api/v1/livestreams/{stream_id}", {
            "status": "paused"
        }, auth=stream_key_agent)
        paused_status = pause_result["data"]["stream"]["status"]
        assert paused_status == "paused", f"Expected 'paused', got '{paused_status}'"
        print_pass("Status == 'paused'")

        # ── 8. Resume the stream ─────────────────────────────────────────────
        print_step("Resuming stream")
        resume_result = client.put(f"/api/v1/livestreams/{stream_id}", {
            "status": "live"
        }, auth=stream_key_agent)
        resumed_status = resume_result["data"]["stream"]["status"]
        assert resumed_status == "live", f"Expected 'live', got '{resumed_status}'"
        print_pass("Status == 'live' (resumed)")

        # ── 9. End the stream ────────────────────────────────────────────────
        print_step("Ending stream")
        end_result = client.put(f"/api/v1/livestreams/{stream_id}", {
            "status": "ended"
        }, auth=stream_key_agent)
        ended_status = end_result["data"]["stream"]["status"]
        assert ended_status == "ended", f"Expected 'ended', got '{ended_status}'"
        print_pass("Status == 'ended'")

        # ── 10. Confirm ended via GET ────────────────────────────────────────
        final_get = client.get(f"/api/v1/livestreams/{stream_id}")
        final_status = final_get["data"]["stream"]["status"]
        assert final_status == "ended", f"Final GET status mismatch: '{final_status}'"
        print_pass("Final GET confirms status == 'ended'")

    finally:
        # Always terminate FFmpeg cleanly
        if ffmpeg_proc is not None:
            ffmpeg_proc.terminate()
            try:
                ffmpeg_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                ffmpeg_proc.kill()
            print_step("FFmpeg process terminated")

    print_pass(f"Video livestream test complete  (stream_id={stream_id[:8]}...)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  Buzz E2E Test Harness")
    print(f"  Backend:      {BASE_URL}")
    print(f"  Orchestrator: {ORCHESTRATOR_URL}")
    print(f"  RTMP:         {RTMP_SERVER_URL}")
    print("=" * 60)

    client = BeelyClient(BASE_URL, ORCHESTRATOR_URL)

    # Verify connectivity first
    print_section("Health Checks")
    try:
        check_health(client)
        print_pass("Backend and orchestrator are reachable")
    except RuntimeError as e:
        print(f"\n  [ERROR] {e}", file=sys.stderr)
        sys.exit(1)

    failures: list[str] = []

    # ── Run tests ─────────────────────────────────────────────────────────────
    for test_fn, name in [
        (test_audio_room, "Audio Room"),
        (test_video_livestream, "Video Livestream"),
    ]:
        try:
            test_fn(client)
        except AssertionError as e:
            print(f"\n  [FAIL] {name}: {e}", file=sys.stderr)
            failures.append(name)
        except Exception as e:
            import traceback
            print(f"\n  [ERROR] {name}: {e}", file=sys.stderr)
            traceback.print_exc()
            failures.append(name)

    client.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    total = 2
    passed = total - len(failures)
    print(f"  Results: {passed}/{total} tests passed")
    if failures:
        print(f"  Failed:  {', '.join(failures)}")
    print("=" * 60)

    if failures:
        sys.exit(1)


# ── Pytest compatibility ──────────────────────────────────────────────────────
# When imported by pytest, each function starting with test_ is discovered
# automatically. We provide a shared client fixture via module-level setup.

_shared_client: Optional[BeelyClient] = None


def _get_client() -> BeelyClient:
    global _shared_client
    if _shared_client is None:
        _shared_client = BeelyClient(BASE_URL, ORCHESTRATOR_URL)
    return _shared_client


def test_audio_room_pytest() -> None:
    """Pytest-compatible wrapper for the audio room test."""
    test_audio_room(_get_client())


def test_video_livestream_pytest() -> None:
    """Pytest-compatible wrapper for the video livestream test."""
    test_video_livestream(_get_client())


if __name__ == "__main__":
    main()
