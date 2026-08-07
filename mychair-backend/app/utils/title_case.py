"""
Application-Wide Name Capitalization Rule:
All person and entity names displayed or stored in the application must automatically use Title Case,
where the first letter of every word is capitalized and the remaining letters are lowercase.

Examples:
- suraj -> Suraj
- sURAJ MALVIYA -> Suraj Malviya
- rahul kumar sharma -> Rahul Kumar Sharma
- my chair salon -> My Chair Salon
- anita d'souza -> Anita D'Souza
"""
import re
from typing import Optional, Any

_TITLE_CASE_BOUNDARY_REGEX = re.compile(r"(?:^|[\s\-'`\"(/&\.])([a-z])")

# Set of field names that represent proper names (person or entity names)
PROPER_NAME_FIELDS = {
    "first_name",
    "last_name",
    "full_name",
    "name",
    "customer_name",
    "client_name",
    "staff_name",
    "manager_name",
    "owner_name",
    "salon_name",
    "branch_name",
    "service_name",
    "product_name",
    "brand",
    "brand_name",
    "category",
    "category_name",
    "supplier",
    "supplier_name",
    "membership_name",
    "package_name",
    "department",
    "designation",
}

# Fields that MUST NOT be title-cased
EXCLUDED_FIELDS = {
    "email",
    "username",
    "password",
    "confirm_password",
    "new_password",
    "current_password",
    "phone",
    "alternate_phone",
    "salon_phone_number",
    "employee_code",
    "coupon_code",
    "gst",
    "gst_number",
    "invoice_number",
    "id",
    "branch_id",
    "employee_id",
    "tenant_id",
    "resetPasswordTokenHash",
    "sku",
    "barcode",
    "url",
    "avatar",
}


def to_title_case(val: Optional[str]) -> Optional[str]:
    """
    Converts a string to Title Case while preserving non-string, empty or None inputs.
    First letter of every word is capitalized and remaining letters are lowercase.
    """
    if val is None or not isinstance(val, str):
        return val
    if not val.strip():
        return val
    
    # Lowercase first, then capitalize letters at word boundaries
    lowered = val.lower()
    return _TITLE_CASE_BOUNDARY_REGEX.sub(lambda m: m.group(0).upper(), lowered)


def format_proper_name_fields(data: Any) -> Any:
    """
    Utility function to format proper name fields in a dict or model.
    """
    if isinstance(data, dict):
        updated = {}
        for key, value in data.items():
            if key in PROPER_NAME_FIELDS and key not in EXCLUDED_FIELDS and isinstance(value, str):
                updated[key] = to_title_case(value)
            elif isinstance(value, dict):
                updated[key] = format_proper_name_fields(value)
            elif isinstance(value, list):
                updated[key] = [format_proper_name_fields(v) for v in value]
            else:
                updated[key] = value
        return updated
    return data
