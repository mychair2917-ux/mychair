import { WS_BASE_URL } from './config';

export interface WebSocketNotificationResponse {
  id?: string;
  type?: string;
  message?: string;
  payload?: any;
}

type WebSocketCallback = (data: WebSocketNotificationResponse) => void;
type WebSocketErrorCallback = (error: Event) => void;

/**
  Establishes and manages a WebSocket connection for real-time user notifications.

  This utility provides a function to initiate a WebSocket connection for a given
  user and organization, handling incoming messages, connection lifecycle events,
  and errors. Also includes a helper to safely close the connection.

  Parameters:
  @param {string} organizationId - The user's organization ID.
  @param {string} userId - The user's user ID.
  @param {Function} [onMessageCallback] - Optional callback triggered when a message is received.
  @param {Function} [onErrorCallback] - Optional callback triggered when a WebSocket error occurs.

  Returns:
  @returns {WebSocket} - The active WebSocket connection instance.

  Exception Handling:
  - Tries to parse WebSocket messages safely and logs parsing errors.
  - Exposes a safe `closeWebSocket` utility to close the socket only if it's open.
*/

export const notificationWebSocket = (
  organizationId: string,
  userId: string,
  onMessageCallback?: WebSocketCallback,
  onErrorCallback?: WebSocketErrorCallback
): WebSocket => {
  const url = `${WS_BASE_URL}ws/user/${organizationId}/${userId}`;
  const socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('WebSocket connected:');
  };

  socket.onmessage = (event: MessageEvent) => {
    try {
      console.log('WebSocket message received:', {
        data: event.data,
        timestamp: new Date().toISOString(),
      });

      const data: WebSocketNotificationResponse = JSON.parse(event.data);
      if (onMessageCallback) {
        onMessageCallback(data);
      }
    } catch (error) {
      console.error('WebSocket message parsing error:', {
        error,
        rawData: event.data,
        timestamp: new Date().toISOString(),
      });
    }
  };

  socket.onclose = (event: CloseEvent) => {
    console.log('WebSocket connection closed:', {
      code: event.code,
      reason: event.reason || 'No reason provided',
      wasClean: event.wasClean,
      timestamp: new Date().toISOString(),
    });
  };

  socket.onerror = (error: Event) => {
    console.error('WebSocket error occurred:', {
      error,
      readyState: socket.readyState,
      url,
      timestamp: new Date().toISOString(),
    });

    if (onErrorCallback) {
      onErrorCallback(error);
    }
  };

  return socket;
};

/**
 * Utility function to safely close a WebSocket connection
 */
export const closeWebSocket = (socket: WebSocket | null, reason?: string) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('Closing WebSocket connection:', reason || 'Manual close');
    socket.close(1000, reason || 'Client closing connection');
  }
};
