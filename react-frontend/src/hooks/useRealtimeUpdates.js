import { useEffect, useCallback } from 'react';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Hook for subscribing to real-time data updates via Socket.io
 * Only updates state when data actually changes, preventing unnecessary re-renders
 * 
 * @param {string} eventName - The Socket.io event name to listen for (e.g., 'data-updated:rooms')
 * @param {Function} setData - State setter function for the data
 * @param {Function} socket - Socket.io instance (from context or props)
 * @param {boolean} enabled - Whether to subscribe (default: true)
 * 
 * Example usage:
 * const [rooms, setRooms] = useState([]);
 * useRealtimeDataUpdates('data-updated:rooms', setRooms, socket);
 */
export const useRealtimeDataUpdates = (eventName, setData, socket, enabled = true) => {
  useEffect(() => {
    if (!socket || !enabled || !eventName) {
      return;
    }

    // Subscribe to the event
    const handleDataUpdate = (payload) => {
      console.log(`📡 Received update for ${eventName}:`, payload);
      
      if (payload && payload.data) {
        // Only update state if data actually changed
        setData(payload.data);
      }
    };

    socket.on(eventName, handleDataUpdate);

    // Cleanup listener on unmount or when dependencies change
    return () => {
      socket.off(eventName, handleDataUpdate);
    };
  }, [eventName, setData, socket, enabled]);
};

/**
 * Hook for subscribing to multiple real-time data updates at once
 * 
 * @param {Object} subscriptions - Object mapping eventName to setState function
 * @param {Function} socket - Socket.io instance
 * @param {boolean} enabled - Whether to subscribe (default: true)
 * 
 * Example usage:
 * useRealtimeMultipleUpdates({
 *   'data-updated:rooms': setRooms,
 *   'data-updated:schedules': setSchedules,
 *   'data-updated:instructors': setInstructors
 * }, socket);
 */
export const useRealtimeMultipleUpdates = (subscriptions, socket, enabled = true) => {
  const handleDataUpdate = useCallback((eventName, setData) => {
    return (payload) => {
      console.log(`📡 Received update for ${eventName}:`, payload);
      if (payload && payload.data) {
        setData(payload.data);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket || !enabled || !subscriptions) {
      return;
    }

    const unsubscribers = [];

    // Subscribe to all events
    Object.entries(subscriptions).forEach(([eventName, setData]) => {
      const handler = handleDataUpdate(eventName, setData);
      socket.on(eventName, handler);
      
      // Store unsubscriber function
      unsubscribers.push(() => {
        socket.off(eventName, handler);
      });
    });

    // Cleanup all listeners on unmount or when dependencies change
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [socket, enabled, subscriptions, handleDataUpdate]);
};

/**
 * Hook for lazy socket connection with auto-reconnect
 * Returns socket instance when ready
 */
export const useSocket = () => {
  const { userEmail } = useContext(AuthContext);
  const [socket, setSocket] = (globalThis.socketState = globalThis.socketState || [null, () => {}]);

  useEffect(() => {
    if (socket) return; // Already connected

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
        const newSocket = io(apiBase, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
          console.log('🔌 Socket.io connected:', newSocket.id);
        });

        newSocket.on('disconnect', () => {
          console.log('🔌 Socket.io disconnected');
        });

        setSocket(newSocket);
      } catch (error) {
        console.error('Failed to initialize Socket.io:', error);
      }
    };

    connectSocket();
  }, [socket, setSocket]);

  return socket;
};

export default {
  useRealtimeDataUpdates,
  useRealtimeMultipleUpdates,
  useSocket
};
