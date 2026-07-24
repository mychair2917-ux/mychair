from typing import Any, Dict, Optional
from fastapi import HTTPException, status

class SalonERPException(HTTPException):
    def __init__(
        self,
        status_code: int,
        detail: Any = None,
        headers: Optional[Dict[str, str]] = None
    ) -> None:
        super().__init__(status_code=status_code, detail=detail, headers=headers)

class TenantAccessDeniedException(SalonERPException):
    def __init__(self, detail: str = "Access to this tenant is denied or not authorized") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        
class AuthException(SalonERPException):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )

class PermissionDeniedException(SalonERPException):
    def __init__(self, detail: str = "You do not have permission to perform this action") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class ResourceNotFoundException(SalonERPException):
    def __init__(self, detail: str = "Requested resource not found") -> None:
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class BookingConflictException(SalonERPException):
    def __init__(self, detail: str = "Booking conflict: Staff is unavailable or time slot overlaps") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)

class ImmutableResourceException(SalonERPException):
    def __init__(self, detail: str = "This invoice is finalized and cannot be modified") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

class InsufficientStockException(SalonERPException):
    def __init__(self, detail: str = "Insufficient inventory stock for this operation") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
