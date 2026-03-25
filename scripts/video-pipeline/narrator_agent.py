#!/usr/bin/env python3
"""
narrator_agent.py
Watch crypto prices via CoinGecko and generate live market commentary.

When a coin moves more than `--threshold` % in one polling interval:
  1. Claude (Haiku) generates a 1-2 sentence TV anchor commentary
  2. Google Cloud TTS converts the text to MP3
  3. MP3 is saved to ./narration_queue/ with a timestamp filename

Run alongside run_financial_stream.py in a second terminal.
Phase 2 integration: pipe MP3s into the FFmpeg audio track.

Prerequisites:
  pip install anthropic httpx
  export CLAUDE_API_KEY=sk-ant-...
  export GOOGLE_TTS_API_KEY=AIza...

Usage:
  python narrator_agent.py
  python narrator_agent.py --threshold 0.5   # trigger on 0.5% moves (good for testing)
  python narrator_agent.py --threshold 2.0 --poll-interval 60
"""

import argparse
import base64
import json
import os
import pathlib
import sys
import time
from datetime import datetime, timezone


COINGECKO_URL = (
    "https://api.coingecko.com/api/v3/coins/markets"
    "?vs_currency=usd"
    "&ids=bitcoin,ethereum,solana,cardano,polkadot,chainlink,uniswap,avalanche-2"
    "&order=market_cap_desc"
    "&sparkline=false"
)

NARRATOR_SYSTEM_PROMPT = (
    "You are a sharp, authoritative live financial TV anchor. "
    "You deliver market commentary in one or two punchy sentences — direct, specific, no filler. "
    "Always mention the coin name, the exact price, and the percentage move. "
    "Keep it under 30 words."
)

OUTPUT_DIR = pathlib.Path(__file__).parent / "narration_queue"


def check_api_keys() -> tuple[str, str]:
    claude_key = os.environ.get("CLAUDE_API_KEY", "")
    tts_key = os.environ.get("GOOGLE_TTS_API_KEY", "")

    missing = []
    if not claude_key:
        missing.append("CLAUDE_API_KEY")
    if not tts_key:
        missing.append("GOOGLE_TTS_API_KEY")

    if missing:
        print(
            f"WARNING: Missing env vars: {', '.join(missing)}\n"
            "Commentary will be printed to console but NO audio files will be saved.\n"
            "Set the keys to enable full TTS output.\n",
            file=sys.stderr,
        )

    return claude_key, tts_key


def fetch_prices(client) -> list[dict]:
    """Fetch current prices from CoinGecko. Returns list of coin dicts."""
    resp = client.get(COINGECKO_URL, timeout=10)
    resp.raise_for_status()
    return resp.json()


def detect_moves(current: list[dict], previous: dict[str, float], threshold: float) -> list[dict]:
    """Return coins that moved more than threshold% since last snapshot."""
    moves = []
    for coin in current:
        cid = coin["id"]
        price = coin["current_price"]
        if cid in previous:
            prev_price = previous[cid]
            if prev_price > 0:
                pct = ((price - prev_price) / prev_price) * 100
                if abs(pct) >= threshold:
                    moves.append({
                        "id": cid,
                        "name": coin["name"],
                        "symbol": coin["symbol"].upper(),
                        "price": price,
                        "pct_change": pct,
                        "prev_price": prev_price,
                    })
    return moves


def generate_commentary(anthropic_client, move: dict) -> str:
    """Ask Claude to generate a TV anchor commentary line for a price move."""
    direction = "up" if move["pct_change"] > 0 else "down"
    sign = "+" if move["pct_change"] > 0 else ""
    prompt = (
        f"{move['name']} ({move['symbol']}) just moved {direction} "
        f"{sign}{move['pct_change']:.2f}% to ${move['price']:,.2f}. "
        "Write one punchy live TV anchor commentary sentence about this move."
    )

    resp = anthropic_client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=80,
        system=NARRATOR_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text.strip()


def synthesize_to_mp3(tts_key: str, text: str) -> bytes:
    """Call Google Cloud TTS and return raw MP3 bytes."""
    import httpx

    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={tts_key}"
    payload = {
        "input": {"text": text},
        "voice": {
            "languageCode": "en-US",
            "name": "en-US-Neural2-D",
            "ssmlGender": "MALE",
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 1.1,
            "pitch": 0.0,
        },
    }
    resp = httpx.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    audio_b64 = resp.json()["audioContent"]
    return base64.b64decode(audio_b64)


def save_mp3(mp3_bytes: bytes, coin_symbol: str) -> pathlib.Path:
    """Save MP3 to narration_queue/ with a timestamped filename."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = OUTPUT_DIR / f"narration_{ts}_{coin_symbol}.mp3"
    filename.write_bytes(mp3_bytes)
    return filename


def run(args: argparse.Namespace) -> None:
    try:
        import httpx
    except ImportError:
        print("ERROR: httpx not installed. Run: pip install httpx", file=sys.stderr)
        sys.exit(1)

    claude_key, tts_key = check_api_keys()

    anthropic_client = None
    if claude_key:
        try:
            import anthropic
            anthropic_client = anthropic.Anthropic(api_key=claude_key)
        except ImportError:
            print("ERROR: anthropic not installed. Run: pip install anthropic", file=sys.stderr)
            sys.exit(1)

    http = httpx.Client()
    snapshot: dict[str, float] = {}

    print(f"[narrator] Starting price watcher")
    print(f"[narrator] Threshold  : {args.threshold}% move")
    print(f"[narrator] Poll every : {args.poll_interval}s")
    print(f"[narrator] Output dir : {OUTPUT_DIR}")
    print(f"[narrator] Claude     : {'enabled' if anthropic_client else 'DISABLED (no key)'}")
    print(f"[narrator] TTS        : {'enabled' if tts_key else 'DISABLED (no key)'}")
    print()

    while True:
        try:
            coins = fetch_prices(http)
            current_prices = {c["id"]: c["current_price"] for c in coins}

            if snapshot:
                moves = detect_moves(coins, snapshot, args.threshold)
                for move in moves:
                    sign = "+" if move["pct_change"] > 0 else ""
                    ts_str = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")

                    print(
                        f"[{ts_str}] MOVE DETECTED: {move['name']} ({move['symbol']}) "
                        f"{sign}{move['pct_change']:.2f}% → ${move['price']:,.4f}"
                    )

                    commentary = None
                    if anthropic_client:
                        try:
                            commentary = generate_commentary(anthropic_client, move)
                            print(f"[{ts_str}] COMMENTARY: {commentary}")
                        except Exception as e:
                            print(f"[{ts_str}] Claude error: {e}", file=sys.stderr)

                    if commentary and tts_key:
                        try:
                            mp3_bytes = synthesize_to_mp3(tts_key, commentary)
                            saved_path = save_mp3(mp3_bytes, move["symbol"])
                            print(f"[{ts_str}] SAVED: {saved_path.name}  ({len(mp3_bytes):,} bytes)")
                        except Exception as e:
                            print(f"[{ts_str}] TTS error: {e}", file=sys.stderr)
                    elif commentary:
                        print(f"[{ts_str}] (TTS disabled — commentary not saved to audio)")

            snapshot = current_prices
            print(
                f"[narrator] Snapshot updated: {len(snapshot)} coins  |  "
                f"next check in {args.poll_interval}s"
            )

        except KeyboardInterrupt:
            print("\n[narrator] Stopped.")
            break
        except Exception as e:
            print(f"[narrator] Error: {e}", file=sys.stderr)

        time.sleep(args.poll_interval)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Watch crypto prices and generate live market commentary"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=2.0,
        help="Price move %% that triggers commentary (default: 2.0). Use 0.01 for testing.",
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=60,
        help="Seconds between CoinGecko polls (default: 60)",
    )
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
