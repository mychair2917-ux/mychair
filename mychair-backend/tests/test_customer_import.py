"""Unit tests for customer bulk-import validation helpers."""
import pytest

from app.services.customer_import import (
    REASON_DUPLICATE,
    REASON_INVALID_MOBILE,
    REASON_MISSING_MOBILE,
    REASON_MISSING_NAME,
    map_headers,
    normalize_email,
    normalize_gender,
    normalize_mobile,
    parse_import_date,
    parse_rows_from_bytes,
    split_full_name,
    validate_data_rows,
    validate_upload_file,
    CustomerImportError,
    build_csv_template,
    build_xlsx_template,
    build_error_report_csv,
    RowError,
)


class TestNormalizeMobile:
    def test_strips_spaces_dashes_brackets(self):
        phone, err = normalize_mobile("(987) 654-3210")
        assert err is None
        assert phone == "9876543210"

    def test_strips_plus_91(self):
        phone, err = normalize_mobile("+91 98765 43210")
        assert err is None
        assert phone == "9876543210"

    def test_strips_leading_zero(self):
        phone, err = normalize_mobile("09876543210")
        assert err is None
        assert phone == "9876543210"

    def test_rejects_alphabets(self):
        phone, err = normalize_mobile("98765ABC10")
        assert phone is None
        assert err == REASON_INVALID_MOBILE

    def test_rejects_short(self):
        phone, err = normalize_mobile("12345")
        assert phone is None
        assert err == REASON_INVALID_MOBILE

    def test_missing(self):
        phone, err = normalize_mobile("   ")
        assert phone is None
        assert err == REASON_MISSING_MOBILE

    def test_excel_float(self):
        phone, err = normalize_mobile(9876543210.0)
        assert err is None
        assert phone == "9876543210"


class TestSplitFullName:
    def test_splits_first_last(self):
        first, last, err = split_full_name("  Priya Sharma  ")
        assert err is None
        assert first == "Priya"
        assert last == "Sharma"

    def test_single_name(self):
        first, last, err = split_full_name("Priya")
        assert err is None
        assert first == "Priya"
        assert last == ""

    def test_blank_rejected(self):
        first, last, err = split_full_name("   ")
        assert first is None
        assert err == REASON_MISSING_NAME


class TestParseDate:
    def test_dmy(self):
        dt, err = parse_import_date("15/03/1990")
        assert err is None
        assert dt.year == 1990 and dt.month == 3 and dt.day == 15

    def test_iso(self):
        dt, err = parse_import_date("1990-03-15")
        assert err is None
        assert dt.day == 15

    def test_empty_ok(self):
        dt, err = parse_import_date("")
        assert dt is None and err is None

    def test_invalid(self):
        dt, err = parse_import_date("not-a-date")
        assert dt is None and err


class TestGenderAndEmail:
    def test_gender_aliases(self):
        assert normalize_gender("f")[0] == "FEMALE"
        assert normalize_gender("Male")[0] == "MALE"
        assert normalize_gender("other")[0] == "OTHER"

    def test_invalid_gender(self):
        g, err = normalize_gender("unknown")
        assert g is None and err

    def test_email(self):
        email, err = normalize_email("  a@b.com ")
        assert err is None
        assert email == "a@b.com"

    def test_bad_email(self):
        email, err = normalize_email("not-an-email")
        assert email is None and err


class TestHeadersAndCsv:
    def test_header_aliases(self):
        mapping = map_headers(["Full Name", "Mobile Number", "Email"])
        assert mapping["full_name"] == 0
        assert mapping["mobile"] == 1
        assert mapping["email"] == 2

    def test_parse_csv_happy(self):
        raw = (
            "Full Name,Mobile Number,Email\n"
            "Priya Sharma,9876543210,priya@example.com\n"
            "Rahul,9123456780,\n"
        ).encode("utf-8")
        mapping, rows = parse_rows_from_bytes(raw, ".csv")
        assert len(rows) == 2
        valid, errors, reasons = validate_data_rows(mapping, rows)
        assert len(valid) == 2
        assert not errors

    def test_parse_csv_missing_headers(self):
        raw = b"Name,Phone\nA,1\n"
        with pytest.raises(CustomerImportError):
            parse_rows_from_bytes(raw, ".csv")

    def test_duplicate_in_file(self):
        raw = (
            "Full Name,Mobile Number\n"
            "A,9876543210\n"
            "B,9876543210\n"
        ).encode("utf-8")
        mapping, rows = parse_rows_from_bytes(raw, ".csv")
        valid, errors, reasons = validate_data_rows(mapping, rows)
        assert len(valid) == 1
        assert reasons.get(REASON_DUPLICATE) == 1
        assert errors[0].status == "skipped"

    def test_missing_required(self):
        raw = (
            "Full Name,Mobile Number\n"
            ",9876543210\n"
            "Priya,\n"
        ).encode("utf-8")
        mapping, rows = parse_rows_from_bytes(raw, ".csv")
        valid, errors, reasons = validate_data_rows(mapping, rows)
        assert len(valid) == 0
        assert reasons.get(REASON_MISSING_NAME) == 1
        assert reasons.get(REASON_MISSING_MOBILE) == 1


class TestFileValidation:
    def test_rejects_large(self):
        with pytest.raises(CustomerImportError):
            validate_upload_file("a.csv", "text/csv", 21 * 1024 * 1024)

    def test_rejects_exe_ext(self):
        with pytest.raises(CustomerImportError):
            validate_upload_file("malware.exe", "application/octet-stream", 100)

    def test_accepts_csv(self):
        assert validate_upload_file("clients.csv", "text/csv", 100) == ".csv"


class TestTemplates:
    def test_csv_template_headers(self):
        content = build_csv_template().decode("utf-8-sig")
        assert content.startswith("Full Name,Mobile Number")

    def test_xlsx_template_bytes(self):
        content = build_xlsx_template()
        assert content[:2] == b"PK"

    def test_error_report(self):
        csv_bytes = build_error_report_csv(
            [
                RowError(
                    row=2,
                    mobile="999",
                    reason=REASON_INVALID_MOBILE,
                    status="failed",
                    full_name="X",
                    original={"full_name": "X", "mobile": "999"},
                )
            ]
        )
        text = csv_bytes.decode("utf-8-sig")
        assert "Invalid Mobile" in text
        assert "Error Message" in text
