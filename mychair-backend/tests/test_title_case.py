import pytest
from app.utils.title_case import to_title_case, format_proper_name_fields
from app.utils.user_name import user_display_name

class TestTitleCase:
    def test_example_suraj(self):
        assert to_title_case("suraj") == "Suraj"

    def test_example_suraj_malviya(self):
        assert to_title_case("sURAJ MALVIYA") == "Suraj Malviya"

    def test_example_rahul_kumar_sharma(self):
        assert to_title_case("rahul kumar sharma") == "Rahul Kumar Sharma"

    def test_example_my_chair_salon(self):
        assert to_title_case("my chair salon") == "My Chair Salon"

    def test_example_anita_dsouza(self):
        assert to_title_case("anita d'souza") == "Anita D'Souza"

    def test_null_or_empty(self):
        assert to_title_case(None) is None
        assert to_title_case("") == ""
        assert to_title_case("   ") == "   "

    def test_format_proper_name_fields_dict(self):
        data = {
            "first_name": "suraj",
            "last_name": "MALVIYA",
            "salon_name": "my chair salon",
            "email": "SURAJ@EXAMPLE.COM",
            "username": "suraj_123",
            "phone": "9876543210",
        }
        formatted = format_proper_name_fields(data)
        assert formatted["first_name"] == "Suraj"
        assert formatted["last_name"] == "Malviya"
        assert formatted["salon_name"] == "My Chair Salon"
        # Excluded fields must remain unmodified
        assert formatted["email"] == "SURAJ@EXAMPLE.COM"
        assert formatted["username"] == "suraj_123"
        assert formatted["phone"] == "9876543210"

    def test_user_display_name_formatted(self):
        user = {"first_name": "anita", "last_name": "d'souza"}
        assert user_display_name(user) == "Anita D'Souza"
