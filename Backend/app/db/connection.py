import logging
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings

# Import all models to register them inside Beanie engine
from app.models.tenant import Tenant
from app.models.salon import Salon
from app.models.user import User
from app.models.staff import Staff, StaffSchedule
from app.models.customer import Customer
from app.models.service import Service
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.attendance import Attendance
from app.models.subscription import Subscription
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.analytics import DailyRevenueStats, StaffPerformanceStats, ServicePopularityStats

logger = logging.getLogger("db")

async def init_db() -> None:
    """
    Initializes the asynchronous Motor Mongo client and registers
    all application ODM models inside Beanie with indexes pre-cached.
    """
    logger.info("Initializing MongoDB Async Client...")
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Monkeypatch client.append_metadata to prevent Beanie's check from calling it
    # as a database object, since older motor versions fallback to treating it as client["append_metadata"]
    client.append_metadata = lambda *args, **kwargs: None
    database = client[settings.MONGODB_DB_NAME]
    
    # List of all Beanie document models
    models = [
        Tenant,
        Salon,
        User,
        Staff,
        StaffSchedule,
        Customer,
        Service,
        Appointment,
        Invoice,
        Payment,
        InventoryItem,
        InventoryTransaction,
        Attendance,
        Subscription,
        Notification,
        AuditLog,
        DailyRevenueStats,
        StaffPerformanceStats,
        ServicePopularityStats
    ]
    
    await init_beanie(
        database=database,
        document_models=models
    )
    logger.info("MongoDB and Beanie ODM successfully initialized!")
