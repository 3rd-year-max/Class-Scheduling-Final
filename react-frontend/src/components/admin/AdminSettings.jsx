import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faClipboardList,
  faKey,
  faEnvelope,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import ReCAPTCHA from 'react-google-recaptcha';
import executeRecaptchaWithRetry from '../../utils/recaptchaClient.js';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
const REQUIRE_RECAPTCHA = process.env.REACT_APP_REQUIRE_RECAPTCHA === 'true';
const RECAPTCHA_INVISIBLE = process.env.REACT_APP_RECAPTCHA_INVISIBLE === 'true';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState('');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaError, setRecaptchaError] = useState('');
  const recaptchaRef = useRef(null);

  const handleRecaptcha = (token) => {
    setRecaptchaToken(token);
    setRecaptchaError('');
  };

  const handlePasswordResetRequest = async (e) => {
    e.preventDefault();
    
    if (!passwordResetEmail || !passwordResetEmail.trim()) {
      setPasswordResetError('Email is required.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(passwordResetEmail)) {
      setPasswordResetError('Please enter a valid email address.');
      return;
    }

    setPasswordResetLoading(true);
    setPasswordResetError('');
    setPasswordResetSuccess(false);

    // Acquire token if required
    let token = recaptchaToken;
    if (REQUIRE_RECAPTCHA) {
      if (RECAPTCHA_INVISIBLE) {
        try {
          const result = await executeRecaptchaWithRetry(recaptchaRef, { maxAttempts: 4 });
          token = result || recaptchaToken;
          if (!token) {
            setRecaptchaError('Please complete the reCAPTCHA.');
            setPasswordResetLoading(false);
            return;
          }
          setRecaptchaToken(token);
        } catch (err) {
          console.error('reCAPTCHA execute error:', err);
          setRecaptchaError('reCAPTCHA execution failed. Please try again.');
          setPasswordResetLoading(false);
          return;
        }
      } else {
        if (!recaptchaToken) {
          setRecaptchaError('Please complete the reCAPTCHA.');
          setPasswordResetLoading(false);
          return;
        }
        token = recaptchaToken;
      }
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
      const res = await axios.post(`${apiBase}/api/password-reset/forgot`, {
        email: passwordResetEmail.trim(),
        userType: 'admin',
        recaptchaToken: token
      });

      if (res.data.success) {
        setPasswordResetSuccess(true);
        setTimeout(() => {
          setShowPasswordResetModal(false);
          setPasswordResetEmail('');
          setPasswordResetSuccess(false);
          setRecaptchaToken('');
        }, 3000);
      } else {
        setPasswordResetError(res.data.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      console.error('Password reset request error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to send reset email. Please try again.';
      setPasswordResetError(errorMessage);
    } finally {
      setPasswordResetLoading(false);
    }
  };

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
    {
      id: 'password-reset',
      title: 'Change Password',
      description: 'Request a password reset link to be sent to your email address. The email will be registered as your admin email if not already set.',
      icon: faKey,
      color: '#f97316',
      bgGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      action: () => setShowPasswordResetModal(true),
    },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5' }}>
      {/* Password Reset Modal */}
      {showPasswordResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.4s ease'
          }}>
            <button
              onClick={() => {
                setShowPasswordResetModal(false);
                setPasswordResetEmail('');
                setPasswordResetError('');
                setPasswordResetSuccess(false);
                setRecaptchaToken('');
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f1f5f9';
                e.target.style.color = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'none';
                e.target.style.color = '#64748b';
              }}
            >
              ×
            </button>

            {passwordResetSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 30px',
                  animation: 'scaleIn 0.5s ease'
                }}>
                  <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '50px', color: 'white' }} />
                </div>
                <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '15px' }}>
                  Email Sent!
                </h2>
                <p style={{ fontSize: '16px', color: '#64748b', lineHeight: '1.6', marginBottom: '10px' }}>
                  A password reset link has been sent to <strong>{passwordResetEmail}</strong>
                </p>
                <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '30px' }}>
                  Please check your email for instructions. The link will expire in 1 hour.
                </p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
                  Request Password Reset
                </h2>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '30px' }}>
                  Enter your email address to receive a password reset link. This email will be registered as your admin email if not already set.
                </p>

                {passwordResetError && (
                  <div style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '1px solid #fecaca'
                  }}>
                    {passwordResetError}
                  </div>
                )}

                <form onSubmit={handlePasswordResetRequest}>
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'white',
                    border: '2px solid #ddd',
                    borderRadius: '12px',
                    padding: 0,
                    marginBottom: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}>
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      style={{
                        padding: '0 15px',
                        color: '#666',
                        fontSize: '16px',
                        minWidth: '50px',
                        display: 'flex',
                        justifyContent: 'center'
                      }}
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={passwordResetEmail}
                      onChange={(e) => {
                        setPasswordResetEmail(e.target.value);
                        setPasswordResetError('');
                      }}
                      required
                      disabled={passwordResetLoading}
                      style={{
                        flex: 1,
                        border: 'none',
                        outline: 'none',
                        padding: '18px 15px 18px 0',
                        fontSize: '16px',
                        background: 'transparent',
                        color: '#333'
                      }}
                    />
                  </div>

                  {RECAPTCHA_SITE_KEY && (
                    <>
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={RECAPTCHA_SITE_KEY}
                        onChange={handleRecaptcha}
                        size={RECAPTCHA_INVISIBLE ? 'invisible' : undefined}
                        style={{ margin: '20px 0', alignSelf: 'center' }}
                      />
                      {recaptchaError && (
                        <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '14px' }}>
                          {recaptchaError}
                        </div>
                      )}
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordResetModal(false);
                        setPasswordResetEmail('');
                        setPasswordResetError('');
                        setRecaptchaToken('');
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 24px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        background: 'white',
                        color: '#64748b',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#f1f5f9';
                        e.target.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'white';
                        e.target.style.borderColor = '#e2e8f0';
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordResetLoading}
                      style={{
                        flex: 1,
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: passwordResetLoading ? 'not-allowed' : 'pointer',
                        background: passwordResetLoading ? '#9ca3af' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: 'white',
                        transition: 'all 0.3s ease',
                        opacity: passwordResetLoading ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!passwordResetLoading) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 8px 20px rgba(249, 115, 22, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!passwordResetLoading) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {passwordResetLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

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
                    <span>{option.id === 'password-reset' ? 'Request Password Reset' : 'View Activity Logs'}</span>
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

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
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
