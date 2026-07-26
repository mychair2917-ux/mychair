from app.utils.user_name import user_display_name


class FakeUser:
    def __init__(self, first_name=None, last_name=None, username=None, email=None, full_name=None):
        self.first_name = first_name
        self.last_name = last_name
        self.username = username
        self.email = email
        self.full_name = full_name


class TestUserDisplayName:
    def test_prefers_first_and_last_name(self):
        assert user_display_name(FakeUser("Suraj", "Malviya", email="a@b.com")) == "Suraj Malviya"

    def test_never_returns_email(self):
        assert user_display_name(FakeUser(email="owner@salon.com")) == "Unknown"

    def test_uses_username_when_name_missing(self):
        assert user_display_name(FakeUser(username="test_name", email="a@b.com")) == "Test Name"

    def test_keeps_stored_name_even_if_role_like(self):
        assert user_display_name(FakeUser("Super", "Admin", email="a@b.com")) == "Super Admin"

    def test_ignores_email_shaped_full_name(self):
        assert user_display_name(FakeUser(full_name="owner@salon.com")) == "Unknown"

    def test_dict_payload(self):
        assert user_display_name({"first_name": "Priya", "last_name": "Sharma"}) == "Priya Sharma"
