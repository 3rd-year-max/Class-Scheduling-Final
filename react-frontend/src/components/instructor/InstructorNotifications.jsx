import React, { useState, useEffect, useContext, useCallback } from 'react';
import InstructorSidebar from '../common/InstructorSidebar.jsx';
import InstructorHeader from '../common/InstructorHeader.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheckCircle, faCheckDouble, faClock } from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext.jsx';
import { useToast } from '../common/ToastProvider.jsx';
import { io } from 'socket.io-client';

const InstructorNotifications = () => {
  const { userEmail } = useContext(AuthContext);
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'

  const getToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('instructorToken') || '';
  };

  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const token = getToken();
      
      if (!token) {
        console.error('No authentication token found');
        showToast('Please log in to view notifications', 'error');
        setLoading(false);
        return;
      }

      const url = `${apiBase}/api/instructor/notifications?page=${page}&limit=20`;
      console.log('Fetching notifications from:', url);
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `Server error: ${res.status} ${res.statusText}` };
        }
        throw new Error(errorData.message || `Failed to fetch: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      
      if (data.success) {
        let filtered = data.notifications;
        if (filter === 'unread') {
          filtered = filtered.filter(n => !n.read);
        } else if (filter === 'read') {
          filtered = filtered.filter(n => n.read);
        }
        
        setNotifications(filtered);
        setPagination(data.pagination || pagination);
        setUnreadCount(data.unreadCount || 0);
      } else {
        throw new Error(data.message || 'Failed to load notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      const errorMessage = error.message || 'Failed to load notifications. Please check if the backend server is running.';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [apiBase, filter, pagination, showToast]);

  useEffect(() => {
    // Check backend connectivity first
    const checkBackendConnection = async () => {
      try {
        const healthCheck = await fetch(`${apiBase}/api/instructor/notifications/health`);
        if (!healthCheck.ok) {
          console.error('Backend health check failed:', healthCheck.status);
          showToast('Backend server is not responding. Please check if the server is running.', 'error');
        }
      } catch (error) {
        console.error('Cannot connect to backend:', error);
        showToast(`Cannot connect to backend server. Please ensure the server is running on ${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}`, 'error');
      }
    };

    checkBackendConnection();

    if (userEmail) {
      fetchNotifications(pagination.page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, pagination.page, filter]);

  // Setup Socket.io for real-time notification updates
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_BASE || 'http://localhost:5000', { autoConnect: true });

    socket.on('connect', () => {
      console.log('✅ Connected to server for real-time notifications');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
    });

    socket.on('room-status-changed', (data) => {
      console.log('📢 Room status changed event received - refreshing notifications:', data);
      // Refresh notifications when a new room notification is created
      fetchNotifications(1);
      showToast(data.message, 'info');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchNotifications, showToast]);

  const markAsRead = async (id) => {
    try {
      const token = getToken();
      
      if (!token) {
        showToast('Please log in to mark notifications as read', 'error');
        return;
      }

      const res = await fetch(`${apiBase}/api/instructor/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to mark as read: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      showToast(error.message || 'Failed to mark notification as read', 'error');
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = getToken();
      
      if (!token) {
        showToast('Please log in to mark notifications as read', 'error');
        return;
      }

      const res = await fetch(`${apiBase}/api/instructor/notifications/read-all`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `Server error: ${res.status} ${res.statusText}` };
        }
        throw new Error(errorData.message || `Failed to mark all as read: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        // Update local state immediately for better UX
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        showToast('All notifications marked as read', 'success');
        
        // Refresh notifications to get updated data from server
        await fetchNotifications(pagination.page);
      } else {
        throw new Error(data.message || 'Failed to mark all as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      const errorMessage = error.message || 'Failed to mark all as read. Please check if the backend server is running.';
      showToast(errorMessage, 'error');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  return (
    <div className="dashboard-container" style={{ display: 'flex', height: '100vh' }}>
      <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <InstructorHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="dashboard-content" style={{ marginTop: '140px' }}>
          {/* Welcome Section */}
          <div className="welcome-section" style={{ 
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
            borderRadius: '16px',
            padding: '20px 24px',
            boxShadow: '0 10px 40px rgba(15, 44, 99, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <FontAwesomeIcon icon={faBell} style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <h2 style={{ 
                margin: 0, 
                color: '#ffffff', 
                fontSize: '24px', 
                fontWeight: '800',
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                letterSpacing: '-0.3px'
              }}>
                Notifications
              </h2>
            </div>
            <p style={{ 
              margin: 0, 
              color: 'rgba(255,255,255,0.95)', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
            </p>
            <div style={{ marginTop: '16px' }}>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'transform 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = ''}
                >
                  <FontAwesomeIcon icon={faCheckDouble} />
                  Mark All as Read
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            padding: '18px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            marginBottom: '20px',
            border: '1px solid rgba(15, 44, 99, 0.1)'
          }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['all', 'unread', 'read'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s ease',
                    background: filter === f 
                      ? 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)'
                      : '#f1f5f9',
                    color: filter === f ? 'white' : '#64748b'
                  }}
                >
                  {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read'} 
                  {f === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications List */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(15, 44, 99, 0.1)'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
                <p style={{ color: '#64748b', fontSize: '16px' }}>Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <FontAwesomeIcon 
                  icon={faBell} 
                  style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '20px' }} 
                />
                <h3 style={{ color: '#64748b', fontSize: '20px', fontWeight: '600', margin: '0 0 10px 0' }}>
                  {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                  {filter === 'unread' ? 'You\'re all caught up!' : 'You\'ll see notifications here when they arrive.'}
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification._id}
                      onClick={() => !notification.read && markAsRead(notification._id)}
                    style={{
                      padding: '18px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: notification.read ? 'rgba(15, 44, 99, 0.1)' : 'rgba(15, 44, 99, 0.2)',
                      background: notification.read 
                        ? 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' 
                        : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      cursor: notification.read ? 'default' : 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '15px',
                      boxShadow: notification.read 
                        ? '0 2px 8px rgba(0, 0, 0, 0.05)' 
                        : '0 4px 12px rgba(15, 44, 99, 0.15)'
                    }}
                      onMouseEnter={(e) => {
                        if (!notification.read) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)';
                          e.currentTarget.style.transform = 'translateX(4px) translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 44, 99, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!notification.read) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.15)';
                        }
                      }}
                    >
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: notification.read 
                          ? 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'
                          : 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <FontAwesomeIcon 
                          icon={notification.read ? faCheckCircle : faBell} 
                          style={{ color: 'white', fontSize: '18px' }} 
                        />
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '15px' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              margin: '0 0 8px 0',
                              color: '#1e293b',
                              fontSize: '16px',
                              fontWeight: notification.read ? '500' : '700'
                            }}>
                              {notification.title}
                            </h4>
                            <p style={{
                              margin: '0 0 8px 0',
                              color: '#64748b',
                              fontSize: '14px',
                              lineHeight: '1.6'
                            }}>
                              {notification.message}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FontAwesomeIcon icon={faClock} style={{ color: '#94a3b8', fontSize: '12px' }} />
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                                {formatTime(notification.createdAt)}
                              </span>
                            </div>
                          </div>
                          
                          {!notification.read && (
                            <div style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: '#f97316',
                              flexShrink: 0,
                              marginTop: '4px'
                            }}></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    marginTop: '30px',
                    paddingTop: '20px',
                    borderTop: '2px solid #e5e7eb'
                  }}>
                    <button
                      onClick={() => fetchNotifications(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: pagination.hasPrev 
                          ? 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)'
                          : '#e5e7eb',
                        color: pagination.hasPrev ? 'white' : '#9ca3af',
                        fontWeight: '600',
                        cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                        fontSize: '14px'
                      }}
                    >
                      Previous
                    </button>
                    
                    <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    
                    <button
                      onClick={() => fetchNotifications(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: pagination.hasNext 
                          ? 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)'
                          : '#e5e7eb',
                        color: pagination.hasNext ? 'white' : '#9ca3af',
                        fontWeight: '600',
                        cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                        fontSize: '14px'
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstructorNotifications;
