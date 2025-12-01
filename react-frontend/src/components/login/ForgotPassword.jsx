import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faCalendarAlt, faArrowLeft, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';
import executeRecaptchaWithRetry from '../../utils/recaptchaClient.js';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
const REQUIRE_RECAPTCHA = process.env.REACT_APP_REQUIRE_RECAPTCHA === 'true';
const RECAPTCHA_INVISIBLE = process.env.REACT_APP_RECAPTCHA_INVISIBLE === 'true';

const ForgotPassword = () => {
  const userType = 'instructor'; // Only instructors can reset password
  
  const [formData, setFormData] = useState({
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaError, setRecaptchaError] = useState('');
  const recaptchaRef = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleRecaptcha = (token) => {
    setRecaptchaToken(token);
    setRecaptchaError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    setError('');
    setSuccess(false);

    // If reCAPTCHA is required, obtain a token.
    let token = recaptchaToken;
    if (REQUIRE_RECAPTCHA) {
      if (RECAPTCHA_INVISIBLE) {
        try {
          const result = await executeRecaptchaWithRetry(recaptchaRef, { maxAttempts: 4 });
          token = result || recaptchaToken;
          if (!token) {
            setRecaptchaError('reCAPTCHA failed to provide a token. Please try again.');
            setLoading(false);
            return;
          }
          setRecaptchaToken(token);
        } catch (err) {
          console.error('reCAPTCHA execute error:', err);
          setRecaptchaError('reCAPTCHA execution failed. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        if (!recaptchaToken) {
          setRecaptchaError('Please complete the reCAPTCHA.');
          setLoading(false);
          return;
        }
        token = recaptchaToken;
      }
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
      const res = await axios.post(`${apiBase}/api/password-reset/forgot`, {
        email: formData.email,
        userType: userType,
        recaptchaToken: recaptchaToken
      });

      if (res.data.success) {
        setSuccess(true);
      } else {
        setError(res.data.message || 'Failed to send reset email. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      console.error('Error response:', err.response?.data);
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to send reset email. Please check your backend console for details or contact the administrator.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: "linear-gradient(135deg, #0f2c63 30%, #f97316 100%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column"
    }}>
      <div className="header" style={{
        width: "100%",
        height: "80px",
        background: "linear-gradient(135deg, #0f2c63 30%, #f97316 100%)",
        boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative"
      }}>
        <h1 style={{
          color: "white",
          fontSize: "24px",
          fontWeight: "600",
          letterSpacing: "1px",
          margin: 0
        }}>
          <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: "10px" }} />
          Class Scheduling System
        </h1>
      </div>

      <div className="main-container" style={{
        flex: 1,
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div className="login-card" style={{
          background: "#d4d6dc",
          padding: "50px 40px",
          borderRadius: "20px",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
          textAlign: "center",
          maxWidth: "550px",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          transition: "all 0.3s ease"
        }}>
          <div style={{
            content: "''",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #f97316, #ea580c)"
          }}></div>

          <img 
            src="/images/buksuu.png" 
            alt="System Logo" 
            className="logo"
            style={{
              width: "200px",
              height: "auto",
              marginBottom: "30px",
              borderRadius: "10px",
              boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)",
              border: "none"
            }}
          />
          
          <h2 className="welcome-text" style={{
            marginBottom: "10px",
            color: "#333",
            fontSize: "28px",
            fontWeight: "700"
          }}>
            Forgot Password?
          </h2>
          
          <p className="subtitle" style={{
            marginBottom: "30px",
            color: "#666",
            fontSize: "14px",
            lineHeight: "1.5"
          }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {success ? (
            <div style={{
              background: "#d1fae5",
              color: "#065f46",
              padding: "20px",
              borderRadius: "12px",
              marginBottom: "30px",
              border: "2px solid #10b981"
            }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: "24px", marginBottom: "10px", display: "block" }} />
              <p style={{ margin: 0, fontWeight: "600" }}>
                Password reset email sent!
              </p>
              <p style={{ margin: "10px 0 0 0", fontSize: "14px" }}>
                Please check your email for instructions to reset your password. The link will expire in 1 hour.
              </p>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div style={{
                  background: "#fee2e2",
                  color: "#dc2626",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  marginBottom: "20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  border: "1px solid #fecaca"
                }}>
                  {error}
                </div>
              )}
              
              <form className="login-form" onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
                <div className="input-group" style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  marginBottom: "30px"
                }}>
                  <div className="input-field" style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    background: "white",
                    border: "2px solid #ddd",
                    borderRadius: "12px",
                    padding: 0,
                    transition: "all 0.3s ease",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
                  }}>
                    <FontAwesomeIcon 
                      icon={faEnvelope} 
                      style={{
                        padding: "0 15px",
                        color: "#666",
                        fontSize: "16px",
                        minWidth: "50px",
                        display: "flex",
                        justifyContent: "center"
                      }}
                    />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Email Address"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        padding: "18px 15px 18px 0",
                        fontSize: "16px",
                        background: "transparent",
                        color: "#333"
                      }}
                    />
                  </div>
                </div>

                {RECAPTCHA_SITE_KEY ? (
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={RECAPTCHA_SITE_KEY}
                    onChange={handleRecaptcha}
                    size={RECAPTCHA_INVISIBLE ? 'invisible' : undefined}
                    style={{ margin: '20px 0', alignSelf: 'center' }}
                  />
                ) : null}
                {recaptchaError && <div style={{ color:'#ef4444', marginBottom:10 }}>{recaptchaError}</div>}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="login-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    gap: "15px",
                    padding: "18px 30px",
                    border: "none",
                    borderRadius: "15px",
                    fontSize: "18px",
                    fontWeight: "600",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.3s ease",
                    textDecoration: "none",
                    position: "relative",
                    overflow: "hidden",
                    background: loading ? "#9ca3af" : "linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)",
                    color: "white",
                    boxShadow: "0 8px 20px rgba(15, 44, 99, 0.3)",
                    marginBottom: "10px",
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.target.style.transform = "translateY(-3px)";
                      e.target.style.boxShadow = "0 12px 25px rgba(15, 44, 99, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.target.style.transform = "translateY(0)";
                      e.target.style.boxShadow = "0 8px 20px rgba(15, 44, 99, 0.3)";
                    }
                  }}
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                  <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                </button>
              </form>
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link 
              to={userType === 'admin' ? '/admin/login' : '/instructor/login'}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                color: "#0f2c63",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "600",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.target.style.color = "#f97316";
                e.target.style.transform = "translateX(-5px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.color = "#0f2c63";
                e.target.style.transform = "translateX(0)";
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back to Login</span>
            </Link>
            
            <Link 
              to="/login" 
              className="login-btn3"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "15px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "15px",
                fontSize: "18px",
                fontWeight: "400",
                cursor: "pointer",
                transition: "all 0.3s ease",
                textDecoration: "none",
                position: "relative",
                overflow: "hidden",
                width: "100%",
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                color: "white",
                boxShadow: "0 8px 20px rgba(249, 115, 22, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-3px)";
                e.target.style.boxShadow = "0 12px 25px rgba(249, 115, 22, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 8px 20px rgba(249, 115, 22, 0.3)";
              }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back to User Selection</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

