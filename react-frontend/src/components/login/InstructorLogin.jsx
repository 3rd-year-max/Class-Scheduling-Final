import React, { useState, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faCalendarAlt, faRightToBracket, faCheckCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import apiClient from '../../services/apiClient.js';
import ReCAPTCHA from 'react-google-recaptcha';
import executeRecaptchaWithRetry from '../../utils/recaptchaClient.js';
import { AuthContext } from '../../context/AuthContext.jsx';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
const REQUIRE_RECAPTCHA = process.env.REACT_APP_REQUIRE_RECAPTCHA === 'true';
const RECAPTCHA_INVISIBLE = process.env.REACT_APP_RECAPTCHA_INVISIBLE === 'true';

const InstructorLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [instructorName, setInstructorName] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaError, setRecaptchaError] = useState('');
  const recaptchaRef = useRef(null);
  const navigate = useNavigate();
  const { login: contextLogin } = useContext(AuthContext);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
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

    // Acquire/verify token.
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
        // Visible widget: ensure user completed it already
        if (!recaptchaToken) {
          setRecaptchaError('Please complete the reCAPTCHA.');
          setLoading(false);
          return;
        }
        token = recaptchaToken;
      }
    }

    try {
      const res = await apiClient.login(formData.email, formData.password, 'instructor', token);

      if (res.data.success) {
        // Store JWT for authenticated requests (must be under 'token' for the app)
        if (!res.data.token) {
          throw new Error('Login did not return a token');
        }
        // Use AuthContext to set token and user email in app state
        if (contextLogin) {
          contextLogin(res.data.token);
        } else {
          // Fallback to localStorage if context not available
          localStorage.setItem('token', res.data.token);
        }

        // Backward compatibility
        localStorage.setItem('instructorToken', res.data.token);
        localStorage.setItem('instructorData', JSON.stringify(res.data.instructor));

        // Set instructor name for success modal
        setInstructorName(`${res.data.instructor.firstname} ${res.data.instructor.lastname}`);
        
        // Show success modal
        setShowSuccessModal(true);
        
        // Auto redirect after 2 seconds
        setTimeout(() => {
          navigate('/instructor/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    navigate('/instructor/dashboard');
  };

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: "linear-gradient(135deg, #0f2c63 30%, #f97316 100%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column"
    }}>
      <div className="header2" style={{
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

      <div className="main-container2" style={{
        flex: 1,
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div className="login-card2" style={{
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
            className="logo2"
            style={{
              width: "200px",
              height: "auto",
              marginBottom: "30px",
              borderRadius: "10px",
              boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)",
              border: "none"
            }}
          />
          
          <h2 className="welcome-text2" style={{
            marginBottom: "10px",
            color: "#333",
            fontSize: "28px",
            fontWeight: "700"
          }}>Instructor Login</h2>
          
          <p className="subtitle2" style={{
            marginBottom: "30px",
            color: "#666",
            fontSize: "14px",
            lineHeight: "1.5"
          }}>Please enter your credentials to access the system</p>

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
          
          <form className="login-form2" onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
            <div className="input-group2" style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "30px"
            }}>
              <div className="input-field2" style={{
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

              <div className="input-field2" style={{
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
                  icon={faLock} 
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
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
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

            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={RECAPTCHA_SITE_KEY}
              onChange={handleRecaptcha}
              size={RECAPTCHA_INVISIBLE ? 'invisible' : undefined}
              style={{ margin: '20px 0', alignSelf: 'center' }}
            />
            {recaptchaError && <div style={{ color:'#ef4444', marginBottom:10 }}>{recaptchaError}</div>}

            <button 
              type="submit" 
              disabled={loading || (REQUIRE_RECAPTCHA && !RECAPTCHA_INVISIBLE && !recaptchaToken)}
              className="login-btn2 instructor-btn2"
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
              <FontAwesomeIcon icon={faRightToBracket} />
              <span>{loading ? 'Logging in...' : 'Login'}</span>
            </button>
            
            <br />
            
            <Link 
              to="/login" 
              className="login-btn3 instructor-btn3"
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
              <FontAwesomeIcon icon={faRightToBracket} />
              <span>Back to User Selection</span>
            </Link>
          </form>
          
          <Link 
            to="/forgot-password?type=instructor"
            style={{
              color: "#0f2c63",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s ease",
              display: "inline-block"
            }}
            onMouseEnter={(e) => {
              e.target.style.color = "#f97316";
              e.target.style.textDecoration = "underline";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#0f2c63";
              e.target.style.textDecoration = "none";
            }}
          >
            Forgot Password?
          </Link>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          animation: "fadeIn 0.3s ease"
        }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "500px",
            width: "90%",
            textAlign: "center",
            position: "relative",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            animation: "slideUp 0.4s ease"
          }}>
            <button
              onClick={handleModalClose}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "transparent",
                border: "none",
                fontSize: "24px",
                color: "#999",
                cursor: "pointer",
                transition: "color 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.color = "#333"}
              onMouseLeave={(e) => e.target.style.color = "#999"}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <div style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 30px",
              animation: "scaleIn 0.5s ease"
            }}>
              <FontAwesomeIcon 
                icon={faCheckCircle} 
                style={{ fontSize: "50px", color: "white" }}
              />
            </div>

            <h2 style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#1e293b",
              marginBottom: "15px"
            }}>
              Login Successful!
            </h2>

            <p style={{
              fontSize: "16px",
              color: "#64748b",
              lineHeight: "1.6",
              marginBottom: "10px"
            }}>
              Welcome back, <strong>{instructorName}</strong>!
            </p>

            <p style={{
              fontSize: "14px",
              color: "#94a3b8",
              marginBottom: "30px"
            }}>
              Redirecting to your dashboard...
            </p>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "20px"
            }}>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#0f2c63",
                animation: "bounce 1s infinite"
              }}></div>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#0f2c63",
                animation: "bounce 1s infinite 0.2s"
              }}></div>
              <div style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#0f2c63",
                animation: "bounce 1s infinite 0.4s"
              }}></div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { 
            transform: translateY(50px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from { 
            transform: scale(0);
            opacity: 0;
          }
          to { 
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 80%, 100% { 
            transform: translateY(0);
          }
          40% { 
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
};

export default InstructorLogin;
