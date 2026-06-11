import logging
from motor.motor_asyncio import AsyncIOMotorClient

from beanie import init_beanie
from app.core.config import settings

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
from app.models.subscription import Subscription
from app.models.system_settings import SystemSettings
from app.models.subscription_email_log import SubscriptionEmailLog
from app.models.notification import Notification
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

async def init_db() -> None:
    """
    Initializes the asynchronous Motor Mongo client and registers
    all application ODM models inside Beanie with indexes pre-cached.
    """
    logger.info("Initializing MongoDB Async Client...")
    logger.info(f"Loaded Mongo URI: {settings.MONGODB_URI}")
    try:
        client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Monkeypatch client.append_metadata to prevent Beanie's check from calling it
        # as a database object, since older motor versions fallback to treating it as client["append_metadata"]
        client.append_metadata = lambda *args, **kwargs: None
        
        await client.admin.command('ping')
        logger.info("Database connected successfully")

        database = client[settings.MONGODB_DB_NAME]
    
        # List of all Beanie document models
        models = [
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
            Subscription,
            SystemSettings,
            SubscriptionEmailLog,
            Notification,
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
    
        await init_beanie(
            database=database,
            document_models=models
        )
        logger.info("MongoDB and Beanie ODM successfully initialized!")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
