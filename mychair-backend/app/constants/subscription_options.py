"""Global SaaS subscription plan definitions."""

SUBSCRIPTION_PLANS = [
    {"value": "FREE_TRIAL", "label": "Free Trial"},
    {"value": "BASIC", "label": "Basic"},
    {"value": "PROFESSIONAL", "label": "Professional"},
    {"value": "ENTERPRISE", "label": "Enterprise"},
]

VALID_SUBSCRIPTION_PLAN_VALUES = {item["value"] for item in SUBSCRIPTION_PLANS}

SUBSCRIPTION_STATUSES = ("ACTIVE", "EXPIRED", "SUSPENDED")

# Legacy plan codes stored before this module
LEGACY_PLAN_ALIASES = {
    "FREE": "FREE_TRIAL",
    "PREMIUM": "PROFESSIONAL",
}

PLAN_AMOUNTS = {
    "FREE_TRIAL": 0.0,
    "BASIC": 29.0,
    "PROFESSIONAL": 79.0,
    "ENTERPRISE": 199.0,
}

EXPIRY_REMINDER_DAYS = (7, 3, 2, 1)

DEFAULT_SUBSCRIPTION_DAYS = 30


def normalize_plan_name(plan_name: str | None) -> str:
    if not plan_name:
        return "FREE_TRIAL"
    normalized = plan_name.strip().upper()
    return LEGACY_PLAN_ALIASES.get(normalized, normalized)


def plan_label(plan_name: str | None) -> str:
    normalized = normalize_plan_name(plan_name)
    for item in SUBSCRIPTION_PLANS:
        if item["value"] == normalized:
            return item["label"]
    return normalized.replace("_", " ").title()
