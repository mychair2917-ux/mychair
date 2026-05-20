from typing import Dict, List, Set
from fastapi import WebSocket

class WebSocketConnectionManager:
    """
    Manages active real-time WebSocket connections.
    Partitions connections by tenant_id and salon_id (branch) to guarantee strict isolation
    and performant message dispatching (e.g., receptionist live schedules).
    """
    def __init__(self) -> None:
        # Structure: { tenant_id: { salon_id: [websocket1, websocket2] } }
        self.active_connections: Dict[str, Dict[str, Set[WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, tenant_id: str, salon_id: str) -> None:
        """Accepts the websocket connection and registers it in the matching tenant/branch pool."""
        await websocket.accept()
        
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}
            
        if salon_id not in self.active_connections[tenant_id]:
            self.active_connections[tenant_id][salon_id] = set()
            
        self.active_connections[tenant_id][salon_id].add(websocket)

    def disconnect(self, websocket: WebSocket, tenant_id: str, salon_id: str) -> None:
        """Removes the connection safely from registry pools on socket termination."""
        if tenant_id in self.active_connections:
            if salon_id in self.active_connections[tenant_id]:
                self.active_connections[tenant_id][salon_id].discard(websocket)
                
                # Garbage collect empty structures
                if not self.active_connections[tenant_id][salon_id]:
                    del self.active_connections[tenant_id][salon_id]
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]

    async def broadcast_to_salon(self, tenant_id: str, salon_id: str, message: dict) -> None:
        """Dispatches real-time broadcast payload to all receptionists/stylists in a single salon branch."""
        if tenant_id in self.active_connections:
            if salon_id in self.active_connections[tenant_id]:
                dead_sockets = set()
                for connection in self.active_connections[tenant_id][salon_id]:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        dead_sockets.add(connection)
                
                # Cleanup closed sockets discovered during write
                for dead in dead_sockets:
                    self.disconnect(dead, tenant_id, salon_id)

    async def broadcast_to_tenant(self, tenant_id: str, message: dict) -> None:
        """Dispatches real-time broadcast payload across all salon branches under a single tenant subscription."""
        if tenant_id in self.active_connections:
            for salon_id in list(self.active_connections[tenant_id].keys()):
                await self.broadcast_to_salon(tenant_id, salon_id, message)

# Single global manager instance for route importing
manager = WebSocketConnectionManager()
