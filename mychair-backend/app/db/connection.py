import logging
from typing import Optional

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import Settings, settings
from app.db.resilience import retry_with_backoff

# Import all models to register them inside Beanie engine
from app.models.tenant import Tenant
from app.models.salon import Salon
from app.models.user import User
from app.models.employee import Employee
from app.models.staff import Staff, StaffSchedule
from app.models.customer import Customer
from app.models.brand import Brand
from app.models.product import Product
from app.models.service import Service
from app.models.salon_product import SalonProduct
from app.models.salon_service import SalonService
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.models.inventory import InventoryItem, InventoryTransaction, ProductInventory
from app.models.attendance import Attendance
from app.models.attendance_log import AttendanceLog
from app.models.leave_log import LeaveLog
from app.models.leave_request import LeaveRequest
from app.models.subscription import Subscription
from app.models.system_settings import SystemSettings
from app.models.subscription_email_log import SubscriptionEmailLog
from app.models.notification import Notification
from app.models.notification_communication import (
    BusinessAlert,
    CommunicationCampaign,
    CommunicationLog,
    CommunicationRecipient,
    NotificationPreference,
    NotificationTemplate,
    SubscriptionNotification,
)
from app.models.audit import AuditLog
from app.models.analytics import DailyRevenueStats, StaffPerformanceStats, ServicePopularityStats
from app.models.invitation_token import InvitationToken
from app.models.invite import Invite
from app.models.payroll import Payroll
from app.models.bill import Bill
from app.models.reward_settings import RewardSettings, RewardSegment
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.models.expense import Expense
from app.models.user_permission import PermissionRecord
from app.models.whatsapp_message import WhatsAppMessageLog

logger = logging.getLogger("db")

MONGO_MAX_RETRIES = 5
MONGO_STARTUP_BUDGET_SECONDS = 60
MONGO_SERVER_SELECTION_TIMEOUT_MS = 5000

BEANIE_MODELS = [
    Tenant,
    Salon,
    User,
    Employee,
    Staff,
    StaffSchedule,
    Customer,
    Brand,
    Product,
    Service,
    SalonProduct,
    SalonService,
    Appointment,
    Invoice,
    Payment,
    InventoryItem,
    ProductInventory,
    InventoryTransaction,
    Attendance,
    AttendanceLog,
    LeaveRequest,
    LeaveLog,
    Subscription,
    SystemSettings,
    SubscriptionEmailLog,
    Notification,
    NotificationPreference,
    NotificationTemplate,
    CommunicationCampaign,
    CommunicationRecipient,
    CommunicationLog,
    SubscriptionNotification,
    BusinessAlert,
    AuditLog,
    DailyRevenueStats,
    StaffPerformanceStats,
    ServicePopularityStats,
    InvitationToken,
    Invite,
    Payroll,
    Bill,
    RewardSettings,
    RewardSegment,
    CustomerRewardTransaction,
    Expense,
    PermissionRecord,
    WhatsAppMessageLog,
]

_mongo_client: Optional[AsyncIOMotorClient] = None
_db_initialized = False


def is_db_initialized() -> bool:
    return _db_initialized


async def ping_db() -> bool:
    """Lightweight liveness probe against the active MongoDB pool."""
    if not _db_initialized or _mongo_client is None:
        return False
    try:
        await _mongo_client.admin.command("ping")
        return True
    except Exception as exc:
        logger.warning("MongoDB ping failed: %s", exc)
        return False


async def _connect_db_once() -> None:
    """Single MongoDB connection attempt; raises on failure."""
    global _mongo_client, _db_initialized

    pending_client: Optional[AsyncIOMotorClient] = None
    try:
        pending_client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=MONGO_SERVER_SELECTION_TIMEOUT_MS,
        )
        pending_client.append_metadata = lambda *args, **kwargs: None

        await pending_client.admin.command("ping")
        database = pending_client[settings.MONGODB_DB_NAME]
        await init_beanie(database=database, document_models=BEANIE_MODELS)

        _mongo_client = pending_client
        pending_client = None
        _db_initialized = True
    except Exception:
        if pending_client is not None:
            pending_client.close()
        raise


async def init_db() -> None:
    """
    Initializes MongoDB with bounded retry for API startup.
    Safe to call multiple times — subsequent calls are no-ops.
    """
    global _db_initialized

    if _db_initialized:
        return

    logger.info("Initializing MongoDB Async Client...")
    logger.info("Mongo URI: %s", Settings.mask_uri(settings.MONGODB_URI))

    await retry_with_backoff(
        "MongoDB",
        _connect_db_once,
        max_attempts=MONGO_MAX_RETRIES,
        budget_seconds=MONGO_STARTUP_BUDGET_SECONDS,
    )
    logger.info("Mongo connected")
    logger.info("MongoDB and Beanie ODM successfully initialized!")


async def close_db() -> None:
    """Closes the MongoDB client gracefully on shutdown."""
    global _mongo_client, _db_initialized

    if _mongo_client is not None:
        logger.info("Closing MongoDB connection...")
        _mongo_client.close()
        _mongo_client = None
    _db_initialized = False
