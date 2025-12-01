import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faCalendarAlt, faUserPlus, faLock, faPhone, faBuilding, faCheckCircle, faTimes, faKey, faRefresh, faEye, faEyeSlash, faCopy } from '@fortawesome/free-solid-svg-icons';

const InstructorSignup = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    contact: '',
    department: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [suggestedPassword, setSuggestedPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '' });
  const [hasFocusedPassword, setHasFocusedPassword] = useState(false);
  const navigate = useNavigate();

  // Auto-populate email and department from URL query parameters
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    const departmentFromUrl = searchParams.get('department');
    
    if (emailFromUrl) {
      setFormData(prev => ({
        ...prev,
        email: decodeURIComponent(emailFromUrl),
        department: departmentFromUrl ? decodeURIComponent(departmentFromUrl) : ''
      }));
    }
  }, [searchParams]);

  // Generate strong password using Credential Management principles
  const generateStrongPassword = () => {
    const length = 16;
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    // Ensure at least one character from each category
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setSuggestedPassword(password);
    setFormData({
      ...formData,
      password: password
    });
    calculatePasswordStrength(password);
  };

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    let score = 0;
    let feedback = [];

    if (password.length >= 8) score += 1;
    else feedback.push('At least 8 characters');
    
    if (password.length >= 12) score += 1;
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('lowercase letter');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('uppercase letter');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('number');
    
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('special character');

    let strengthText = '';
    let strengthColor = '';
    
    if (score <= 2) {
      strengthText = 'Weak';
      strengthColor = '#ef4444';
    } else if (score <= 4) {
      strengthText = 'Fair';
      strengthColor = '#f59e0b';
    } else if (score <= 5) {
      strengthText = 'Good';
      strengthColor = '#3b82f6';
    } else {
      strengthText = 'Strong';
      strengthColor = '#10b981';
    }

    setPasswordStrength({
      score,
      feedback: feedback.length > 0 ? `Add: ${feedback.join(', ')}` : '',
      text: strengthText,
      color: strengthColor
    });
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: newValue
    });
    
    // Calculate password strength when password changes
    if (e.target.name === 'password') {
      calculatePasswordStrength(newValue);
      // Clear suggested password if user types their own
      if (newValue !== suggestedPassword) {
        setSuggestedPassword('');
      }
    }
  };

  // Copy password to clipboard
  const copyPasswordToClipboard = async () => {
    if (formData.password) {
      try {
        await navigator.clipboard.writeText(formData.password);
        alert('Password copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy password:', err);
      }
    }
  };

  // Use Credential Management API to store credentials after successful signup
  const storeCredentials = async () => {
    // Check if Credential Management API is available
    if ('credentials' in navigator && 'PasswordCredential' in window) {
      try {
        // Create a PasswordCredential object
        // eslint-disable-next-line no-undef
        const cred = new PasswordCredential({
          id: formData.email,
          password: formData.password,
          name: `${formData.firstname} ${formData.lastname}`,
          iconURL: window.location.origin + '/images/buksuu.png'
        });
        
        // Store the credential
        await navigator.credentials.store(cred);
        console.log('Credentials stored successfully using Credential Management API');
      } catch (err) {
        // Credential storage might not be available (requires HTTPS, user permission, etc.)
        // The browser's built-in password manager will still offer to save the password
        console.log('Credential storage not available or declined:', err.message);
      }
    } else {
      // Fallback: Browser's built-in password manager will handle it
      console.log('Credential Management API not available. Browser password manager will handle credential storage.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/instructors/complete-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstname: formData.firstname,
          lastname: formData.lastname,
          email: formData.email,
          contact: formData.contact,
          department: formData.department,
          password: formData.password
        }),
      });
  
      const data = await res.json();
  
      if (res.ok) {
        // Store credentials using Credential Management API
        await storeCredentials();
        
        setShowSuccessModal(true);

        // Auto redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/instructor/login');
        }, 3000);
      } else {
        // Display backend validation or error messages gracefully
        alert(data.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Error during registration:', err);
      alert('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };
  
  

  const handleModalClose = () => {
    setShowSuccessModal(false);
    navigate('/instructor/login');
  };

  const inputFieldStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    background: "white",
    border: "2px solid #ddd",
    borderRadius: "12px",
    padding: 0,
    transition: "all 0.3s ease",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
  };

  const iconStyle = {
    padding: "0 15px",
    color: "#666",
    fontSize: "16px",
    minWidth: "50px",
    display: "flex",
    justifyContent: "center"
  };

  const inputStyle = {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "18px 15px 18px 0",
    fontSize: "16px",
    background: "transparent",
    color: "#333"
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
          maxWidth: "600px",
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
          }}>Instructor Sign Up</h2>
          
          <p className="subtitle2" style={{
            marginBottom: "30px",
            color: "#666",
            fontSize: "14px",
            lineHeight: "1.5"
          }}>Complete your registration to access the system</p>
          
          <form className="login-form2" onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
            <div className="input-group2" style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginBottom: "30px"
            }}>
              {/* First Name */}
              <div className="input-field2" style={inputFieldStyle}>
                <FontAwesomeIcon icon={faUser} style={iconStyle} />
                <input
                  type="text"
                  name="firstname"
                  placeholder="First Name"
                  value={formData.firstname}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={inputStyle}
                />
              </div>

              {/* Last Name */}
              <div className="input-field2" style={inputFieldStyle}>
                <FontAwesomeIcon icon={faUser} style={iconStyle} />
                <input
                  type="text"
                  name="lastname"
                  placeholder="Last Name"
                  value={formData.lastname}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={inputStyle}
                />
              </div>

              {/* Email (Read-only) */}
              <div className="input-field2" style={inputFieldStyle}>
                <FontAwesomeIcon icon={faEnvelope} style={iconStyle} />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  readOnly
                  style={{
                    ...inputStyle,
                    cursor: "not-allowed",
                    backgroundColor: "transparent"
                  }}
                />
              </div>

              {/* Contact Number */}
              <div className="input-field2" style={inputFieldStyle}>
                <FontAwesomeIcon icon={faPhone} style={iconStyle} />
                <input
                  type="tel"
                  name="contact"
                  placeholder="Contact Number (e.g., +63 XXX XXX XXXX)"
                  value={formData.contact}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  style={inputStyle}
                />
              </div>

              {/* Department (Read-only - set by admin) */}
              <div className="input-field2" style={inputFieldStyle}>
                <FontAwesomeIcon icon={faBuilding} style={iconStyle} />
                <input
                  type="text"
                  name="department"
                  placeholder="Department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  readOnly
                  style={{
                    ...inputStyle,
                    cursor: "not-allowed",
                    backgroundColor: "transparent"
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="input-field2" style={inputFieldStyle}>
                  <FontAwesomeIcon icon={faLock} style={iconStyle} />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password (min. 6 characters)"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={(e) => {
                      // Auto-suggest password on first focus if field is empty
                      if (!hasFocusedPassword && !formData.password) {
                        setHasFocusedPassword(true);
                        generateStrongPassword();
                      }
                    }}
                    required
                    minLength="6"
                    disabled={loading}
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '8px', paddingRight: '15px' }}>
                    {formData.password && (
                      <button
                        type="button"
                        onClick={copyPasswordToClipboard}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#666',
                          padding: '5px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#f97316'}
                        onMouseLeave={(e) => e.target.style.color = '#666'}
                        title="Copy password"
                      >
                        <FontAwesomeIcon icon={faCopy} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#666',
                        padding: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#f97316'}
                      onMouseLeave={(e) => e.target.style.color = '#666'}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </button>
                  </div>
                </div>
                
                {/* Password Generator Button */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)',
                      opacity: loading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(15, 44, 99, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faKey} />
                    <FontAwesomeIcon icon={faRefresh} style={{ fontSize: '12px' }} />
                    <span>Generate Strong Password</span>
                  </button>
                  
                  {suggestedPassword && formData.password === suggestedPassword && (
                    <span style={{
                      fontSize: '12px',
                      color: '#10b981',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <FontAwesomeIcon icon={faCheckCircle} />
                      Using suggested password
                    </span>
                  )}
                </div>

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div style={{ marginTop: '-5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        background: '#e5e7eb',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          height: '100%',
                          background: passwordStrength.color,
                          transition: 'all 0.3s ease',
                          borderRadius: '3px'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: passwordStrength.color,
                        minWidth: '50px'
                      }}>
                        {passwordStrength.text}
                      </span>
                    </div>
                    {passwordStrength.feedback && (
                      <p style={{
                        fontSize: '11px',
                        color: '#64748b',
                        margin: 0,
                        marginTop: '3px'
                      }}>
                        {passwordStrength.feedback}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
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
                background: loading ? "#6b7280" : "linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)",
                color: "white",
                boxShadow: "0 8px 20px rgba(15, 44, 99, 0.3)",
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
              <FontAwesomeIcon icon={faUserPlus} />
              <span>{loading ? "Creating Account..." : "Complete Registration"}</span>
            </button>
          </form>

          <p className="signup-text2" style={{
            color: "#666",
            fontSize: "14px"
          }}>
            Already have an account? <Link to="/instructor/login" style={{ color: "#f97316", textDecoration: "none", fontWeight: "600" }}>Login here!</Link>
          </p>
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
              Account Created Successfully!
            </h2>

            <p style={{
              fontSize: "16px",
              color: "#64748b",
              lineHeight: "1.6",
              marginBottom: "10px"
            }}>
              Welcome to the Class Scheduling System, <strong>{formData.firstname} {formData.lastname}</strong>!
            </p>

            <p style={{
              fontSize: "14px",
              color: "#94a3b8",
              marginBottom: "30px"
            }}>
              You will be redirected to the login page in a moment...
            </p>

            <button
              onClick={handleModalClose}
              style={{
                padding: "14px 32px",
                background: "linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "16px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 12px rgba(15, 44, 99, 0.3)"
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 16px rgba(15, 44, 99, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 12px rgba(15, 44, 99, 0.3)";
              }}
            >
              Go to Login
            </button>
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
      `}</style>
    </div>
  );
};

export default InstructorSignup;
