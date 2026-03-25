#!/usr/bin/env python3
"""
run_financial_stream.py
Stream the ClawZz financial dashboard as a live video to an RTMP endpoint.

Architecture:
  1. Playwright (headless Chromium) opens dashboard/index.html at 1280x720
  2. Screenshots taken at ~30fps and pushed into an asyncio.Queue as PNG bytes
  3. FFmpeg subprocess reads the PNG frames from stdin via image2pipe,
     encodes to H.264, and pushes to the RTMP URL

Prerequisites:
  pip install -r requirements.txt
  playwright install chromium
  ffmpeg installed and on PATH

Usage:
  python run_financial_stream.py --stream-key abc123
  python run_financial_stream.py --stream-key abc123 --rtmp-url rtmp://live.clawzz.app/app

Monitor stream:
  http://localhost:8080/stat   (nginx-rtmp stats page)
"""

import argparse
import asyncio
import os
import pathlib
import shutil
import signal
import subprocess
import sys
import time


DASHBOARD_PATH = pathlib.Path(__file__).parent / "dashboard" / "index.html"
FRAME_QUEUE_MAX = 10  # cap the queue to avoid memory runaway


def check_prerequisites() -> None:
    """Exit early with a clear message if required tools are missing."""
    if not shutil.which("ffmpeg"):
        print(
            "ERROR: ffmpeg not found on PATH.\n"
            "Install: https://ffmpeg.org/download.html\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: https://www.gyan.dev/ffmpeg/builds/",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        from playwright.async_api import async_playwright  # noqa: F401
    except ImportError:
        print(
            "ERROR: playwright not installed.\n"
            "Run: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(1)

    if not DASHBOARD_PATH.exists():
        print(
            f"ERROR: Dashboard not found at {DASHBOARD_PATH}\n"
            "Make sure dashboard/index.html exists next to this script.",
            file=sys.stderr,
        )
        sys.exit(1)


def build_ffmpeg_cmd(rtmp_target: str, fps: int, width: int, height: int) -> list[str]:
    """Build the FFmpeg command that reads PNG frames from stdin and pushes to RTMP."""
    return [
        "ffmpeg",
        "-loglevel", "warning",
        # Video input: PNG frames piped via stdin
        "-f", "image2pipe",
        "-vcodec", "png",
        "-framerate", str(fps),
        "-i", "pipe:0",
        # Audio input: low-level hum as a silent placeholder
        # (swap this for a real audio source or the narrator_agent.py output)
        "-f", "lavfi",
        "-i", f"sine=frequency=60:sample_rate=44100",
        # Video encoding
        "-vcodec", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-b:v", "2000k",
        "-maxrate", "2500k",
        "-bufsize", "5000k",
        "-g", str(fps * 2),  # keyframe every 2 seconds
        "-r", str(fps),
        # Audio encoding
        "-acodec", "aac",
        "-b:a", "64k",
        "-ar", "44100",
        # Output
        "-f", "flv",
        rtmp_target,
    ]


async def capture_frames(
    queue: asyncio.Queue,
    width: int,
    height: int,
    fps: int,
    stop_event: asyncio.Event,
) -> None:
    """Playwright loop: open dashboard, screenshot at fps rate, push PNGs to queue."""
    from playwright.async_api import async_playwright

    frame_interval = 1.0 / fps

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
        )
        page = await context.new_page()

        # Load the local dashboard HTML
        url = DASHBOARD_PATH.as_uri()
        print(f"[capture] Loading {url}")
        await page.goto(url, wait_until="networkidle", timeout=15000)
        print(f"[capture] Dashboard loaded. Starting {fps}fps capture at {width}x{height}.")

        frame_count = 0
        last_stat_time = time.monotonic()

        while not stop_event.is_set():
            t0 = time.monotonic()

            png_bytes = await page.screenshot(
                type="png",
                clip={"x": 0, "y": 0, "width": width, "height": height},
            )

            # Drop frames rather than block if FFmpeg is slow
            if not queue.full():
                await queue.put(png_bytes)
            frame_count += 1

            # Log stats every 10 seconds
            now = time.monotonic()
            if now - last_stat_time >= 10:
                print(f"[capture] {frame_count} frames captured  |  queue: {queue.qsize()}/{FRAME_QUEUE_MAX}")
                frame_count = 0
                last_stat_time = now

            elapsed = time.monotonic() - t0
            sleep_for = max(0.0, frame_interval - elapsed)
            await asyncio.sleep(sleep_for)

        print("[capture] Stopping Playwright.")
        await browser.close()


async def feed_ffmpeg(
    queue: asyncio.Queue,
    ffmpeg_stdin,
    stop_event: asyncio.Event,
) -> None:
    """Read PNG frames from the queue and write to FFmpeg stdin."""
    while not stop_event.is_set():
        try:
            png_bytes = await asyncio.wait_for(queue.get(), timeout=1.0)
            ffmpeg_stdin.write(png_bytes)
            await ffmpeg_stdin.drain()
        except asyncio.TimeoutError:
            continue
        except (BrokenPipeError, ConnectionResetError):
            print("[feeder] FFmpeg pipe closed unexpectedly.", file=sys.stderr)
            stop_event.set()
            break

    print("[feeder] Closing FFmpeg stdin.")
    try:
        ffmpeg_stdin.close()
        await ffmpeg_stdin.wait_closed()
    except Exception:
        pass


async def run(args: argparse.Namespace) -> None:
    rtmp_target = f"{args.rtmp_url.rstrip('/')}/{args.stream_key}"
    cmd = build_ffmpeg_cmd(rtmp_target, args.fps, args.width, args.height)

    print(f"[stream] Starting financial stream")
    print(f"[stream] RTMP target : {rtmp_target}")
    print(f"[stream] Resolution  : {args.width}x{args.height} @ {args.fps}fps")
    print(f"[stream] Press Ctrl-C to stop.")
    print()

    stop_event = asyncio.Event()
    frame_queue: asyncio.Queue = asyncio.Queue(maxsize=FRAME_QUEUE_MAX)

    # Spawn FFmpeg as an async subprocess
    ffmpeg_proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    print(f"[stream] FFmpeg PID: {ffmpeg_proc.pid}")

    # Handle Ctrl-C gracefully
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop_event.set)
        except (NotImplementedError, OSError):
            # Windows doesn't support add_signal_handler for all signals
            pass

    async def log_ffmpeg_stderr():
        """Stream FFmpeg stderr to console so we can see connection errors."""
        while not stop_event.is_set():
            line = await ffmpeg_proc.stderr.readline()
            if not line:
                break
            decoded = line.decode(errors="replace").rstrip()
            if decoded:
                print(f"[ffmpeg] {decoded}")

    try:
        await asyncio.gather(
            capture_frames(frame_queue, args.width, args.height, args.fps, stop_event),
            feed_ffmpeg(frame_queue, ffmpeg_proc.stdin, stop_event),
            log_ffmpeg_stderr(),
        )
    except Exception as e:
        print(f"[stream] Error: {e}", file=sys.stderr)
    finally:
        stop_event.set()
        print("[stream] Terminating FFmpeg...")
        try:
            ffmpeg_proc.terminate()
            await asyncio.wait_for(ffmpeg_proc.wait(), timeout=5.0)
        except Exception:
            try:
                ffmpeg_proc.kill()
            except Exception:
                pass
        print("[stream] Stream ended.")


def main() -> None:
    check_prerequisites()

    parser = argparse.ArgumentParser(
        description="Stream the ClawZz financial dashboard to RTMP via FFmpeg"
    )
    parser.add_argument(
        "--stream-key",
        required=True,
        help="RTMP stream key (e.g. the streamKey returned by POST /livestreams)",
    )
    parser.add_argument(
        "--rtmp-url",
        default=os.environ.get("RTMP_SERVER_URL", "rtmp://localhost:1935/live"),
        help="RTMP base URL (default: $RTMP_SERVER_URL or rtmp://localhost:1935/live)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=30,
        help="Capture framerate (default: 30)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1280,
        help="Stream width in pixels (default: 1280)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=720,
        help="Stream height in pixels (default: 720)",
    )
    args = parser.parse_args()

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
