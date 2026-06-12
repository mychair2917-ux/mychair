import asyncio
import logging
from typing import Awaitable, Callable, Optional, TypeVar

logger = logging.getLogger("resilience")

T = TypeVar("T")

# Capped exponential backoff: 2s → 4s → 8s → … → max 60s
RETRY_BASE_SECONDS = 2
RETRY_MAX_DELAY_SECONDS = 60


def backoff_delay(attempt: int) -> int:
    """Return capped exponential delay for a 1-based attempt number."""
    exponent = min(max(attempt - 1, 0), 6)
    return min(RETRY_BASE_SECONDS * (2**exponent), RETRY_MAX_DELAY_SECONDS)


async def retry_with_backoff(
    name: str,
    operation: Callable[[], Awaitable[T]],
    *,
    max_attempts: int,
    budget_seconds: Optional[float] = None,
) -> T:
    """
    Bounded retry helper for API startup.
    Raises the last error once max_attempts or budget_seconds is exhausted.
    """
    import time

    deadline = time.monotonic() + budget_seconds if budget_seconds else None
    last_error: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        if deadline is not None and time.monotonic() > deadline:
            raise TimeoutError(
                f"{name} exceeded startup budget of {budget_seconds}s "
                f"(last error: {last_error})"
            )
        try:
            return await operation()
        except Exception as exc:
            last_error = exc
            if attempt < max_attempts:
                delay = backoff_delay(attempt)
                if deadline is not None:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise TimeoutError(
                            f"{name} exceeded startup budget of {budget_seconds}s "
                            f"(last error: {exc})"
                        ) from exc
                    delay = min(delay, max(int(remaining), 1))
                logger.warning(
                    "%s attempt %d/%d failed: %s. Retrying in %ds...",
                    name,
                    attempt,
                    max_attempts,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
            else:
                logger.error("%s failed after %d attempts: %s", name, max_attempts, exc)

    raise last_error  # type: ignore[misc]


async def retry_forever(name: str, operation: Callable[[], Awaitable[T]]) -> T:
    """
    Infinite retry helper for worker startup.
    Never exits on failure — uses capped exponential backoff between attempts.
    """
    attempt = 0
    while True:
        attempt += 1
        try:
            result = await operation()
            if attempt > 1:
                logger.info("%s succeeded on attempt %d", name, attempt)
            return result
        except Exception as exc:
            delay = backoff_delay(attempt)
            logger.warning(
                "%s attempt %d failed: %s. Retrying in %ds...",
                name,
                attempt,
                exc,
                delay,
            )
            await asyncio.sleep(delay)
