import { getWebSocketBaseUrl } from '../config/api';

export interface WebSocketNotificationResponse {
  id?: string;
  type?: string;
  message?: string;
  payload?: unknown;
}

type WebSocketCallback = (data: WebSocketNotificationResponse) => void;
type WebSocketErrorCallback = (error: Event) => void;

/**
 * Establishes a WebSocket connection for real-time user notifications.
 */
export const notificationWebSocket = (
  organizationId: string,
  userId: string,
  onMessageCallback?: WebSocketCallback,
  onErrorCallback?: WebSocketErrorCallback
): WebSocket => {
  const url = `${getWebSocketBaseUrl()}ws/user/${organizationId}/${userId}`;
  const socket = new WebSocket(url);

  socket.onmessage = (event: MessageEvent) => {
    try {
      const data: WebSocketNotificationResponse = JSON.parse(event.data);
      onMessageCallback?.(data);
    } catch {
      // Ignore malformed payloads — do not surface debug noise in production.
    }
  };

  socket.onerror = (error: Event) => {
    onErrorCallback?.(error);
  };

  return socket;
};

/** Safely close a WebSocket connection if it is still open. */
export const closeWebSocket = (socket: WebSocket | null, reason?: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(1000, reason || 'Client closing connection');
  }
};
