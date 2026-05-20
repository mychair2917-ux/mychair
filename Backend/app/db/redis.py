import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger("redis")

class RedisClientManager:
    """
    Manages persistent async Redis client connection pools.
    Supports caching, shared distributed locks, and token blacklisting.
    """
    def __init__(self) -> None:
        self.redis: Optional[aioredis.Redis] = None

    def init_redis(self) -> None:
        """Initializes the connection pool wrapper."""
        logger.info("Initializing Redis connection pool...")
        self.redis = aioredis.from_url(
            settings.REDIS_URI,
            encoding="utf-8",
            decode_responses=True
        )

    async def close_redis(self) -> None:
        """Closes connection pools gracefully on shutdown."""
        if self.redis:
            logger.info("Closing Redis connection pool...")
            await self.redis.close()

# Singleton global instance
redis_client = RedisClientManager()
