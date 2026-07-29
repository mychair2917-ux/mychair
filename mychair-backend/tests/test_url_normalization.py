from app.utils.url import normalize_public_url
from app.core.config import settings

def test_normalize_public_url_none():
    assert normalize_public_url(None) is None
    assert normalize_public_url("") is None

def test_normalize_public_url_already_absolute():
    http_url = "http://example.com/image.png"
    https_url = "https://example.com/image.png"
    data_url = "data:image/png;base64,iVBORw0KGgoAAA"
    
    assert normalize_public_url(http_url) == http_url
    assert normalize_public_url(https_url) == https_url
    assert normalize_public_url(data_url) == data_url

def test_normalize_public_url_relative():
    relative_path_with_slash = "/api/v1/profile/avatar-files/test.png"
    relative_path_without_slash = "api/v1/profile/avatar-files/test.png"
    
    base_url = settings.BACKEND_PUBLIC_URL.rstrip("/")
    expected = f"{base_url}/api/v1/profile/avatar-files/test.png"
    
    assert normalize_public_url(relative_path_with_slash) == expected
    assert normalize_public_url(relative_path_without_slash) == expected
