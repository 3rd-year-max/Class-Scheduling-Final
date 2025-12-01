import React, { useEffect, useState, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaInfoCircle, FaUserCircle, FaDownload, FaCheckCircle, FaClock, FaArrowLeft } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import '../../styles/InstructorWorkload.css';
import { AuthContext } from '../../context/AuthContext.jsx';

const InstructorWorkloadView = () => {
  const { userEmail } = useContext(AuthContext);
  const navigate = useNavigate();
  const [workloadData, setWorkloadData] = useState(null);
  const [instructor, setInstructor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Helper for department color
  const getDeptColor = (dept) => {
    if (!dept) return '#64748b';
    const map = {
      Math: '#2563eb',
      Science: '#10b981',
      English: '#f97316',
      IT: '#a21caf',
      Engineering: '#f59e42',
      Business: '#f43f5e',
      Education: '#0ea5e9',
    };
    return map[dept] || '#64748b';
  };

  // Download as PNG
  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null });
      const link = document.createElement('a');
      link.download = `my-workload-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Fetch instructor profile first to get ID
        const profileRes = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/instructors/profile/me`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!profileRes.ok) throw new Error('Failed to fetch profile');
        const profile = await profileRes.json();
        setInstructor(profile);

        // Fetch workload data using the MongoDB _id
        const workloadRes = await fetch(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/instructors/${profile._id}/workload`);
        if (!workloadRes.ok) throw new Error('Failed to fetch workload data');
        const workload = await workloadRes.json();
        setWorkloadData(workload);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [userEmail]);

  if (loading) {
    return (
      <div className="workload-loading-state" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div className="spinner" style={{ margin: '0 auto 24px', width: 48, height: 48, border: '6px solid #fff', borderTop: '6px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 22, fontWeight: 600 }}>Loading workload data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workload-error-state" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!workloadData) {
    return (
      <div className="workload-no-data" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>No workload data available</div>
        </div>
      </div>
    );
  }

  const { weeklySummary, dailyBreakdown } = workloadData;

  const barChartData = {
    labels: dailyBreakdown.map((day) => day.day),
    datasets: [
      {
        label: 'Hours per Day',
        data: dailyBreakdown.map((day) => day.hours),
        backgroundColor: '#2563eb',
      },
    ],
  };

  const pieChartData = {
    labels: ['Classes', 'Free Time'],
    datasets: [
      {
        data: [weeklySummary.totalClasses, 7 - weeklySummary.totalClasses],
        backgroundColor: ['#10b981', '#f97316'],
      },
    ],
  };

  return (
    <div className="workload-container" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
      color: '#1f2937',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      padding: 0,
      margin: 0
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '2rem' }}>
        {/* Header Section */}
        <div style={{
          background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: '0 10px 40px rgba(15, 44, 99, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <FaUserCircle style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <h1 style={{ 
                margin: 0, 
                color: '#ffffff', 
                fontSize: '24px', 
                fontWeight: '800',
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                letterSpacing: '-0.3px'
              }}>
                My Workload Overview
              </h1>
            </div>
            <button
              onClick={() => navigate('/instructor/reports')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(12px)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                padding: '10px 20px',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
            >
              <FaArrowLeft />
              Back to Reports
            </button>
          </div>
          <p style={{ 
            margin: 0, 
            color: 'rgba(255,255,255,0.95)', 
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Summary and breakdown of your teaching load
          </p>
        </div>

        <div ref={cardRef} style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(15, 44, 99, 0.1)',
              padding: '2rem',
              marginBottom: 24,
              position: 'relative',
              overflow: 'hidden',
              animation: 'fadeInCard 0.7s cubic-bezier(.4,0,.2,1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
                {instructor && instructor.image ? (
                  <img src={instructor.image} alt="Instructor" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #2563eb', background: '#fff' }} />
                ) : (
                  <FaUserCircle style={{ fontSize: 64, color: '#2563eb', background: '#fff', borderRadius: '50%' }} />
                )}
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {instructor ? `${instructor.firstname || ''} ${instructor.lastname || ''}`.trim() : 'Instructor'}
                    {instructor?.status && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: instructor.status === 'active' ? '#10b981' : instructor.status === 'pending' ? '#f59e42' : '#64748b',
                        background: instructor.status === 'active' ? 'rgba(16,185,129,0.13)' : instructor.status === 'pending' ? 'rgba(245,158,66,0.13)' : 'rgba(100,116,139,0.13)',
                        borderRadius: 8,
                        padding: '2px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {instructor.status === 'active' ? <FaCheckCircle style={{ color: '#10b981' }} /> : <FaClock style={{ color: '#f59e42' }} />}
                        {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, color: '#334155', opacity: 0.85 }}>{instructor?.email}</div>
                  {instructor?.department && <div style={{ fontSize: 14, color: getDeptColor(instructor.department), marginTop: 2, fontWeight: 600, display: 'inline-block', background: getDeptColor(instructor.department)+'22', borderRadius: 8, padding: '2px 10px' }}>{instructor.department}</div>}
                </div>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  style={{
                    marginLeft: 'auto',
                    background: downloading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 20px',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: downloading ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
                    cursor: downloading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: downloading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!downloading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.35)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!downloading) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)';
                    }
                  }}
                  title="Download workload report as image"
                >
                  <FaDownload /> {downloading ? 'Downloading...' : 'Download Report'}
                </button>
              </div>
              <section className="workload-summary" style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
                <div className="summary-card" style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
                  border: '2px solid #bfdbfe',
                  padding: '1.5rem 2rem',
                  textAlign: 'center',
                  minWidth: 200,
                  margin: '0 0.5rem',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }} title="Total number of classes assigned"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.15)';
                }}>
                  <h2 style={{ fontSize: '1.15rem', color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Total Classes <FaInfoCircle style={{ color: '#2563eb', fontSize: 15 }} />
                  </h2>
                  <p style={{ fontSize: '2.1rem', fontWeight: 700, color: '#2563eb', margin: 0 }}>{weeklySummary.totalClasses}</p>
                </div>
                <div className="summary-card" style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(16,185,129,0.15)',
                  border: '2px solid #bbf7d0',
                  padding: '1.5rem 2rem',
                  textAlign: 'center',
                  minWidth: 200,
                  margin: '0 0.5rem',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }} title="Total teaching hours this week"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.15)';
                }}>
                  <h2 style={{ fontSize: '1.15rem', color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Total Hours <FaInfoCircle style={{ color: '#10b981', fontSize: 15 }} />
                  </h2>
                  <p style={{ fontSize: '2.1rem', fontWeight: 700, color: '#10b981', margin: 0 }}>{weeklySummary.totalHours} hrs</p>
                </div>
                <div className="summary-card" style={{
                  background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                  borderRadius: 16,
                  boxShadow: '0 4px 16px rgba(249,115,22,0.15)',
                  border: '2px solid #fdba74',
                  padding: '1.5rem 2rem',
                  textAlign: 'center',
                  minWidth: 200,
                  margin: '0 0.5rem',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }} title="Day with the most teaching hours"
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.15)';
                }}>
                  <h2 style={{ fontSize: '1.15rem', color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Busiest Day <FaInfoCircle style={{ color: '#f97316', fontSize: 15 }} />
                  </h2>
                  <p style={{ fontSize: '2.1rem', fontWeight: 700, color: '#f97316', margin: 0 }}>{weeklySummary.busiestDay}</p>
                </div>
              </section>
              <section className="charts" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', marginTop: '2rem' }}>
                <div className="chart" style={{
                  background: 'white',
                  borderRadius: 16,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  minWidth: 320,
                  flex: 1,
                  margin: '0 0.5rem',
                  maxWidth: 500,
                  transition: 'all 0.3s ease',
                  animation: 'fadeInChart 0.7s cubic-bezier(.4,0,.2,1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>
                  <h2 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>Daily Breakdown</h2>
                  <Bar data={barChartData} options={{ animation: { duration: 1200 } }} />
                </div>
                <div className="chart" style={{
                  background: 'white',
                  borderRadius: 16,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  minWidth: 320,
                  flex: 1,
                  margin: '0 0.5rem',
                  maxWidth: 500,
                  transition: 'all 0.3s ease',
                  animation: 'fadeInChart 0.7s cubic-bezier(.4,0,.2,1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}>
                  <h2 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>Weekly Overview</h2>
                  <Pie data={pieChartData} options={{ animation: { duration: 1200 } }} />
                </div>
              </section>

              {/* Weekly Schedule Table */}
              <section style={{ marginTop: 40 }}>
                <h2 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>Weekly Schedule</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 15 }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', color: 'white' }}>
                        <th style={{ padding: '14px', textAlign: 'left', fontWeight: '600' }}>Day</th>
                        <th style={{ padding: '14px', textAlign: 'left', fontWeight: '600' }}>Classes</th>
                        <th style={{ padding: '14px', textAlign: 'left', fontWeight: '600' }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadData.dailyBreakdown.map((d, i) => (
                        <tr key={d.day} style={{ 
                          background: i % 2 === 0 ? '#f8fafc' : '#fff',
                          transition: 'background 0.2s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#f8fafc' : '#fff'}>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e293b' }}>{d.day}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{d.classes}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b' }}>{d.hours} hrs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Motivational Tip */}
              <div style={{ 
                marginTop: 40, 
                textAlign: 'center', 
                color: '#64748b', 
                fontStyle: 'italic', 
                fontSize: 15, 
                padding: '20px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderRadius: 12,
                border: '1px solid #e2e8f0'
              }}>
                "Great teachers inspire hope, ignite the imagination, and instill a love of learning." – Brad Henry
              </div>
            </div>
            <style>{`
              @keyframes spin { 100% { transform: rotate(360deg); } }
              @keyframes fadeInCard { from { opacity: 0; transform: translateY(40px) scale(0.98); } to { opacity: 1; transform: none; } }
              @keyframes fadeInChart { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: none; } }
              @media (max-width: 900px) {
                .workload-summary { flex-direction: column !important; align-items: stretch !important; }
                .charts { flex-direction: column !important; align-items: stretch !important; }
              }
              @media (max-width: 600px) {
                .workload-container { padding: 0.5rem !important; }
                .chart { min-width: 0 !important; max-width: 100% !important; }
              }
            `}</style>
          </div>
    </div>
  );
};

export default InstructorWorkloadView;
