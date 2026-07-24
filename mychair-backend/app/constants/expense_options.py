"""Lookup values for expense categories and payment modes."""

EXPENSE_CATEGORIES = [
    {"value": "rent", "label": "Rent"},
    {"value": "electricity", "label": "Electricity"},
    {"value": "water_bill", "label": "Water Bill"},
    {"value": "internet", "label": "Internet"},
    {"value": "salary", "label": "Salary"},
    {"value": "staff_incentive", "label": "Staff Incentive"},
    {"value": "product_purchase", "label": "Product Purchase"},
    {"value": "inventory_purchase", "label": "Inventory Purchase"},
    {"value": "maintenance", "label": "Maintenance"},
    {"value": "repair", "label": "Repair"},
    {"value": "marketing", "label": "Marketing"},
    {"value": "advertisement", "label": "Advertisement"},
    {"value": "laundry", "label": "Laundry"},
    {"value": "cleaning", "label": "Cleaning"},
    {"value": "stationary", "label": "Stationary"},
    {"value": "tea_coffee", "label": "Tea/Coffee"},
    {"value": "travel", "label": "Travel"},
    {"value": "training", "label": "Training"},
    {"value": "software_subscription", "label": "Software Subscription"},
    {"value": "equipment_purchase", "label": "Equipment Purchase"},
    {"value": "furniture", "label": "Furniture"},
    {"value": "petty_cash", "label": "Petty Cash"},
    {"value": "tax", "label": "Tax"},
    {"value": "gst", "label": "GST"},
    {"value": "courier", "label": "Courier"},
    {"value": "miscellaneous", "label": "Miscellaneous"},
]

PAYMENT_MODES = [
    {"value": "cash", "label": "Cash"},
    {"value": "upi", "label": "UPI"},
    {"value": "card", "label": "Card"},
    {"value": "bank_transfer", "label": "Bank Transfer"},
    {"value": "cheque", "label": "Cheque"},
    {"value": "wallet", "label": "Wallet"},
    {"value": "other", "label": "Other"},
]

VALID_CATEGORY_VALUES = {item["value"] for item in EXPENSE_CATEGORIES}
VALID_PAYMENT_MODE_VALUES = {item["value"] for item in PAYMENT_MODES}

CATEGORY_LABELS = {item["value"]: item["label"] for item in EXPENSE_CATEGORIES}
PAYMENT_MODE_LABELS = {item["value"]: item["label"] for item in PAYMENT_MODES}
