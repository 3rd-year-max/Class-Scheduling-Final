import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faCode,
  faChevronRight,
  faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';

const ScheduleManagement = () => {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState(null);

  const courses = [
    {
      id: 'bsit',
      name: 'BS Information Technology',
      shortName: 'BSIT',
      icon: faGraduationCap,
      gradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
      bgGradient: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%)',
      color: '#0f2c63',
      lightColor: '#e0e7ff',
    },
    {
      id: 'bsemc-dat',
      name: 'BS Entertainment and Multimedia Computing',
      shortName: 'BSEMC-DAT',
      icon: faCode,
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      bgGradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)',
      color: '#f97316',
      lightColor: '#fff7ed',
    }
  ];

  const yearLevels = [
    { id: '1styear', label: '1st Year', year: 1, description: 'Foundation courses' },
    { id: '2ndyear', label: '2nd Year', year: 2, description: 'Core subjects' },
    { id: '3rdyear', label: '3rd Year', year: 3, description: 'Advanced topics' },
    { id: '4thyear', label: '4th Year', year: 4, description: 'Capstone projects' }
  ];

  const handleYearClick = (courseId, yearId) => {
    navigate(`/admin/schedule-management/${courseId}/${yearId}`);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <Header title="Schedule Management" />
        <div className="dashboard-content" style={{ marginTop: '140px', padding: '0 20px 40px' }}>
          {/* Enhanced Welcome Section */}
          <div style={{
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
            borderRadius: '16px',
            padding: '20px 24px',
            color: '#ffffff',
            boxShadow: '0 10px 40px rgba(15, 44, 99, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none'
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }}>
                <FontAwesomeIcon icon={faCalendarCheck} style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                }}>
                  Schedule Management
                </h2>
                <p style={{
                  margin: '6px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500',
                }}>
                  Select a course and year level to manage class schedules, view sections, and organize academic timetables
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Course Cards */}
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                background: '#ffffff',
                padding: '36px',
                borderRadius: '24px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                marginBottom: '32px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={() => setHoveredCard(course.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Top gradient accent */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: course.gradient,
              }} />

              {/* Course Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  marginBottom: '32px',
                  paddingBottom: '24px',
                  borderBottom: '2px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '18px',
                    background: course.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 8px 24px ${course.color}30`,
                    transition: 'all 0.3s ease',
                    transform: hoveredCard === course.id ? 'scale(1.1) rotate(5deg)' : 'scale(1) rotate(0deg)',
                  }}
                >
                  <FontAwesomeIcon icon={course.icon} style={{ fontSize: 32, color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '26px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: '0 0 6px 0',
                    letterSpacing: '-0.5px',
                  }}>
                    {course.shortName}
                  </h3>
                  <p style={{
                    fontSize: '15px',
                    color: '#64748b',
                    margin: 0,
                    fontWeight: '500',
                  }}>
                    {course.name}
                  </p>
                </div>
              </div>

              {/* Year Level Buttons Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '20px',
                }}
              >
                {yearLevels.map((year) => (
                  <button
                    key={year.id}
                    onClick={() => handleYearClick(course.id, year.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '24px',
                      background: course.gradient,
                      color: 'white',
                      border: 'none',
                      borderRadius: '18px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '700',
                      boxShadow: `0 8px 24px ${course.color}25`,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      minHeight: '120px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${course.color}35`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = `0 8px 24px ${course.color}25`;
                    }}
                  >
                    {/* Decorative background element */}
                    <div style={{
                      position: 'absolute',
                      top: '-20px',
                      right: '-20px',
                      width: '100px',
                      height: '100px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '50%',
                      filter: 'blur(20px)',
                    }} />

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      marginBottom: '12px',
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      <div
                        style={{
                          fontSize: '36px',
                          fontWeight: '800',
                          width: '56px',
                          height: '56px',
                          background: 'rgba(255, 255, 255, 0.25)',
                          backdropFilter: 'blur(10px)',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {year.year}
                      </div>
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        style={{
                          fontSize: 18,
                          opacity: 0.9,
                          transition: 'transform 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      />
                    </div>

                    <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        marginBottom: '4px',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      }}>
                        {year.label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        opacity: 0.9,
                        fontWeight: '500',
                      }}>
                        {year.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ScheduleManagement;
