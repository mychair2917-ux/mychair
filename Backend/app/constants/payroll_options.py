"""Lookup values and constants for payroll / salary configuration."""

SALARY_TYPES = [
    {"value": "monthly", "label": "Monthly"},
    {"value": "daily", "label": "Daily"},
    {"value": "weekly", "label": "Weekly"},
]

VALID_SALARY_TYPE_VALUES = {item["value"] for item in SALARY_TYPES}
DEFAULT_SALARY_TYPE = "monthly"

# Payroll payment statuses
PAYMENT_STATUS_PENDING = "PENDING"
PAYMENT_STATUS_PAID = "PAID"
VALID_PAYMENT_STATUSES = {PAYMENT_STATUS_PENDING, PAYMENT_STATUS_PAID}
