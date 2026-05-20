from typing import List, Optional, Dict
from pydantic import Field
from app.models.base import BaseTenantDocument

class Staff(BaseTenantDocument):
    """
    Represents professional details of a staff member (stylist, therapist, etc.).
    Linked to a corresponding User credentials record.
    """
    user_id: str = Field(..., index=True)  # Reference to User document ID
    salon_ids: List[str] = Field(default_factory=list, index=True)  # Branches they can work in
    
    title: Optional[str] = Field(default=None)  # e.g., 'Senior Stylist', 'Nail Artist'
    skills: List[str] = Field(default_factory=list)  # Service category IDs or names they are skilled in
    
    # Payroll/Commission parameters
    commission_rate: float = Field(default=0.0)  # Commission percentage (e.g. 10.0 for 10%)
    base_salary: float = Field(default=0.0)
    
    is_active: bool = Field(default=True)

    class Settings:
        name = "staff"
        indexes = [
            "tenant_id",
            "user_id",
            "is_deleted",
        ]


class StaffSchedule(BaseTenantDocument):
    """
    Tracks recurring or specific working hours and breaks for a staff member.
    Crucial for checking appointment booking availability.
    """
    staff_id: str = Field(..., index=True)  # Ref to Staff document ID
    salon_id: str = Field(..., index=True)  # Ref to Salon branch ID
    
    # Day schedules: 0 = Monday, 6 = Sunday
    # For a specific date or recurring weekly
    day_of_week: Optional[int] = Field(default=None, ge=0, le=6)  # If None, it applies to specific_date
    specific_date: Optional[str] = Field(default=None)  # ISO Date String 'YYYY-MM-DD' (e.g., custom day off/holiday)
    
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")  # e.g. "09:00"
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")  # e.g. "18:00"
    
    # Breaks - lightweight nested list
    breaks: List[Dict[str, str]] = Field(default_factory=list)  # e.g. [{"start": "13:00", "end": "14:00"}]
    
    is_available: bool = Field(default=True)  # False if on leave

    class Settings:
        name = "staff_schedules"
        indexes = [
            "tenant_id",
            "staff_id",
            "salon_id",
            "day_of_week",
            "specific_date",
            "is_deleted",
        ]
