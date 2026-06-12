import logging
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import Settings, settings
from app.db.resilience import retry_with_backoff

logger = logging.getLogger("redis")

REDIS_MAX_RETRIES = 5
REDIS_STARTUP_BUDGET_SECONDS = 30


class RedisClientManager:
    """
    Manages persistent async Redis client connection pools.
    Supports caching, shared distributed locks, and token blacklisting.
    """

    def __init__(self) -> None:
        self.redis: Optional[aioredis.Redis] = None
        self._initialized = False

    @property
    def is_initialized(self) -> bool:
        return self._initialized and self.redis is not None

    async def ping_redis(self) -> bool:
        """Lightweight liveness probe against the active Redis pool."""
        if not self.is_initialized or self.redis is None:
            return False
        try:
            await self.redis.ping()
            return True
        except Exception as exc:
            logger.warning("Redis ping failed: %s", exc)
            return False

    async def connect_once(self) -> None:
        """Single Redis connection attempt; raises on failure."""
        candidate: Optional[aioredis.Redis] = None
        try:
            candidate = aioredis.from_url(
                settings.REDIS_URI,
                encoding="utf-8",
                decode_responses=True,
            )
            await candidate.ping()
            self.redis = candidate
            candidate = None
            self._initialized = True
        except Exception:
            if candidate is not None:
                await candidate.close()
            raise

    async def init_redis(self) -> None:
        """Initializes Redis with bounded retry for API startup."""
        if self.is_initialized:
            return

        logger.info("Initializing Redis connection pool...")
        logger.info("Redis URI: %s", Settings.mask_uri(settings.REDIS_URI))

        await retry_with_backoff(
            "Redis",
            self.connect_once,
            max_attempts=REDIS_MAX_RETRIES,
            budget_seconds=REDIS_STARTUP_BUDGET_SECONDS,
        )
        logger.info("Redis connected OK")

    async def reset_redis(self) -> None:
        """Closes the pool and clears init state (used between worker retry attempts)."""
        if self.redis:
            await self.redis.close()
        self.redis = None
        self._initialized = False

    async def close_redis(self) -> None:
        """Closes connection pools gracefully on shutdown."""
        if self.redis:
            logger.info("Closing Redis connection pool...")
            await self.redis.close()
        self.redis = None
        self._initialized = False


redis_client = RedisClientManager()
