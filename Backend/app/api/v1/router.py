from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, appointments, inventory, billing, websocket, invitations, salon_owner

api_router = APIRouter()

# Registering endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(invitations.router, prefix="/invites", tags=["Invitations"])
api_router.include_router(invitations.router, prefix="/invitations", tags=["Invitations (legacy)"])
api_router.include_router(salon_owner.router, prefix="/salon-owner", tags=["Salon Owner"])
api_router.include_router(users.router, prefix="/users", tags=["Users & RBAC"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments & Calendar"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory & Ledger"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing & Payments"])
api_router.include_router(websocket.router, tags=["WebSockets"])
