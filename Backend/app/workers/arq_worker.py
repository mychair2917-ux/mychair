from arq.connections import RedisSettings
from app.core.config import settings
from app.workers.tasks import send_notification_task, process_appointment_booked_workflow

async def startup(ctx) -> None:
    """Triggered when background worker starts up."""
    from app.db.connection import init_db
    await init_db()

async def shutdown(ctx) -> None:
    """Triggered when worker terminates."""
    pass

class WorkerSettings:
    """ARQ Worker execution parameters configuration."""
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URI)
    
    # Register tasks
    functions = [
        send_notification_task,
        process_appointment_booked_workflow
    ]
    
    on_startup = startup
    on_shutdown = shutdown
