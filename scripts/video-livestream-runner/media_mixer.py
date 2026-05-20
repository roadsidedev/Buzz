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
import stat
import tempfile
import time
from typing import Optional

logger = logging.getLogger(__name__)

TEMP_DIR = pathlib.Path(tempfile.gettempdir()) / "Buzz-livestream"


class MediaMixer:
    """
    Manages FFmpeg subprocess for encoding and streaming video+audio to RTMP.

    Uses a FIFO (named pipe) for dynamic audio injection:
    - TTS audio bytes are written to the FIFO
    - FFmpeg reads from the FIFO continuously
    - When no audio is available, FFmpeg gets silence (EOF on FIFO)
    - A silence generator runs in parallel to fill gaps

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
        self._fifo_writer_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._fps_log_interval = max(1, fps // 2)

        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        self._audio_fifo = TEMP_DIR / "audio_fifo"

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

        # Create FIFO for audio input
        self._create_audio_fifo()

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
            self._audio_fifo_writer(),
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

        if self._fifo_writer_task:
            self._fifo_writer_task.cancel()
            try:
                await self._fifo_writer_task
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

        # Clean up FIFO
        self._cleanup_fifo()

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

    def _create_audio_fifo(self) -> None:
        """Create a named pipe (FIFO) for audio input."""
        if self._audio_fifo.exists():
            self._audio_fifo.unlink()
        os.mkfifo(str(self._audio_fifo))
        logger.info("Created audio FIFO: %s", self._audio_fifo)

    def _cleanup_fifo(self) -> None:
        """Remove the audio FIFO."""
        try:
            if self._audio_fifo.exists():
                self._audio_fifo.unlink()
                logger.info("Cleaned up audio FIFO: %s", self._audio_fifo)
        except Exception as exc:
            logger.warning("Failed to cleanup FIFO: %s", exc)

    def _build_ffmpeg_cmd(self, rtmp_target: str) -> list[str]:
        # Use FIFO for audio input — FFmpeg will block on open until a writer connects
        # The _audio_fifo_writer task opens the FIFO for writing, unblocking FFmpeg
        return [
            "ffmpeg",
            "-loglevel", "warning",
            # Video input: PNG frames via stdin
            "-f", "image2pipe",
            "-vcodec", "png",
            "-framerate", str(self._fps),
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

    async def _audio_fifo_writer(self) -> None:
        """
        Worker that consumes queued MP3 bytes and writes them to the
        audio FIFO for FFmpeg to read.

        When no audio is queued, writes silence frames to keep the stream alive.
        This prevents FFmpeg from blocking indefinitely on the FIFO.
        """
        # Generate 1 second of silence at 44100 Hz, mono, 16-bit PCM
        # This is used as filler when no TTS audio is available
        silence_duration_s = 1.0
        sample_rate = 44100
        num_samples = int(sample_rate * silence_duration_s)
        # 16-bit mono silence = 2 bytes per sample
        silence_bytes = b"\x00" * (num_samples * 2)

        # Convert silence to MP3 using a minimal approach
        # We'll use raw PCM silence wrapped in a minimal MP3 frame
        # For simplicity, we generate a silent MP3 using ffmpeg subprocess
        silence_mp3_path = TEMP_DIR / "silence.mp3"
        if not silence_mp3_path.exists():
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg",
                    "-f", "lavfi",
                    "-i", f"anullsrc=r={sample_rate}:cl=mono:d={silence_duration_s}",
                    "-codec:a", "libmp3lame",
                    "-b:a", self._audio_bitrate,
                    "-y",
                    str(silence_mp3_path),
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await proc.wait()
            except Exception as exc:
                logger.warning("Failed to pre-generate silence MP3: %s", exc)
                # Fallback: use raw silence bytes (will cause FFmpeg warnings but won't crash)
                silence_mp3_path = None

        silence_mp3_bytes = None
        if silence_mp3_path and silence_mp3_path.exists():
            silence_mp3_bytes = silence_mp3_path.read_bytes()
            logger.info("Pre-generated silence MP3: %d bytes", len(silence_mp3_bytes))

        fifo_fd = None
        try:
            while not self._stop_event.is_set():
                try:
                    # Open FIFO for writing (this will block until FFmpeg opens it for reading)
                    if fifo_fd is None:
                        logger.info("Opening audio FIFO for writing...")
                        fifo_fd = os.open(str(self._audio_fifo), os.O_WRONLY)
                        logger.info("Audio FIFO opened")

                    # Try to get audio from queue with a short timeout
                    try:
                        mp3_bytes = await asyncio.wait_for(
                            self._audio_queue.get(), timeout=0.5,
                        )
                        # Write TTS audio to FIFO
                        os.write(fifo_fd, mp3_bytes)
                        logger.debug("Wrote TTS audio to FIFO: %d bytes", len(mp3_bytes))
                    except asyncio.TimeoutError:
                        # No audio available — write silence to keep stream alive
                        if silence_mp3_bytes:
                            os.write(fifo_fd, silence_mp3_bytes)
                        else:
                            # Minimal MP3 silence frame (just enough to keep FFmpeg happy)
                            # This is a minimal valid MP3 frame with silence
                            os.write(fifo_fd, b"\xff\xfb\x90\x00" + b"\x00" * 100)

                except OSError as exc:
                    # FIFO reader (FFmpeg) closed — will reopen on next iteration
                    logger.warning("FIFO writer error (reader closed?): %s", exc)
                    if fifo_fd is not None:
                        try:
                            os.close(fifo_fd)
                        except Exception:
                            pass
                        fifo_fd = None
                    await asyncio.sleep(0.5)
                except Exception as exc:
                    logger.warning("Audio FIFO writer error: %s", exc)
                    if fifo_fd is not None:
                        try:
                            os.close(fifo_fd)
                        except Exception:
                            pass
                        fifo_fd = None
        finally:
            if fifo_fd is not None:
                try:
                    os.close(fifo_fd)
                except Exception:
                    pass

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
