from typing import Optional
from app.core.config import settings

def normalize_public_url(path: Optional[str]) -> Optional[str]:
    """
    Normalizes a path to a fully qualified URL.
    If it's already an absolute URL (starts with http/https) or is empty, returns it as is.
    Otherwise, prepends settings.BACKEND_PUBLIC_URL.
    """
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://") or path.startswith("data:"):
        return path
    
    base_url = settings.BACKEND_PUBLIC_URL.rstrip("/")
    relative_path = path.lstrip("/")
    return f"{base_url}/{relative_path}"
