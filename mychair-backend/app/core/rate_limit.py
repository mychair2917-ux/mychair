import logging
import time
from typing import Dict, Tuple
from fastapi import Request

from app.core.exceptions import SalonERPException
from app.db.redis import redis_client

logger = logging.getLogger("rate_limit")

# In-memory fallback storage when Redis is unavailable or during testing
# Format: { key: (count, expire_timestamp) }
_in_memory_store: Dict[str, Tuple[int, float]] = {}


async def is_rate_limited(key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Checks whether a given key has exceeded the maximum allowed requests in a time window.
    Uses Redis if available; falls back to an in-memory dictionary.
    Returns True if RATE LIMITED (exceeded limit), False otherwise.
    """
    now = time.time()

    if redis_client.is_initialized and redis_client.redis is not None:
        try:
            r = redis_client.redis
            current = await r.incr(key)
            if current == 1:
                await r.expire(key, window_seconds)
            return current > max_requests
        except Exception as exc:
            logger.warning("Redis rate limiter check failed, falling back to memory: %s", exc)

    # In-memory fallback
    # Clean up expired entry if needed
    if key in _in_memory_store:
        count, expire_at = _in_memory_store[key]
        if now > expire_at:
            _in_memory_store[key] = (1, now + window_seconds)
            return False
        else:
            new_count = count + 1
            _in_memory_store[key] = (new_count, expire_at)
            return new_count > max_requests
    else:
        _in_memory_store[key] = (1, now + window_seconds)
        return False


def get_client_ip(request: Request) -> str:
    """Extracts client IP address considering reverse proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


async def check_forgot_password_rate_limit(email: str, client_ip: str) -> None:
    """
    Enforces rate limits for forgot password endpoint:
    - 5 requests per email per hour
    - 10 requests per IP per hour
    Raises 429 SalonERPException if limit is exceeded.
    """
    normalized_email = email.strip().lower()
    email_key = f"rate_limit:forgot_password:email:{normalized_email}"
    ip_key = f"rate_limit:forgot_password:ip:{client_ip}"

    # Check email limit (5 per hour)
    if await is_rate_limited(email_key, max_requests=5, window_seconds=3600):
        logger.warning("Rate limit exceeded for forgot-password email: %s", normalized_email)
        raise SalonERPException(
            status_code=429,
            detail="Too many password reset requests for this email. Please try again in an hour.",
        )

    # Check IP limit (10 per hour)
    if await is_rate_limited(ip_key, max_requests=10, window_seconds=3600):
        logger.warning("Rate limit exceeded for forgot-password IP: %s", client_ip)
        raise SalonERPException(
            status_code=429,
            detail="Too many password reset requests from this IP address. Please try again later.",
        )
