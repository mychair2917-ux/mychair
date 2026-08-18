"""
Centralized SaaS Feature Catalog and Initial Plan Configurations.
"""

from typing import Any, Dict, List

# Feature Categories
CATEGORY_CORE = "Core"
CATEGORY_CLIENT_APPOINTMENT = "Client & Appointment"
CATEGORY_STAFF = "Staff"
CATEGORY_FINANCE_ANALYTICS = "Finance & Analytics"
CATEGORY_COMMUNICATION = "Communication"

FEATURE_CATALOG: List[Dict[str, Any]] = [
    {
        "key": "DASHBOARD",
        "name": "Dashboard",
        "description": "Overview metrics, sales summary, and daily salon activity.",
        "category": CATEGORY_CORE,
        "active": True,
    },
    {
        "key": "PROFILE",
        "name": "Profile",
        "description": "Manage staff and salon user profile details.",
        "category": CATEGORY_CORE,
        "active": True,
    },
    {
        "key": "SALON_MANAGEMENT",
        "name": "Salon Management",
        "description": "Salon setup, services catalog, and products configuration.",
        "category": CATEGORY_CORE,
        "active": True,
    },
    {
        "key": "BILLING",
        "name": "Billing",
        "description": "Point of sale billing, checkout, and invoice generation.",
        "category": CATEGORY_CLIENT_APPOINTMENT,
        "active": True,
    },
    {
        "key": "APPOINTMENTS",
        "name": "Appointments",
        "description": "Appointment booking register, scheduling, and calendar.",
        "category": CATEGORY_CLIENT_APPOINTMENT,
        "active": True,
    },
    {
        "key": "INVITE",
        "name": "Invite",
        "description": "Invite new staff members and manage pending invitations.",
        "category": CATEGORY_STAFF,
        "active": True,
    },
    {
        "key": "ATTENDANCE",
        "name": "Attendance",
        "description": "Staff check-in/out tracking and daily attendance logs.",
        "category": CATEGORY_STAFF,
        "active": True,
    },
    {
        "key": "LEAVE",
        "name": "Leave",
        "description": "Employee leave requests, leave balances, and approval workflow.",
        "category": CATEGORY_STAFF,
        "active": True,
    },
    {
        "key": "MY_EARNINGS",
        "name": "My Earnings",
        "description": "Individual staff earnings, commission breakdown, and tips.",
        "category": CATEGORY_STAFF,
        "active": True,
    },
    {
        "key": "ROLE_PERMISSIONS",
        "name": "Role & Permissions",
        "description": "Custom role templates and granular user permission controls.",
        "category": CATEGORY_STAFF,
        "active": True,
    },
    {
        "key": "BILLING_FINANCE",
        "name": "Billing & Finance",
        "description": "Financial statements, expense tracking, and payroll reports.",
        "category": CATEGORY_FINANCE_ANALYTICS,
        "active": True,
    },
    {
        "key": "CUSTOMER_ANALYTICS",
        "name": "Customer Analytics",
        "description": "Deep customer retention analysis and revenue insights.",
        "category": CATEGORY_FINANCE_ANALYTICS,
        "active": True,
    },
    {
        "key": "NOTIFICATIONS",
        "name": "Notification",
        "description": "System notifications, reminders, and staff alerts.",
        "category": CATEGORY_COMMUNICATION,
        "active": True,
    },
    {
        "key": "WHATSAPP",
        "name": "WhatsApp",
        "description": "Send WhatsApp messages and marketing communications.",
        "category": CATEGORY_COMMUNICATION,
        "active": True,
    },
]

ALL_FEATURE_KEYS: List[str] = [f["key"] for f in FEATURE_CATALOG]

PLAN_DISPLAY_NAMES: Dict[str, str] = {
    "FREE_TRIAL": "Free Trial",
    "BASIC": "Basic",
    "PROFESSIONAL": "Pro",
    "ENTERPRISE": "Enterprise",
}

# Initial Feature Matrix
INITIAL_PLAN_FEATURES: Dict[str, List[str]] = {
    "FREE_TRIAL": [
        "DASHBOARD",
        "INVITE",
        "BILLING",
        "APPOINTMENTS",
        "MY_EARNINGS",
        "ATTENDANCE",
        "LEAVE",
        "SALON_MANAGEMENT",
        "ROLE_PERMISSIONS",
        "BILLING_FINANCE",
        "CUSTOMER_ANALYTICS",
        "NOTIFICATIONS",
        "PROFILE",
    ],
    "BASIC": [
        "DASHBOARD",
        "INVITE",
        "BILLING",
        "APPOINTMENTS",
        "NOTIFICATIONS",
        "SALON_MANAGEMENT",
        "PROFILE",
    ],
    "PROFESSIONAL": [
        "DASHBOARD",
        "INVITE",
        "BILLING",
        "APPOINTMENTS",
        "NOTIFICATIONS",
        "SALON_MANAGEMENT",
        "PROFILE",
        "ATTENDANCE",
        "LEAVE",
        "ROLE_PERMISSIONS",
        "BILLING_FINANCE",
    ],
    "ENTERPRISE": [
        "DASHBOARD",
        "INVITE",
        "BILLING",
        "APPOINTMENTS",
        "MY_EARNINGS",
        "ATTENDANCE",
        "LEAVE",
        "SALON_MANAGEMENT",
        "ROLE_PERMISSIONS",
        "BILLING_FINANCE",
        "CUSTOMER_ANALYTICS",
        "NOTIFICATIONS",
        "PROFILE",
        "WHATSAPP",
    ],
}
