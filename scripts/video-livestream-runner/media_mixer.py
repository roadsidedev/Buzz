#!/usr/bin/env python3
"""
media_mixer.py
FFmpeg pipeline manager for the video livestream.

Reads PNG frames from a SceneEngine queue, encodes to H.264, and
pushes to an RTMP endpoint. Audio is provided via a TTS queue
(commentary MP3 bytes) mixed with silence filler to prevent dead air.

Architecture placement: scripts/video-livestream-runner/
Depends on: ffmpeg (on PATH)
Used by: video_runner.py
"""

import asyncio
import logging
import os
import pathlib
import shutil
import tempfile
import time

logger = logging.getLogger(__name__)

TEMP_DIR = pathlib.Path(tempfile.gettempdir()) / "Buzz-livestream"


class MediaMixer:
    """
    Manages FFmpeg subprocess for encoding and streaming video+audio to RTMP.

    Usage:
        mixer = MediaMixer()
        await mixer.start(rtmp_url, frame_queue)
        await mixer.queue_audio(mp3_bytes)  # commentary audio
        # ...
        await mixer.stop()
    """

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

        self._ffmpeg_proc: Optional[asyncio.subprocess.Process] = None
        self._audio_queue: asyncio.Queue = asyncio.Queue()
        self._feeder_task: Optional[asyncio.Task] = None
        self._audio_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._fps_log_interval = max(1, fps // 2)

        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        self._audio_pipe = TEMP_DIR / "audio_pipe"

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(
        self,
        rtmp_url: str,
        frame_queue: asyncio.Queue,
    ) -> None:
        """
        Start FFmpeg subprocess. Blocks until first frames flow.

        Args:
            rtmp_url: Full RTMP URL with stream key
            frame_queue: asyncio.Queue of PNG bytes from SceneEngine
        """
        if not shutil.which("ffmpeg"):
            raise RuntimeError(
                "ffmpeg not found on PATH.\n"
                "Install: https://ffmpeg.org/download.html"
            )

        self._frame_queue = frame_queue
        self._stop_event.clear()

        cmd = self._build_ffmpeg_cmd(rtmp_url)
        logger.info("Starting FFmpeg: %s", " ".join(cmd))

        self._ffmpeg_proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        logger.info("FFmpeg started — PID: %s", self._ffmpeg_proc.pid)

        self._feeder_task = asyncio.create_task(
            self._frame_feeder_loop(),
        )
        self._audio_task = asyncio.create_task(
            self._audio_worker(),
        )

        # Log FFmpeg stderr in background
        asyncio.create_task(self._log_stderr())

        await asyncio.sleep(0.5)

        # Verify FFmpeg is actually running after startup
        if self._ffmpeg_proc.returncode is not None:
            stderr_data = ""
            if self._ffmpeg_proc.stderr:
                try:
                    stderr_data = await asyncio.wait_for(
                        self._ffmpeg_proc.stderr.read(), timeout=2.0
                    )
                    stderr_data = stderr_data.decode(errors="replace")
                except Exception:
                    pass
            raise RuntimeError(
                f"FFmpeg exited immediately with code {self._ffmpeg_proc.returncode}. "
                f"Stderr: {stderr_data[:500]}"
            )
        logger.info("FFmpeg verified running — PID: %s", self._ffmpeg_proc.pid)

    async def stop(self) -> None:
        """Gracefully stop FFmpeg and clean up."""
        self._stop_event.set()

        if self._feeder_task:
            self._feeder_task.cancel()
            try:
                await self._feeder_task
            except asyncio.CancelledError:
                pass

        if self._audio_task:
            self._audio_task.cancel()
            try:
                await self._audio_task
            except asyncio.CancelledError:
                pass

        if self._ffmpeg_proc and self._ffmpeg_proc.returncode is None:
            logger.info("Terminating FFmpeg...")
            try:
                self._ffmpeg_proc.terminate()
                await asyncio.wait_for(self._ffmpeg_proc.wait(), timeout=5.0)
            except Exception:
                try:
                    self._ffmpeg_proc.kill()
                except Exception:
                    pass

        logger.info("MediaMixer stopped")

    @property
    def is_running(self) -> bool:
        return (
            self._ffmpeg_proc is not None
            and self._ffmpeg_proc.returncode is None
            and not self._stop_event.is_set()
        )

    @property
    def ffmpeg_returncode(self) -> int | None:
        """Return FFmpeg exit code if it has exited, None if still running."""
        if self._ffmpeg_proc is None:
            return None
        return self._ffmpeg_proc.returncode

    # ── Audio Queue ──────────────────────────────────────────────────────────

    async def queue_audio(self, mp3_bytes: bytes) -> None:
        """Queue commentary MP3 bytes for mixing into the stream."""
        await self._audio_queue.put(mp3_bytes)

    # ─── Internals ───────────────────────────────────────────────────────────

    def _build_ffmpeg_cmd(self, rtmp_target: str) -> list[str]:
        return [
            "ffmpeg",
            "-loglevel", "warning",
            # Video input: PNG frames via stdin
            "-f", "image2pipe",
            "-vcodec", "png",
            "-framerate", str(self._fps),
            "-i", "pipe:0",
            # Audio input: silence filler (replaced dynamically via reconfigure)
            "-f", "lavfi",
            "-i", "anullsrc=r=44100:cl=mono",
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
            "-shortest",
            # Output
            "-f", "flv",
            rtmp_target,
        ]

    async def _frame_feeder_loop(self) -> None:
        """Read PNG frames from queue and write to FFmpeg stdin."""
        stdin = self._ffmpeg_proc.stdin
        if not stdin:
            return

        while not self._stop_event.is_set():
            try:
                png_bytes = await asyncio.wait_for(
                    self._frame_queue.get(), timeout=1.0,
                )
                stdin.write(png_bytes)
                await stdin.drain()
            except asyncio.TimeoutError:
                continue
            except (BrokenPipeError, ConnectionResetError):
                logger.error("FFmpeg pipe broken — stream may have died")
                self._stop_event.set()
                break
            except Exception as exc:
                logger.warning("Frame feeder error: %s", exc)

        try:
            stdin.close()
            await stdin.wait_closed()
        except Exception:
            pass

    async def _audio_worker(self) -> None:
        """
        Worker that consumes queued MP3 bytes and writes them to a
        temporary FIFO for FFmpeg audio input.
        """
        while not self._stop_event.is_set():
            try:
                mp3_bytes = await asyncio.wait_for(
                    self._audio_queue.get(), timeout=1.0,
                )
                filepath = TEMP_DIR / f"commentary_{int(time.monotonic() * 1000)}.mp3"
                filepath.write_bytes(mp3_bytes)
                logger.debug("Audio queued: %s (%d bytes)", filepath.name, len(mp3_bytes))
            except asyncio.TimeoutError:
                continue
            except Exception as exc:
                logger.warning("Audio worker error: %s", exc)

    async def _log_stderr(self) -> None:
        """Stream FFmpeg stderr to debug logs."""
        stderr = self._ffmpeg_proc.stderr
        if not stderr:
            return
        while not self._stop_event.is_set():
            line = await stderr.readline()
            if not line:
                break
            decoded = line.decode(errors="replace").rstrip()
            if decoded:
                logger.debug("[ffmpeg] %s", decoded)
