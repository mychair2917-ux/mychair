"""
Production worker entrypoint with infinite retry/backoff.

Never exits on transient Redis/Mongo failures during deploy — waits until
dependencies are ready, then runs ARQ. If ARQ exits unexpectedly, restarts
with backoff instead of letting Render enter a tight crash loop.
"""
import asyncio
import logging
import time

from arq import run_worker

from app.core.config import Settings, settings
from app.db.connection import init_db, is_db_initialized
from app.db.redis import redis_client
from app.db.resilience import backoff_delay, retry_forever
from app.workers.arq_worker import WorkerSettings

logger = logging.getLogger("worker")


def _log_env_fingerprints() -> None:
    logger.info("Environment: %s", settings.ENV)
    logger.info("JWT fingerprint: %s", Settings.secret_fingerprint(settings.SECRET_KEY))
    logger.info("Refresh fingerprint: %s", Settings.secret_fingerprint(settings.REFRESH_SECRET_KEY))
    logger.info("Mongo URI: %s", Settings.mask_uri(settings.MONGODB_URI))
    logger.info("Redis URI: %s", Settings.mask_uri(settings.REDIS_URI))


async def _wait_for_redis() -> None:
    async def _probe() -> None:
        await redis_client.reset_redis()
        await redis_client.connect_once()

    await retry_forever("Worker Redis", _probe)
    await redis_client.reset_redis()


async def _wait_for_mongo() -> None:
    if is_db_initialized():
        return

    async def _probe() -> None:
        await init_db()

    await retry_forever("Worker MongoDB", _probe)


async def _bootstrap_dependencies() -> None:
    _log_env_fingerprints()
    logger.info("Waiting for Redis before starting ARQ worker...")
    await _wait_for_redis()
    logger.info("Redis precondition check passed")

    logger.info("Waiting for MongoDB before starting ARQ worker...")
    await _wait_for_mongo()
    logger.info("MongoDB precondition check passed")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    restart_attempt = 0

    while True:
        restart_attempt += 1
        try:
            asyncio.run(_bootstrap_dependencies())
            logger.info("Launching ARQ worker (launch #%d)...", restart_attempt)
            run_worker(WorkerSettings)
            logger.warning("ARQ worker exited cleanly — restarting after backoff...")
        except KeyboardInterrupt:
            logger.info("Worker shutdown requested.")
            break
        except Exception as exc:
            logger.error("ARQ worker crashed: %s — restarting after backoff...", exc)

        delay = backoff_delay(restart_attempt)
        logger.info("Worker restart backoff: %ds", delay)
        time.sleep(delay)


if __name__ == "__main__":
    main()
