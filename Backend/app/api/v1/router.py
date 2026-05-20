from fastapi import APIRouter
from app.api.v1.endpoints import auth, appointments, inventory, billing, websocket

api_router = APIRouter()

# Registering endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments & Calendar"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory & Ledger"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing & Payments"])
api_router.include_router(websocket.router, tags=["WebSockets"])
