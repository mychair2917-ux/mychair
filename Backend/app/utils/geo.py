"""Geolocation helpers for attendance validation."""

import math
from typing import Optional


def haversine_distance_meters(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Return great-circle distance between two coordinates in meters."""
    earth_radius_m = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_m * c


def is_within_radius(
    employee_lat: float,
    employee_lon: float,
    branch_lat: float,
    branch_lon: float,
    radius_meters: int,
) -> tuple[bool, float]:
    """Check if employee coordinates fall within the branch attendance radius."""
    distance = haversine_distance_meters(
        employee_lat, employee_lon, branch_lat, branch_lon
    )
    return distance <= radius_meters, round(distance, 2)


def validate_coordinates(lat: Optional[float], lon: Optional[float]) -> None:
    """Raise ValueError when coordinates are missing or out of range."""
    if lat is None or lon is None:
        raise ValueError("Location coordinates are required")
    if not (-90 <= lat <= 90):
        raise ValueError("Invalid latitude")
    if not (-180 <= lon <= 180):
        raise ValueError("Invalid longitude")
