import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import axios from 'axios';
import {
  faHome,
  faSignOutAlt,
  faChartBar,
  faCog,
  faBell,
  faTimes,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../../context/AuthContext.jsx';

const InstructorSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, userEmail } = useContext(AuthContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [profileData, setProfileData] = useState({
    firstname: '',
    lastname: '',
    image: ''
  });

  const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768 && isOpen) {
        onClose?.();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userEmail) return;
      
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('instructorToken');
        const res = await fetch(`${apiBase}/api/instructors/profile/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          setProfileData({
            firstname: data.firstname || '',
            lastname: data.lastname || '',
            image: data.image || ''
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfileData();
  }, [userEmail, apiBase]);

  const menuItems = [
    { path: '/instructor/dashboard', icon: faHome, label: 'Dashboard' },
    { path: '/instructor/notifications', icon: faBell, label: 'Notifications' },
    { path: '/instructor/reports', icon: faChartBar, label: 'Reports' },
    { path: '/instructor/settings', icon: faCog, label: 'Settings' }
  ];

  const handleLogout = async () => {
    try {
      // Log the logout activity
      if (userEmail) {
        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
        await axios.post(`${apiBase}/api/instructor-auth/logout`, {
          email: userEmail
        });
      }
    } catch (error) {
      console.error('Error logging logout activity:', error);
    }
    
    // Clear auth context and local storage
    logout();
    
    // Navigate to login
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          width: isMobile ? '280px' : '250px',
          background: 'linear-gradient(135deg, #0f2c63 60%, #ea580c 100%)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          position: isMobile ? 'fixed' : 'relative',
          height: isMobile ? '100vh' : 'auto',
          left: isMobile ? (isOpen ? 0 : '-280px') : 0,
          top: 0,
          transition: 'left 0.3s ease-in-out',
        }}
      >
        {/* Mobile Close Button */}
        {isMobile && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              zIndex: 1001,
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}

        {/* Profile Section */}
        <div style={{
          padding: isMobile ? '70px 20px 20px' : '30px 20px 20px',
          borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            background: 'rgba(255, 255, 255, 0.1)'
          }}>
            {profileData.image ? (
              <img
                src={profileData.image.startsWith('http') 
                  ? profileData.image 
                  : `${apiBase}${profileData.image.startsWith('/') ? '' : '/'}${profileData.image}`}
                alt="Profile"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.2)'
              }}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: '36px', color: 'rgba(255, 255, 255, 0.7)' }} />
              </div>
            )}
          </div>
          <div style={{
            textAlign: 'center',
            width: '100%'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '700',
              color: 'white',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 10px'
            }}>
              {profileData.firstname && profileData.lastname 
                ? `${profileData.firstname} ${profileData.lastname}`
                : 'Instructor'}
            </h3>
            {userEmail && (
              <p style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.8)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                padding: '0 10px'
              }}>
                {userEmail}
              </p>
            )}
          </div>
        </div>

      <nav className="sidebar-menu" style={{
        flex: 1,
        padding: '20px 0 10px 0'
      }}>
        {menuItems.map((item, index) => (
          <Link
            key={item.path}
            to={item.path}
            className={`menu-item ${location.pathname === item.path ? 'active' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '8px',
              padding: '15px 25px',
              color: location.pathname === item.path ? 'white' : 'rgba(255, 255, 255, 0.8)',
              textDecoration: 'none',
              margin: '2px 15px',
              borderRadius: '10px',
              fontWeight: '500',
              background: location.pathname === item.path ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              boxShadow: location.pathname === item.path ? 'inset 4px 0 0 #ffffff, 0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
              minHeight: '60px',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={() => {
              if (isMobile) {
                onClose?.();
              }
            }}
            onMouseEnter={(e) => {
              if (!isMobile && location.pathname !== item.path) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateX(8px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              } else if (!isMobile) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = 'inset 4px 0 0 #ffffff, 0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile && location.pathname !== item.path) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.transform = 'translateX(0) scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              } else if (!isMobile) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'inset 4px 0 0 #ffffff, 0 2px 8px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <FontAwesomeIcon
              icon={item.icon}
              style={{
                fontSize: '18px',
                width: '20px',
              }}
            />
            <span style={{ fontWeight: location.pathname === item.path ? '600' : '500', fontSize: '13px' }}>{item.label}</span>
            {location.pathname === item.path && (
              <div style={{
                position: 'absolute',
                bottom: '8px',
                width: '6px',
                height: '6px',
                background: '#ffffff',
                borderRadius: '50%',
              }} />
            )}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer" style={{
        padding: '20px'
      }}>
        <button
          className="logout-btn"
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '14px',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px) scale(0.98)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1)';
          }}
        >
          <FontAwesomeIcon icon={faSignOutAlt} style={{ fontSize: '16px' }} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default InstructorSidebar;