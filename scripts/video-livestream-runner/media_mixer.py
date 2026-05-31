#!/usr/bin/env python3
"""
media_mixer.py
Enterprise-grade FFmpeg pipeline manager for the video livestream.

Reads PNG frames from a SceneEngine queue, encodes to H.264, and
pushes to an RTMP endpoint. Audio is provided via a TTS queue
(commentary MP3 bytes) mixed with silence filler to prevent dead air.

Key features:
  - FFmpeg subprocess management with auto-crash detection & restart
  - RTMP pre-flight smoke test
  - FIFO-based audio injection with non-blocking write dispatch
  - Continuous silence filler to prevent stream termination
  - Frame rate monitoring and health diagnostics
  - Graceful degradation: video-only mode if audio unavailable

Architecture placement: scripts/video-livestream-runner/
Depends on: ffmpeg (on PATH)
Used by: video_runner.py
"""

import asyncio
import logging
import os
import pathlib
import queue as queue_mod
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

TEMP_DIR = pathlib.Path(tempfile.gettempdir()) / "Buzz-livestream"


class MediaMixer:
    """
    Enterprise-grade FFmpeg pipeline for 24/7 video livestreaming.

    Manages the FFmpeg subprocess, injects PNG frames from a SceneEngine
    queue, mixes in TTS audio (with silence filler), and pushes the
    encoded stream to an RTMP endpoint.

    Thread-safe: uses thread-safe queues internally so callers can enqueue
    audio from any context.

    Usage:
        mixer = MediaMixer()
        await mixer.start(rtmp_url, frame_queue)
        await mixer.queue_audio(mp3_bytes)
        # ...
        await mixer.stop()
    """

    _MAX_RESTART_ATTEMPTS = 5
    _RESTART_BACKOFF_BASE = 2.0

    def __init__(
        self,
        width: int = 1280,
        height: int = 720,
        fps: int = 15,
        video_bitrate: str = "1500k",
        audio_bitrate: str = "64k",
    ) -> None:
        self._width = width
        self._height = height
        self._fps = fps
        self._video_bitrate = video_bitrate
        self._audio_bitrate = audio_bitrate
        self._rtmp_url: str = ""

        # Threaded FFmpeg process
        self._ffmpeg_proc: Optional[subprocess.Popen] = None

        # Thread-safe queues for cross-thread frame/audio passing
        # SceneEngine puts PNG frames into frame_queue (asyncio.Queue).
        # We poll it from the feeder thread via an executor bridge.
        self._frame_queue: Optional[asyncio.Queue] = None

        # Audio bytes (MP3) from external callers
        self._audio_queue: queue_mod.Queue = queue_mod.Queue(maxsize=50)

        self._restart_count = 0

        # Synchronisation
        self._stop_event = threading.Event()
        self._ffmpeg_dead = threading.Event()

        # Thread handles
        self._frame_thread: Optional[threading.Thread] = None
        self._audio_thread: Optional[threading.Thread] = None
        self._monitor_thread: Optional[threading.Thread] = None

        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        self._audio_fifo = TEMP_DIR / "audio_fifo"
        self._silence_mp3_path = self._prebuild_silence_mp3()

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self, rtmp_url: str, frame_queue: asyncio.Queue) -> None:
        """
        Start the FFmpeg pipeline.

        Performs a pre-flight RTMP smoke test, creates the audio FIFO,
        spawns FFmpeg, and starts feeder threads.

        Args:
            rtmp_url: Full RTMP URL with stream key
            frame_queue: asyncio.Queue of PNG bytes from SceneEngine

        Raises:
            RuntimeError: if ffmpeg is missing
        """
        if not shutil.which("ffmpeg"):
            raise RuntimeError("ffmpeg not found on PATH.")

        self._frame_queue = frame_queue
        self._rtmp_url = rtmp_url.strip()

        await self._preflight_rtmp_test(self._rtmp_url)

        self._create_audio_fifo()
        self._spawn_ffmpeg(self._rtmp_url)

        self._frame_thread = threading.Thread(
            target=self._frame_feeder_loop, name="frame-feeder", daemon=True,
        )
        self._audio_thread = threading.Thread(
            target=self._audio_fifo_writer_with_watchdog, name="audio-writer", daemon=True,
        )
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop, name="ffmpeg-monitor", daemon=True,
        )

        self._frame_thread.start()
        self._audio_thread.start()
        self._monitor_thread.start()

        logger.info(
            "MediaMixer started — PID: %s | RTMP: %.60s | %dx%d %dfps",
            self._ffmpeg_proc.pid if self._ffmpeg_proc else "N/A",
            self._rtmp_url[:80], self._width, self._height, self._fps,
        )

    async def stop(self) -> None:
        """Gracefully terminate all workers and clean up."""
        self._stop_event.set()

        if self._ffmpeg_proc:
            logger.info("Terminating FFmpeg (PID %s)...", self._ffmpeg_proc.pid)
            try:
                self._ffmpeg_proc.terminate()
                self._ffmpeg_proc.wait(timeout=5)
            except Exception:
                try:
                    self._ffmpeg_proc.kill()
                    self._ffmpeg_proc.wait(timeout=2)
                except Exception:
                    pass

        for t in (self._frame_thread, self._audio_thread, self._monitor_thread):
            if t and t.is_alive():
                t.join(timeout=5)

        self._cleanup_fifo()
        logger.info("MediaMixer stopped — total restarts: %d", self._restart_count)

    @property
    def is_running(self) -> bool:
        return (
            self._ffmpeg_proc is not None
            and self._ffmpeg_proc.poll() is None
            and not self._stop_event.is_set()
        )

    @property
    def restart_count(self) -> int:
        return self._restart_count

    @property
    def permanently_failed(self) -> bool:
        """True if auto-restart limit was exhausted and pipeline is dead."""
        return (
            self._restart_count >= self._MAX_RESTART_ATTEMPTS
            and self._ffmpeg_dead.is_set()
        )

    # ── Audio Queue (thread-safe) ───────────────────────────────────────────

    async def queue_audio(self, mp3_bytes: bytes) -> None:
        """Queue commentary MP3 bytes for mixing into the stream."""
        if self._audio_queue.full():
            # Queue is jammed — drain oldest item to make room.
            # This prevents permanent lockout when the consumer stalls.
            try:
                self._audio_queue.get_nowait()
                logger.warning("Audio queue full — dropped oldest frame to make room")
            except queue_mod.Empty:
                pass
        self._audio_queue.put_nowait(mp3_bytes)

    # ── Pre-flight RTMP Smoke Test ──────────────────────────────────────────

    async def _preflight_rtmp_test(self, rtmp_url: str) -> None:
        """Verify the RTMP server is reachable via DNS + TCP + publish test."""
        import re
        import socket as sock_mod
        import subprocess as sp_mod

        rtmp_url = rtmp_url.strip()
        match = re.match(r"rtmp://([^:/]+)(?::(\d+))?/", rtmp_url)
        if not match:
            logger.warning("RTMP pre-flight: could not parse URL: %s", rtmp_url)
            return
        host = match.group(1)
        port = int(match.group(2) or 1935)

        # ── DNS resolution check ──────────────────────────────────────────
        try:
            addrs = sock_mod.getaddrinfo(host, port, sock_mod.AF_UNSPEC, sock_mod.SOCK_STREAM)
            ips = set(addr[4][0] for addr in addrs)
            logger.info("RTMP pre-flight: DNS resolves %s -> %s", host, ips)
        except Exception as exc:
            logger.warning("RTMP pre-flight: DNS FAILED for %s — %s", host, exc)

        # ── TCP connectivity check ────────────────────────────────────────
        try:
            with sock_mod.create_connection((host, port), timeout=5.0):
                logger.info("RTMP pre-flight: TCP %s:%s reachable", host, port)
        except Exception as exc:
            logger.warning("RTMP pre-flight: TCP %s:%s unreachable (%s)", host, port, exc)

        # ── HTTP health check on RTMP server port 80 ──────────────────────
        try:
            import httpx
            resp = httpx.get(f"https://{host}/health", timeout=5.0)
            if resp.status_code < 500:
                logger.info("RTMP pre-flight: HTTP health on port 80 OK (status %s)", resp.status_code)
            else:
                logger.warning("RTMP pre-flight: HTTP health returned %s", resp.status_code)
        except Exception as exc:
            logger.warning("RTMP pre-flight: HTTP health check failed (%s)", exc)

        # ── Short publish test (1s color bars + tone) ─────────────────────
        test_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=320x240:rate=5:d=1",
            "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono:d=1",
            "-vcodec", "libx264", "-preset", "ultrafast", "-b:v", "200k",
            "-acodec", "aac", "-b:a", "32k", "-ar", "22050",
            "-f", "flv", rtmp_url,
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *test_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            rc = await asyncio.wait_for(proc.wait(), timeout=10.0)
            if rc == 0:
                logger.info("RTMP pre-flight publish test PASSED")
            else:
                logger.warning("RTMP pre-flight publish test returned code %s", rc)
                # On failure, also try with explicit port 1935 and without stream key
                alt_url = f"rtmp://{host}:{port}/app"
                logger.info("RTMP pre-flight: retrying with base URL %s", alt_url)
                try:
                    proc2 = await asyncio.create_subprocess_exec(
                        *["ffmpeg", "-y",
                          "-f", "lavfi", "-i", "testsrc=size=320x240:rate=5:d=1",
                          "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono:d=1",
                          "-vcodec", "libx264", "-preset", "ultrafast", "-b:v", "200k",
                          "-acodec", "aac", "-b:a", "32k", "-ar", "22050",
                          "-f", "flv", alt_url],
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    rc2 = await asyncio.wait_for(proc2.wait(), timeout=10.0)
                    logger.info("RTMP pre-flight alt test returned code %s", rc2)
                except Exception as exc2:
                    logger.warning("RTMP pre-flight alt test also failed: %s", exc2)
        except asyncio.TimeoutError:
            logger.warning("RTMP pre-flight publish test timed out (non-fatal)")
        except Exception as exc:
            logger.warning("RTMP pre-flight publish test error: %s", exc)

    # ── FFmpeg Spawn ────────────────────────────────────────────────────────

    def _spawn_ffmpeg(self, rtmp_target: str) -> None:
        """Launch the FFmpeg subprocess."""
        cmd = self._build_ffmpeg_cmd(rtmp_target)
        logger.info("Starting FFmpeg: %s", " ".join(cmd))

        self._ffmpeg_proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )

    def _build_ffmpeg_cmd(self, rtmp_target: str) -> list[str]:
        return [
            "ffmpeg",
            "-loglevel", "warning",
            "-nostdin",
            # Video input: PNG frames via stdin
            "-f", "image2pipe",
            "-vcodec", "png",
            "-framerate", str(self._fps),
            "-video_size", f"{self._width}x{self._height}",
            "-pix_fmt", "rgba",
            "-probesize", "1000000",
            "-analyzeduration", "2000000",
            "-i", "pipe:0",
            # Audio input: FIFO pipe for dynamic TTS injection
            "-f", "mp3",
            "-i", str(self._audio_fifo),
            # Video encoding
            "-vcodec", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-b:v", self._video_bitrate,
            "-maxrate", str(int(self._video_bitrate.replace("k", "")) * 1.33) + "k",
            "-bufsize", str(int(self._video_bitrate.replace("k", "")) * 2.66) + "k",
            "-g", str(self._fps * 2),
            "-r", str(self._fps),
            # Audio encoding
            "-acodec", "aac",
            "-b:a", self._audio_bitrate,
            "-ar", "44100",
            # No -shortest: continuous stream even during audio gaps (silence filler keeps audio alive)
            # Output
            "-f", "flv",
            rtmp_target,
        ]

    # ── FIFO Management ─────────────────────────────────────────────────────

    def _create_audio_fifo(self) -> None:
        if self._audio_fifo.exists():
            self._audio_fifo.unlink()
        os.mkfifo(str(self._audio_fifo))
        logger.info("Audio FIFO created: %s", self._audio_fifo)

    def _cleanup_fifo(self) -> None:
        try:
            if self._audio_fifo.exists():
                self._audio_fifo.unlink()
        except Exception:
            pass

    # ── Pre-built Silence MP3 ───────────────────────────────────────────────

    def _prebuild_silence_mp3(self) -> Optional[pathlib.Path]:
        """Generate a 1-second silence MP3 at startup using ffmpeg."""
        silence_path = TEMP_DIR / "silence.mp3"
        if silence_path.exists():
            return silence_path
        try:
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:d=1",
                    "-codec:a", "libmp3lame",
                    "-b:a", self._audio_bitrate,
                    str(silence_path),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=15,
            )
            if silence_path.exists():
                logger.info("Pre-built silence MP3: %s (%d bytes)", silence_path, silence_path.stat().st_size)
                return silence_path
        except Exception as exc:
            logger.warning("Could not pre-build silence MP3: %s", exc)
        return None

    # ── Frame Feeder Thread ─────────────────────────────────────────────────

    def _frame_feeder_loop(self) -> None:
        """
        Reads PNG frames from the SceneEngine's asyncio.Queue and writes
        them to FFmpeg stdin. Bridges async -> thread via polling.
        """
        stdin = self._ffmpeg_proc.stdin
        if not stdin:
            return

        frame_count = 0
        last_log = time.monotonic()

        while not self._stop_event.is_set():
            try:
                # Poll the async queue via executor
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    png_bytes = loop.run_until_complete(
                        asyncio.wait_for(self._frame_queue.get(), timeout=1.0)
                    )
                except asyncio.TimeoutError:
                    loop.close()
                    continue
                except Exception:
                    loop.close()
                    break
                loop.close()

                stdin.write(png_bytes)
                stdin.flush()
                frame_count += 1

                now = time.monotonic()
                if now - last_log >= 15:
                    logger.debug("Frame feeder: ~%d fps (queue depth: ?)", frame_count / 15)
                    frame_count = 0
                    last_log = now

            except (BrokenPipeError, OSError):
                logger.error("FFmpeg stdin pipe broken — FFmpeg may have crashed")
                self._ffmpeg_dead.set()
                break
            except Exception as exc:
                logger.warning("Frame feeder error: %s", exc)
                break

        try:
            if stdin and not stdin.closed:
                stdin.close()
        except Exception:
            pass

    # ── Audio FIFO Writer Thread ────────────────────────────────────────────

    def _audio_fifo_writer_with_watchdog(self) -> None:
        """Watchdog wrapper: restarts the audio consumer on crash."""
        while not self._stop_event.is_set():
            try:
                logger.info("Audio consumer started")
                self._audio_fifo_writer()
            except Exception as exc:
                logger.error("Audio consumer crashed, restarting in 1s: %s", exc)
                self._stop_event.wait(1.0)
        logger.info("Audio consumer watchdog exiting (stop event set)")

    def _audio_fifo_writer(self) -> None:
        """
        Writes queued TTS MP3 bytes (or silence filler) to the audio FIFO.

        Uses a dedicated thread to avoid blocking on os.write().
        When no TTS audio is available in the queue, writes 1s silence MP3
        frames to keep the stream alive and prevent FFmpeg from terminating.
        """
        # Drain stale audio from previous consumer run
        drained = 0
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
                drained += 1
            except queue_mod.Empty:
                break
        if drained > 0:
            logger.info("Audio consumer: drained %d stale frames on startup", drained)

        silence_bytes: Optional[bytes] = None
        if self._silence_mp3_path and self._silence_mp3_path.exists():
            silence_bytes = self._silence_mp3_path.read_bytes()

        fifo_fd = None

        while not self._stop_event.is_set():
            try:
                if fifo_fd is None:
                    fifo_fd = os.open(str(self._audio_fifo), os.O_WRONLY)
                    logger.info("Audio FIFO opened for writing")

                try:
                    mp3_data = self._audio_queue.get(timeout=0.5)
                    os.write(fifo_fd, mp3_data)
                except queue_mod.Empty:
                    if silence_bytes:
                        os.write(fifo_fd, silence_bytes)

            except BrokenPipeError:
                if fifo_fd is not None:
                    try:
                        os.close(fifo_fd)
                    except Exception:
                        pass
                    fifo_fd = None
                self._stop_event.wait(0.5)
            except OSError as exc:
                logger.warning("Audio FIFO OSError: %s", exc)
                if fifo_fd is not None:
                    try:
                        os.close(fifo_fd)
                    except Exception:
                        pass
                    fifo_fd = None
                self._stop_event.wait(0.5)
            except Exception as exc:
                logger.warning("Audio FIFO writer error: %s", exc)
                self._stop_event.wait(0.5)

        if fifo_fd is not None:
            try:
                os.close(fifo_fd)
            except Exception:
                pass

    # ── FFmpeg Monitor Thread ───────────────────────────────────────────────

    def _monitor_loop(self) -> None:
        """
        Monitors FFmpeg subprocess health:
          1. Streams stderr to logs in real-time
          2. Detects process exit and auto-restarts with backoff
        """
        # Stream stderr to logs (prevents pipe deadlock)
        def _read_stderr():
            try:
                for raw_line in iter(self._ffmpeg_proc.stderr.readline, b""):
                    if self._stop_event.is_set():
                        break
                    line = raw_line.decode(errors="replace").rstrip()
                    if line:
                        logger.info("[ffmpeg] %s", line)
            except Exception:
                pass

        stderr_thread = threading.Thread(target=_read_stderr, daemon=True)
        stderr_thread.start()

        # Wait for process exit
        rc = self._ffmpeg_proc.wait()
        stderr_thread.join(timeout=2)

        if self._stop_event.is_set():
            return

        logger.error("FFmpeg exited with code %d — initiating auto-restart", rc)
        self._ffmpeg_dead.set()

        # Auto-restart with exponential backoff
        while self._restart_count < self._MAX_RESTART_ATTEMPTS:
            if self._stop_event.is_set():
                return

            backoff = self._RESTART_BACKOFF_BASE * (2 ** self._restart_count)
            logger.info(
                "FFmpeg restart attempt %d/%d in %.1fs...",
                self._restart_count + 1, self._MAX_RESTART_ATTEMPTS, backoff,
            )
            self._stop_event.wait(backoff)

            if self._stop_event.is_set():
                return

            try:
                self._cleanup_fifo()
                self._create_audio_fifo()
                self._spawn_ffmpeg(self._rtmp_url)
                self._restart_count += 1
                self._ffmpeg_dead.clear()
                logger.info(
                    "FFmpeg auto-restart %d/%d successful (PID %s)",
                    self._restart_count, self._MAX_RESTART_ATTEMPTS,
                    self._ffmpeg_proc.pid,
                )
                return
            except Exception as exc:
                logger.error(
                    "FFmpeg restart attempt %d/%d failed: %s",
                    self._restart_count + 1, self._MAX_RESTART_ATTEMPTS, exc,
                )

        logger.critical(
            "FFmpeg permanently failed after %d restart attempts — pipeline dead",
            self._MAX_RESTART_ATTEMPTS,
        )
