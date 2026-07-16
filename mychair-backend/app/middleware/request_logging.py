"""
HTTP request/response access logging middleware.

Logs method, path, status, and duration only — never headers, bodies, or tokens.
Does not modify request or response payloads.
"""
from __future__ import annotations

import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("request")

# High-frequency probes — keep logs quieter unless they fail
_QUIET_PATHS = frozenset({"/health", "/health/deep"})


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "%s %s failed after %.1fms",
                request.method,
                request.url.path,
                duration_ms,
            )
            raise

        duration_ms = (time.perf_counter() - start) * 1000
        path = request.url.path
        if path in _QUIET_PATHS and response.status_code < 400:
            logger.debug(
                "%s %s -> %s (%.1fms)",
                request.method,
                path,
                response.status_code,
                duration_ms,
            )
        else:
            logger.info(
                "%s %s -> %s (%.1fms)",
                request.method,
                path,
                response.status_code,
                duration_ms,
            )
        return response
