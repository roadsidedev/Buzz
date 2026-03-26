#!/usr/bin/env python3
"""
event_listener.py
Phase 2 async listener for breaking news and room events.

Provides a thread-safe priority queue and a background HTTP server (or watcher)
that allows external systems to inject immediate "interrupt" events into the
radio runner's main loop.

Used by: radio_runner.py
"""

import hashlib
import hmac
import json
import logging
import os
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, HTTPServer
from queue import Empty, PriorityQueue

logger = logging.getLogger(__name__)

WEBHOOK_SECRET: str = os.environ.get("WEBHOOK_SECRET", "")


@dataclass(order=True)
class RadioEvent:
    """An event injected into the runner loop."""
    priority: int      # Lower number = higher priority
    event_type: str    # e.g., 'BREAKING_NEWS', 'USER_JOINED'
    payload: dict = field(compare=False)


class EventQueue:
    """A thread-safe priority queue for the radio runner."""

    def __init__(self) -> None:
        self._queue: PriorityQueue[RadioEvent] = PriorityQueue()

    def push(self, event_type: str, priority: int, payload: dict) -> None:
        """Add an event to the queue."""
        event = RadioEvent(priority=priority, event_type=event_type, payload=payload)
        self._queue.put(event)
        logger.info("Queued event: %s (priority %d)", event_type, priority)

    def pop_all(self) -> list[RadioEvent]:
        """Drain all pending events from the queue (highest priority first)."""
        events = []
        while True:
            try:
                events.append(self._queue.get_nowait())
            except Empty:
                break
        return events


class WebhookServer(threading.Thread):
    """
    A simple background HTTP server to accept inbound webhooks.
    Used for injecting breaking news while the runner blocks on LLM calls.
    """

    def __init__(self, port: int = 8765, event_queue: EventQueue = None) -> None:
        super().__init__(daemon=True)
        self.port = port
        self.event_queue = event_queue
        self._server = None

    def run(self) -> None:
        handler = self._make_handler(self.event_queue)
        self._server = HTTPServer(("0.0.0.0", self.port), handler)
        logger.info("WebhookServer started on port %d", self.port)
        try:
            self._server.serve_forever()
        except Exception as e:
            logger.error("WebhookServer error: %s", e)

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            logger.info("WebhookServer stopped.")

    @staticmethod
    def _make_handler(queue: EventQueue) -> type:
        secret = WEBHOOK_SECRET

        class WebhookHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path == "/events/breaking-news":
                    # HMAC secret check (enforced only when WEBHOOK_SECRET is set)
                    if secret:
                        provided = self.headers.get("X-Webhook-Secret", "")
                        if not hmac.compare_digest(provided, secret):
                            self.send_response(401)
                            self.end_headers()
                            self.wfile.write(b'{"error":"unauthorized"}')
                            return

                    content_length = int(self.headers.get("Content-Length", 0))
                    body = self.rfile.read(content_length).decode("utf-8")
                    try:
                        payload = json.loads(body)
                        # Priority 1: High alert
                        queue.push("BREAKING_NEWS", 1, payload)
                        self.send_response(202)
                        self.end_headers()
                        self.wfile.write(b'{"status":"accepted"}')
                    except json.JSONDecodeError:
                        self.send_response(400)
                        self.end_headers()
                        self.wfile.write(b'{"error":"invalid json"}')
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, format, *args):
                # Suppress noisy HTTP logs
                pass

        return WebhookHandler
