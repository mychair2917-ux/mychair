"""
Centralized logging setup for API and workers.

Formats timestamps and levels for production logs. Never logs secret values;
callers must use Settings.mask_uri / secret_fingerprint for sensitive fields.
"""
from __future__ import annotations

import logging
import sys
from typing import Optional

_CONFIGURED = False

DEFAULT_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DEFAULT_DATEFMT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: int = logging.INFO, *, force: bool = False) -> None:
    """
    Configure root logging once with a consistent timestamped format.

    Safe to call from multiple entrypoints (API, worker, scripts).
    Does not alter application behavior beyond log presentation.
    """
    global _CONFIGURED
    if _CONFIGURED and not force:
        return

    root = logging.getLogger()
    root.setLevel(level)

    handler: Optional[logging.Handler] = None
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        root.addHandler(handler)
    else:
        handler = root.handlers[0]

    formatter = logging.Formatter(DEFAULT_FORMAT, datefmt=DEFAULT_DATEFMT)
    for h in root.handlers:
        h.setFormatter(formatter)
        h.setLevel(level)

    # Quiet noisy third-party loggers in production-facing processes
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    _CONFIGURED = True
    logging.getLogger("logging_config").debug("Logging configured (level=%s)", level)
