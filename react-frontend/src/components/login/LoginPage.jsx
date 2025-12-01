import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserShield, faChalkboardTeacher, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';


const LoginPage = () => {
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
            style={{
              width: "200px",
              height: "auto",
              marginBottom: "30px",
              borderRadius: "10px",
              boxShadow: "0 5px 15px rgba(0, 0, 0, 0.1)",
              border: "none"
            }}
          />
          
          <h2 style={{
            marginBottom: "10px",
            color: "#333",
            fontSize: "28px",
            fontWeight: "700"
          }}>Welcome</h2>
          
          <p style={{
            marginBottom: "40px",
            color: "#666",
            fontSize: "16px",
            lineHeight: "1.5"
          }}>Please select your role to continue to the scheduling system</p>
          
          <div className="login-options" style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px"
          }}>
            <Link 
              to="/admin/login" 
              className="login-btn admin-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                width: "100%",
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
              <FontAwesomeIcon icon={faUserShield} style={{ fontSize: "20px" }} />
              <span>Administrator</span>
            </Link>


            <Link 
              to="/instructor/login" 
              className="login-btn instructor-btn"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
              <FontAwesomeIcon icon={faChalkboardTeacher} style={{ fontSize: "20px" }} />
              <span>Instructor</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};


export default LoginPage;
