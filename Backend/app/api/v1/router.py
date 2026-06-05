from fastapi import APIRouter
from app.api.v1.endpoints import (
    appointments,
    auth,
    billing,
    customer_analytics,
    customers,
    employees,
    invitations,
    inventory,
    my_earnings,
    payroll,
    profile,
    reward_settings,
    salons,
    salon_owner,
    salon_products,
    salon_services,
    users,
    websocket,
)

api_router = APIRouter()

# Registering endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(invitations.router, prefix="/invites", tags=["Invitations"])
api_router.include_router(invitations.router, prefix="/invitations", tags=["Invitations (legacy)"])
api_router.include_router(salon_owner.router, prefix="/salon-owner", tags=["Salon Owner"])
api_router.include_router(salons.router, prefix="/salons", tags=["Salons"])
api_router.include_router(users.router, prefix="/users", tags=["Users & RBAC"])
api_router.include_router(employees.router, prefix="/employees", tags=["Salon Employees"])
api_router.include_router(salon_services.router, tags=["Salon Services"])
api_router.include_router(salon_products.router, tags=["Salon Products"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["Appointments & Calendar"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory & Ledger"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing & Payments"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["Payroll"])
api_router.include_router(my_earnings.router, prefix="/my-earnings", tags=["My Earnings"])
api_router.include_router(profile.router, prefix="/profile", tags=["Profile"])
api_router.include_router(websocket.router, tags=["WebSockets"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customer Management"])
api_router.include_router(customer_analytics.router, prefix="/customer-analytics", tags=["Customer Analytics"])
api_router.include_router(reward_settings.router, prefix="/reward-settings", tags=["Reward Settings"])
