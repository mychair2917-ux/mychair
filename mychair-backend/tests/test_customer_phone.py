"""Unit tests for shared customer phone uniqueness helpers."""
from app.services.customer_phone import (
    customer_display_name,
    duplicate_phone_exists_message,
    duplicate_phone_in_upload_message,
    duplicate_phone_message,
)
from app.utils.phone import normalize_mobile, phone_lookup_variants


class TestDuplicateMessages:
    def test_manual_create_message_includes_name(self):
        msg = duplicate_phone_message("Rahul Sharma")
        assert msg == (
            "This phone number is already registered to an existing client: Rahul Sharma."
        )

    def test_upload_file_duplicate_message(self):
        msg = duplicate_phone_in_upload_message("9876543210")
        assert "9876543210" in msg
        assert "duplicated in the upload" in msg
        assert "First occurrence was imported" in msg

    def test_upload_db_duplicate_message(self):
        msg = duplicate_phone_exists_message("9876543210", "Priya")
        assert msg == "Phone number 9876543210 already exists for client Priya."


class TestPhoneNormalizeShared:
    def test_variants_include_common_formats(self):
        variants = phone_lookup_variants("9876543210")
        assert "9876543210" in variants
        assert "919876543210" in variants
        assert "+919876543210" in variants

    def test_normalize_aligns_with_import(self):
        phone, err = normalize_mobile("+91 98765 43210")
        assert err is None
        assert phone == "9876543210"

    def test_normalize_alphanumeric_client_id(self):
        from app.utils.phone import is_client_reference_id

        assert is_client_reference_id("CL-A8K9P2") is True
        assert is_client_reference_id("cl-7x9b4m") is True
        assert is_client_reference_id("CL-123456") is True
        assert is_client_reference_id("9876543210") is False

        phone, err = normalize_mobile("cl-a8k9p2")
        assert err is None
        assert phone == "CL-A8K9P2"

        variants = phone_lookup_variants("CL-A8K9P2")
        assert variants == ["CL-A8K9P2"]


class FakeCustomer:
    def __init__(self, first_name: str, last_name: str = ""):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class TestDisplayName:
    def test_full_name(self):
        assert customer_display_name(FakeCustomer("Rahul", "Sharma")) == "Rahul Sharma"

    def test_blank_falls_back(self):
        assert customer_display_name(FakeCustomer("", "")) == "Unknown"


class TestCustomerQuickCreateSchema:
    def test_customer_quick_create_genders(self):
        from app.schemas.appointment import CustomerQuickCreate

        c1 = CustomerQuickCreate(name="Test", phone="9876543210", gender="MALE")
        assert c1.gender == "MALE"

        c2 = CustomerQuickCreate(name="Test", phone="9876543210", gender="female")
        assert c2.gender == "FEMALE"

        c3 = CustomerQuickCreate(name="Test", phone="9876543210", gender="OTHER")
        assert c3.gender == "OTHER"

        c4 = CustomerQuickCreate(name="Test", phone="9876543210", gender="prefer_not_to_say")
        assert c4.gender == "PREFER_NOT_TO_SAY"

        c5 = CustomerQuickCreate(name="Test", phone="9876543210", gender=None)
        assert c5.gender is None
