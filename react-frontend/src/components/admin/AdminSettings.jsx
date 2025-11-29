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
    <div style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          marginLeft: 0,
        }}
      >
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <div style={{ padding: '24px', marginTop: '100px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '36px', textAlign: 'center', maxWidth: '700px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '14px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                <FontAwesomeIcon
                  icon={faGear}
                  style={{ fontSize: '32px', color: '#fff' }}
                />
              </div>
              <h1 style={{ margin: 0, color: '#ffffff', fontSize: '28px', fontWeight: '800', textShadow: '0 4px 16px rgba(0,0,0,0.4)', letterSpacing: '-0.5px' }}>
                System Settings
              </h1>
            </div>
            <p style={{ margin: '0', color: 'rgba(255,255,255,0.95)', fontSize: '14px', marginTop: '10px', lineHeight: '1.6', fontWeight: '500' }}>
              Manage system configuration, monitor activities, and maintain system integrity
            </p>
          </div>

          {/* Settings Card - Enhanced Single Card */}
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              margin: '0 auto',
            }}
          >
            {settingsOptions.map((option) => (
              <div
                key={option.id}
                onClick={option.action}
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: '1px solid rgba(15, 44, 99, 0.1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px) scale(1.01)';
                  e.currentTarget.style.boxShadow = '0 30px 80px rgba(15, 44, 99, 0.25), 0 0 0 1px rgba(15, 44, 99, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)';
                }}
              >
                {/* Top Color Bar - Enhanced */}
                <div
                  style={{
                    height: '5px',
                    background: option.bgGradient,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    animation: 'shimmer 3s infinite',
                  }} />
                </div>

                {/* Content - Enhanced */}
                <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center', textAlign: 'center' }}>
                  {/* Icon - Enhanced */}
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '16px',
                      background: `linear-gradient(135deg, ${option.color}15 0%, ${option.color}25 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                      color: option.color,
                      boxShadow: `0 8px 24px ${option.color}25`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: `2px solid ${option.color}20`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'rotate(5deg) scale(1.08)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${option.color}35`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${option.color}25`;
                    }}
                  >
                    <FontAwesomeIcon icon={option.icon} />
                  </div>

                  {/* Title - Enhanced */}
                  <div>
                    <h3
                      style={{
                        margin: '0 0 10px 0',
                        color: '#0f172a',
                        fontSize: '20px',
                        fontWeight: '800',
                        letterSpacing: '-0.5px',
                        background: `linear-gradient(135deg, ${option.color} 0%, ${option.color}dd 100%)`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {option.title}
                    </h3>

                    {/* Description - Enhanced */}
                    <p
                      style={{
                        margin: '0',
                        color: '#64748b',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        maxWidth: '420px',
                        fontWeight: '500',
                      }}
                    >
                      {option.description}
                    </p>
                  </div>

                  {/* Action Button - Enhanced */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      option.action();
                    }}
                    style={{
                      background: option.bgGradient,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 28px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: `0 8px 24px ${option.color}30`,
                      minWidth: '180px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${option.color}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${option.color}30`;
                    }}
                  >
                    <FontAwesomeIcon icon={option.icon} />
                    <span>View Activity Logs</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Info Section - Enhanced */}
          <div style={{ maxWidth: '600px', margin: '36px auto 0', width: '100%' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              color: 'rgba(255, 255, 255, 0.98)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)';
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(249, 115, 22, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(249, 115, 22, 0.3)'
                }}>
                  <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: '18px', color: '#fff' }} />
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>System Information</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: '0', lineHeight: '1.7', fontSize: '13px', listStyle: 'none' }}>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px', fontWeight: '500' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>▸</span>
                  Activity logs provide comprehensive tracking of all system changes and user actions
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px', fontWeight: '500' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>▸</span>
                  Monitor audit trails for security compliance and system integrity verification
                </li>
                <li style={{ marginBottom: '12px', position: 'relative', paddingLeft: '24px', fontWeight: '500' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>▸</span>
                  Track detailed event history including timestamps, user identities, and action types
                </li>
                <li style={{ position: 'relative', paddingLeft: '24px', fontWeight: '500' }}>
                  <span style={{ position: 'absolute', left: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>▸</span>
                  Export and analyze logs for reporting and troubleshooting purposes
                </li>
              </ul>
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
