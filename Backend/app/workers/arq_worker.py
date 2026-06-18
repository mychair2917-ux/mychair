import logging

from arq.connections import RedisSettings
from arq.cron import cron

from app.core.config import Settings, settings
from app.workers.tasks import process_appointment_booked_workflow, process_scheduled_campaigns, send_notification_task

logger = logging.getLogger("worker")


async def startup(ctx) -> None:
    """Triggered when background worker starts up."""
    logger.info("Worker starting...")
    logger.info("Environment: %s", settings.ENV)
    logger.info("JWT fingerprint: %s", Settings.secret_fingerprint(settings.SECRET_KEY))
    logger.info("Redis URI: %s", Settings.mask_uri(settings.REDIS_URI))

    from app.db.connection import init_db, is_db_initialized

    if not is_db_initialized():
        logger.info("Connecting to MongoDB...")
        await init_db()
        logger.info("Mongo connected")
    else:
        logger.info("MongoDB already initialized")

    logger.info("Worker started OK")


async def shutdown(ctx) -> None:
    """Triggered when worker terminates."""
    logger.info("Worker shutting down...")


class WorkerSettings:
    """ARQ Worker execution parameters configuration."""

    redis_settings = RedisSettings.from_dsn(settings.REDIS_URI)

    functions = [
        send_notification_task,
        process_appointment_booked_workflow,
        process_scheduled_campaigns,
    ]

    cron_jobs = [
        cron(process_scheduled_campaigns, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),
    ]

    on_startup = startup
    on_shutdown = shutdown
