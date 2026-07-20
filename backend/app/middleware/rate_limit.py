"""IP-based sliding-window rate limiter middleware.

Protects every API endpoint from brute-force and abuse.
Exemptions: /health, /docs, /openapi.json (read-only, non-sensitive).

Config (defaults are reasonable for development; tighten for production):
  RATE_LIMIT_REQUESTS  – max requests per window (default 120)
  RATE_LIMIT_WINDOW_S  – sliding window in seconds (default 60)
"""
from __future__ import annotations

import time
from collections import deque, defaultdict
from threading import Lock
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logging import get_logger

log = get_logger(__name__)

# Endpoints that are exempt from rate limiting.
_EXEMPT_PREFIXES = ("/health", "/docs", "/openapi.json", "/redoc", "/favicon.ico")

# Default limits — can be overridden by env vars later.
_DEFAULT_MAX_REQUESTS = 120  # per window
_DEFAULT_WINDOW_SECONDS = 60


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window in-memory rate limiter keyed by client IP."""

    def __init__(self, app: ASGIApp, max_requests: int = _DEFAULT_MAX_REQUESTS, window_seconds: int = _DEFAULT_WINDOW_SECONDS) -> None:
        super().__init__(app)
        self._max = max_requests
        self._window = window_seconds
        # Maps IP → deque of request timestamps (float)
        self._buckets: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def _get_client_ip(self, request: Request) -> str:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Skip rate limiting for exempt paths.
        if any(path.startswith(prefix) for prefix in _EXEMPT_PREFIXES):
            return await call_next(request)

        ip = self._get_client_ip(request)
        now = time.monotonic()
        cutoff = now - self._window

        with self._lock:
            bucket = self._buckets[ip]
            # Evict timestamps that have slid out of the window.
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= self._max:
                oldest = bucket[0]
                retry_after = int(self._window - (now - oldest)) + 1
                log.warning(
                    "Rate limit exceeded: ip=%s path=%s requests_in_window=%d",
                    ip, path, len(bucket),
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please slow down.",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

            bucket.append(now)

        return await call_next(request)
