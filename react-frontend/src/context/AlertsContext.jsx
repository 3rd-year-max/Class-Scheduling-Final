import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

export const AlertsContext = createContext();

export const AlertsProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
    
    // Fetch initial alerts
    const fetchAlerts = async () => {
      try {
        const res = await axios.get(`${apiBase}/api/admin/alerts`);
        if (res.data.success) {
          setAlerts(res.data.alerts);
        }
      } catch (err) {
        console.error('Failed to load alerts', err);
      }
    };
    fetchAlerts();

    // Setup socket.io client, connect to backend server
    const socket = io(apiBase);

    // Listen for 'new-alert' events from backend
    socket.on('new-alert', alert => {
      setAlerts(prev => [alert, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const markAsRead = (id) => {
    setAlerts((prev) =>
      prev.map(alert => (alert._id === id ? { ...alert, read: true } : alert))
    );
  };

  const markAllAsRead = () => {
    setAlerts((prev) => prev.map(alert => ({ ...alert, read: true })));
  };

  const unreadCount = alerts.filter(alert => !alert.read).length;

  return (
    <AlertsContext.Provider
      value={{ alerts, setAlerts, markAsRead, markAllAsRead, unreadCount }}
    >
      {children}
    </AlertsContext.Provider>
  );
};
