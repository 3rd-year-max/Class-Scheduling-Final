import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const settingsOptions = [
    {
      id: 'activity-logs',
      title: 'Activity Logs',
      description: 'View and manage comprehensive system activity logs, track user actions, monitor audit trails, and analyze system events for security and compliance purposes',
      icon: faClipboardList,
      color: '#0f2c63',
      bgGradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
      action: () => navigate('/admin/activity-logs'),
    },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          marginLeft: 0,
          background: '#fafafa'
        }}
      >
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <div style={{ 
          padding: '32px 24px', 
          marginTop: '100px', 
          flex: 1, 
          background: '#fafafa',
          maxWidth: '1200px',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%'
        }}>
          {/* Header Section */}
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '40px',
            paddingBottom: '24px',
            borderBottom: '2px solid rgba(15, 44, 99, 0.08)'
          }}>
            <h1 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '30px', 
              fontWeight: '800', 
              color: '#1e293b', 
              letterSpacing: '-0.6px', 
              background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}>
              System Settings
            </h1>
            <p style={{ 
              margin: '0', 
              color: '#64748b', 
              fontSize: '15px', 
              lineHeight: '1.6', 
              fontWeight: '400', 
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Manage system configuration, monitor activities, and maintain system integrity
            </p>
          </div>

          {/* Main Content Layout - Enhanced */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxWidth: '800px',
            margin: '0 auto',
            alignItems: 'stretch',
          }}>
            {/* Settings Card - Enhanced Placement */}
            {settingsOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={option.action}
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 20px rgba(15, 44, 99, 0.1), 0 0 0 1px rgba(15, 44, 99, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: '1px solid rgba(15, 44, 99, 0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(15, 44, 99, 0.15), 0 0 0 1px rgba(15, 44, 99, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 44, 99, 0.1), 0 0 0 1px rgba(15, 44, 99, 0.08)';
                  }}
                >
                {/* Compact Top Section with Gradient */}
                <div
                  style={{
                    height: '80px',
                    background: `linear-gradient(135deg, ${option.color} 0%, #1e40af 100%)`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Subtle Decorative Pattern */}
                  <div style={{
                    position: 'absolute',
                    top: '-30%',
                    right: '-15%',
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    filter: 'blur(30px)',
                  }} />
                  
                  {/* Icon Container - Compact Floating */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '-25px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60px',
                      height: '60px',
                      borderRadius: '14px',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '26px',
                      color: option.color,
                      boxShadow: '0 6px 20px rgba(15, 44, 99, 0.2), 0 2px 8px rgba(15, 44, 99, 0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: '3px solid #ffffff',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(-50%) rotate(5deg) scale(1.08)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(15, 44, 99, 0.25), 0 4px 12px rgba(15, 44, 99, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(-50%) rotate(0deg) scale(1)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 44, 99, 0.2), 0 2px 8px rgba(15, 44, 99, 0.1)';
                    }}
                  >
                    <FontAwesomeIcon icon={option.icon} />
                  </div>
                </div>

                {/* Content Section - Compact */}
                <div style={{ padding: '44px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                  {/* Title */}
                  <div>
                    <h3
                      style={{
                        margin: '0 0 10px 0',
                        color: '#1e293b',
                        fontSize: '20px',
                        fontWeight: '800',
                        letterSpacing: '-0.4px',
                      }}
                    >
                      {option.title}
                    </h3>

                    {/* Description */}
                    <p
                      style={{
                        margin: '0',
                        color: '#475569',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        maxWidth: '420px',
                        fontWeight: '400',
                      }}
                    >
                      {option.description}
                    </p>
                  </div>

                  {/* Action Button - Compact */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      option.action();
                    }}
                    style={{
                      background: `linear-gradient(135deg, ${option.color} 0%, #1e40af 100%)`,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 28px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: `0 4px 16px ${option.color}25`,
                      minWidth: '180px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 6px 24px ${option.color}35`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 4px 16px ${option.color}25`;
                    }}
                  >
                    <FontAwesomeIcon icon={option.icon} />
                    <span>View Activity Logs</span>
                  </button>
                </div>
              </div>
            ))}

            {/* Info Section - Enhanced Placement */}
            <div style={{
              background: '#ffffff',
              border: '1px solid rgba(15, 44, 99, 0.1)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(15, 44, 99, 0.08), 0 0 0 1px rgba(15, 44, 99, 0.05)',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(15, 44, 99, 0.12), 0 0 0 1px rgba(15, 44, 99, 0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 44, 99, 0.08), 0 0 0 1px rgba(15, 44, 99, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              {/* Decorative Accent */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: '#f97316',
                borderRadius: '16px 0 0 16px',
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingLeft: '4px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fde68a',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.15)',
                }}>
                  <FontAwesomeIcon icon={faGear} style={{ fontSize: '20px', color: '#f97316' }} />
                </div>
                <div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.3px' }}>System Information</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Key features and capabilities</p>
                </div>
              </div>
              
              <div style={{ paddingLeft: '4px' }}>
                <ul style={{ margin: 0, paddingLeft: '0', lineHeight: '1.7', fontSize: '14px', listStyle: 'none', display: 'grid', gap: '12px' }}>
                  <li style={{ 
                    position: 'relative', 
                    paddingLeft: '24px', 
                    fontWeight: '400', 
                    color: '#475569',
                    padding: '10px 14px',
                    background: 'rgba(15, 44, 99, 0.03)',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.06)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.03)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      left: '14px', 
                      top: '14px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#0f2c63',
                      boxShadow: '0 0 0 2px rgba(15, 44, 99, 0.1)',
                    }} />
                    Activity logs provide comprehensive tracking of all system changes and user actions
                  </li>
                  <li style={{ 
                    position: 'relative', 
                    paddingLeft: '24px', 
                    fontWeight: '400', 
                    color: '#475569',
                    padding: '10px 14px',
                    background: 'rgba(15, 44, 99, 0.03)',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.06)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.03)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      left: '14px', 
                      top: '14px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#0f2c63',
                      boxShadow: '0 0 0 2px rgba(15, 44, 99, 0.1)',
                    }} />
                    Monitor audit trails for security compliance and system integrity verification
                  </li>
                  <li style={{ 
                    position: 'relative', 
                    paddingLeft: '24px', 
                    fontWeight: '400', 
                    color: '#475569',
                    padding: '10px 14px',
                    background: 'rgba(15, 44, 99, 0.03)',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.06)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.03)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      left: '14px', 
                      top: '14px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#0f2c63',
                      boxShadow: '0 0 0 2px rgba(15, 44, 99, 0.1)',
                    }} />
                    Track detailed event history including timestamps, user identities, and action types
                  </li>
                  <li style={{ 
                    position: 'relative', 
                    paddingLeft: '24px', 
                    fontWeight: '400', 
                    color: '#475569',
                    padding: '10px 14px',
                    background: 'rgba(15, 44, 99, 0.03)',
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.06)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15, 44, 99, 0.03)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                  >
                    <span style={{ 
                      position: 'absolute', 
                      left: '14px', 
                      top: '14px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#0f2c63',
                      boxShadow: '0 0 0 2px rgba(15, 44, 99, 0.1)',
                    }} />
                    Export and analyze logs for reporting and troubleshooting purposes
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes shimmer {
          0% {
            left: -100%;
          }
          50%, 100% {
            left: 100%;
          }
        }

        @media (max-width: 768px) {
          div[style*="max-width: 600px"] {
            max-width: 100% !important;
            padding: 0 20px !important;
          }
          
          div[style*="padding: '50px'"] {
            padding: 40px 30px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminSettings;
