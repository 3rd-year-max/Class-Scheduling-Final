import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faCalendarAlt, faRightToBracket, faCheckCircle, faUser } from '@fortawesome/free-solid-svg-icons';
import axios from "axios";
import ReCAPTCHA from 'react-google-recaptcha';
import executeRecaptchaWithRetry from '../../utils/recaptchaClient.js';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';
const REQUIRE_RECAPTCHA = process.env.REACT_APP_REQUIRE_RECAPTCHA === 'true';
const RECAPTCHA_INVISIBLE = process.env.REACT_APP_RECAPTCHA_INVISIBLE === 'true';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [popup, setPopup] = useState({ show: false, message: '', type: '' });
  const navigate = useNavigate();
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaError, setRecaptchaError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const recaptchaRef = useRef(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRecaptcha = (token) => {
    setRecaptchaToken(token);
    setRecaptchaError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Acquire token if required
    let token = recaptchaToken;
    if (REQUIRE_RECAPTCHA) {
      if (RECAPTCHA_INVISIBLE) {
        try {
          const result = await executeRecaptchaWithRetry(recaptchaRef, { maxAttempts: 4 });
          token = result || recaptchaToken;
          if (!token) {
            setRecaptchaError('Please complete the reCAPTCHA.');
            return;
          }
          setRecaptchaToken(token);
        } catch (err) {
          console.error('reCAPTCHA execute error:', err);
          setRecaptchaError('reCAPTCHA execution failed. Please try again.');
          return;
        }
      } else {
        if (!recaptchaToken) {
          setRecaptchaError('Please complete the reCAPTCHA.');
          return;
        }
        token = recaptchaToken;
      }
    }

    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
      const res = await axios.post(`${apiBase}/api/admin/login`, {
        username: formData.username,
        password: formData.password,
        recaptchaToken: token
      });

      if (res.data.success) {
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          navigate("/admin/dashboard");
        }, 2000);
      }
    } catch (err) {
      // ❌ Show error popup
      const errorMessage = err.response?.data?.message || "Invalid username or password!";
      setPopup({ show: true, message: errorMessage, type: "error" });
      setTimeout(() => {
        setPopup({ show: false, message: "", type: "" });
      }, 2000);
    }
  };

  return (
    <div style={{ 
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      background: "linear-gradient(135deg, #0f2c63 30%, #f97316 100%)",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      position: "relative"
    }}>
      {/* ✅ Popup Component */}
      {popup.show && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: popup.type === "success" ? "#d1fae5" : "#fee2e2",
            color: popup.type === "success" ? "#065f46" : "#991b1b",
            border: `2px solid ${popup.type === "success" ? "#10b981" : "#f87171"}`,
            padding: "20px 40px",
            borderRadius: "12px",
            fontWeight: "600",
            fontSize: "16px",
            boxShadow: "0 8px 25px rgba(0, 0, 0, 0.2)",
            zIndex: 1000,
            textAlign: "center",
            animation: "fadeInOut 2s ease-in-out"
          }}
        >
          {popup.message}
        </div>
      )}

      {showSuccessModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, animation: "fadeIn 0.3s ease"
        }}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "500px", width: "90%", textAlign: "center",
            position: "relative", boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
            animation: "slideUp 0.4s ease"
          }}>
            <div style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 30px", animation: "scaleIn 0.5s ease"
            }}>
              <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: "50px", color: "white" }} />
            </div>
            <h2 style={{ fontSize: "28px", fontWeight: "700", color: "#1e293b", marginBottom: "15px" }}>Login Successful!</h2>
            <p style={{ fontSize: "16px", color: "#64748b", lineHeight: "1.6", marginBottom: "10px" }}>Welcome back, <strong>Admin</strong>!</p>
            <p style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "30px" }}>Redirecting to your dashboard...</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0f2c63", animation: "bounce 1s infinite" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0f2c63", animation: "bounce 1s infinite 0.2s" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#0f2c63", animation: "bounce 1s infinite 0.4s" }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="header1" style={{
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

      <div className="main-container1" style={{
        flex: 1,
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div className="login-card1" style={{
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
          
          <h2 className="welcome-text1" style={{
            marginBottom: "10px",
            color: "#333",
            fontSize: "28px",
            fontWeight: "700"
          }}>Administrator Login</h2>
          
          <p className="subtitle1" style={{
            marginBottom: "30px",
            color: "#666",
            fontSize: "14px",
            lineHeight: "1.5"
          }}>Please enter your credentials to access the system</p>
          
          <form className="login-form1" onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
            <div className="input-group1" style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "30px"
            }}>
              <div className="input-field1" style={{
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
                  icon={faUser} 
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
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleChange}
                  required
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
              
              <div className="input-field1" style={{
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
              className="login-btn1 admin-btn1"
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
                cursor: "pointer",
                transition: "all 0.3s ease",
                textDecoration: "none",
                position: "relative",
                overflow: "hidden",
                background: "linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)",
                color: "white",
                boxShadow: "0 8px 20px rgba(15, 44, 99, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-3px)";
                e.target.style.boxShadow = "0 12px 25px rgba(15, 44, 99, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 8px 20px rgba(15, 44, 99, 0.3)";
              }}
            >
              <FontAwesomeIcon icon={faRightToBracket} />
              <span>Login</span>
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
        </div>
      </div>
      <style>{`
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } }
`}</style>
    </div>
  );
};

export default AdminLogin;
