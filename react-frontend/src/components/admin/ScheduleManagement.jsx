import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGraduationCap,
  faCode,
  faChevronRight,
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
    <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh', background: '#fafafa' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <Header title="Schedule Management" />
        <div className="dashboard-content" style={{ marginTop: '140px', padding: '0 20px 40px', background: '#fafafa' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
            Schedule Management
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
            Select a course and year level to manage class schedules, view sections, and organize academic timetables
          </p>
          <div style={{
            margin: '0 0 24px 0',
            padding: '12px 16px',
            background: '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#92400e',
            fontWeight: '500',
          }}>
            <strong>Note:</strong> Straight class hour max - It should have 1hr vacant, not three consecutive classes.
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
                      background: 'white',
                      color: course.color,
                      border: '2px solid #e2e8f0',
                      borderRadius: '18px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '700',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      minHeight: '120px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = course.color;
                      e.currentTarget.style.boxShadow = `0 8px 20px ${course.color}20`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      marginBottom: '12px',
                    }}>
                      <div
                        style={{
                          fontSize: '36px',
                          fontWeight: '800',
                          width: '56px',
                          height: '56px',
                          background: course.lightColor,
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: course.color,
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {year.year}
                      </div>
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        style={{
                          fontSize: 18,
                          color: course.color,
                          opacity: 0.6,
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

                    <div style={{ width: '100%' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        marginBottom: '4px',
                        color: '#1e293b',
                      }}>
                        {year.label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
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
