"""Detect JPEG/PNG from file bytes (stdlib-only; replaces removed imghdr)."""


def detect_image_type(content: bytes) -> str | None:
    """
    Return image subtype compatible with legacy imghdr.what(): 'jpeg' or 'png'.
    Returns None when the bytes are not a supported image format.
    """
    if len(content) >= 3 and content[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if len(content) >= 8 and content[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return None
