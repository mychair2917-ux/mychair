"""Lookup values for the salon owner invitation form."""

SALON_TYPES = [
    {"value": "mens", "label": "Men's"},
    {"value": "females", "label": "Female's"},
    {"value": "unisex", "label": "Unisex"},
]

SUBSCRIPTION_PLANS = [
    {"value": "FREE", "label": "Free"},
    {"value": "BASIC", "label": "Basic"},
    {"value": "PREMIUM", "label": "Premium"},
    {"value": "ENTERPRISE", "label": "Enterprise"},
]

VALID_SALON_TYPE_VALUES = {item["value"] for item in SALON_TYPES}
VALID_SUBSCRIPTION_PLAN_VALUES = {item["value"] for item in SUBSCRIPTION_PLANS}
