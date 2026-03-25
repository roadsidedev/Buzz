#!/usr/bin/env python3
"""
ffmpeg_test_pattern.py
Stream SMPTE color bars + 440Hz tone to an RTMP endpoint.

Use this to smoke-test that:
  1. The nginx-rtmp container is running
  2. FFmpeg can connect and push a stream
  3. The ClawZz livestream API accepts the stream key

Prerequisites:
  - ffmpeg installed and on PATH (https://ffmpeg.org/download.html)
  - nginx-rtmp running: docker compose --profile video up nginx-rtmp -d

Usage:
  python ffmpeg_test_pattern.py --stream-key test123
  python ffmpeg_test_pattern.py --stream-key test123 --rtmp-url rtmp://live.clawzz.app/app

Verify stream is live:
  curl http://localhost:8080/stat   # should show active stream
"""

import argparse
import os
import shutil
import subprocess
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stream SMPTE test pattern + tone to RTMP"
    )
    parser.add_argument(
        "--stream-key",
        default="test",
        help="RTMP stream key (default: test)",
    )
    parser.add_argument(
        "--rtmp-url",
        default=os.environ.get("RTMP_SERVER_URL", "rtmp://localhost:1935/live"),
        help="RTMP base URL (default: rtmp://localhost:1935/live or $RTMP_SERVER_URL)",
    )
    parser.add_argument(
        "--bitrate",
        default="1000k",
        help="Video bitrate (default: 1000k)",
    )
    args = parser.parse_args()

    # Check FFmpeg is available
    if not shutil.which("ffmpeg"):
        print(
            "ERROR: ffmpeg not found on PATH.\n"
            "Install FFmpeg: https://ffmpeg.org/download.html\n"
            "  macOS:  brew install ffmpeg\n"
            "  Ubuntu: sudo apt install ffmpeg\n"
            "  Windows: https://www.gyan.dev/ffmpeg/builds/",
            file=sys.stderr,
        )
        sys.exit(1)

    rtmp_target = f"{args.rtmp_url.rstrip('/')}/{args.stream_key}"
    print(f"Streaming SMPTE test pattern to: {rtmp_target}")
    print("Press Ctrl-C to stop.")
    print()
    print("Verify live at: http://localhost:8080/stat")
    print()

    cmd = [
        "ffmpeg",
        "-re",
        # Video source: SMPTE color bars at 1280x720 30fps
        "-f", "lavfi",
        "-i", "testsrc=size=1280x720:rate=30",
        # Audio source: 440Hz sine wave
        "-f", "lavfi",
        "-i", "sine=frequency=440:sample_rate=44100",
        # Video encoding
        "-vcodec", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-b:v", args.bitrate,
        # Audio encoding
        "-acodec", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        # Output
        "-f", "flv",
        rtmp_target,
    ]

    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\nStream stopped.")
    except subprocess.CalledProcessError as e:
        print(f"\nFFmpeg exited with error code {e.returncode}", file=sys.stderr)
        print("Make sure the RTMP server is running:", file=sys.stderr)
        print("  docker compose --profile video up nginx-rtmp -d", file=sys.stderr)
        sys.exit(e.returncode)


if __name__ == "__main__":
    main()
