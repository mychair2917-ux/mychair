"""Lookup values for the salon owner invitation form."""

from app.constants.subscription_options import SUBSCRIPTION_PLANS, VALID_SUBSCRIPTION_PLAN_VALUES

SALON_TYPES = [
    {"value": "mens", "label": "Men's"},
    {"value": "females", "label": "Female's"},
    {"value": "unisex", "label": "Unisex"},
]

VALID_SALON_TYPE_VALUES = {item["value"] for item in SALON_TYPES}
