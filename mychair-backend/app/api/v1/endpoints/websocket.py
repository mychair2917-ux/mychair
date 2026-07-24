from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.websocket import manager
import logging

router = APIRouter()
logger = logging.getLogger("websocket")

@router.websocket("/ws/{tenant_id}/{salon_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    tenant_id: str,
    salon_id: str,
    user_id: Optional[str] = Query(default=None),
) -> None:
    """
    Establish persistent WebSocket duplex connection for live updates.
    Routes live updates (e.g. appointment modifications) dynamically to connected branch screens.
    """
    await manager.connect(websocket, tenant_id, salon_id, user_id=user_id)
    logger.info(f"WebSocket client connected. Tenant: {tenant_id}, Salon: {salon_id}")
    
    try:
        while True:
            # Persistent listener loop to catch incoming messages or keepalive pings
            data = await websocket.receive_json()
            
            # Simple echoing or custom message routing if requested by clients
            await websocket.send_json({"echo": data})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, tenant_id, salon_id, user_id=user_id)
        logger.info(f"WebSocket client disconnected gracefully. Tenant: {tenant_id}, Salon: {salon_id}")
    except Exception as e:
        manager.disconnect(websocket, tenant_id, salon_id, user_id=user_id)
        logger.error(f"WebSocket client disconnected due to error: {str(e)}")
