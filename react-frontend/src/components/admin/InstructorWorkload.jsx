

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaInfoCircle, FaUserCircle, FaDownload, FaCheckCircle, FaClock } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import { Bar, Pie } from 'react-chartjs-2';
import 'chart.js/auto';
import apiClient from '../../services/apiClient.js';
import '../../styles/InstructorWorkload.css';
const InstructorWorkload = () => {
  const { id } = useParams();
  
  // Clean the ID to remove any unexpected characters (like :1, port numbers, etc.)
  // Also handle cases where the ID might have been corrupted
  const cleanId = React.useMemo(() => {
    // Try to get ID from route params first
    let rawId = id;
    
    // If ID is not available from params, try to extract from URL
    if (!rawId || rawId.includes(':')) {
      const pathMatch = window.location.pathname.match(/\/instructor\/([^/]+)\/workload/);
      if (pathMatch && pathMatch[1]) {
        rawId = pathMatch[1];
        console.log('Extracted ID from URL path:', rawId);
      }
    }
    
    if (!rawId) return null;
    
    // Remove everything after : or ; (common URL corruption)
    let cleaned = rawId.trim().replace(/[:;].*$/, '').replace(/\s+/g, '');
    // Remove any non-hexadecimal characters (MongoDB ObjectIds are hex)
    cleaned = cleaned.replace(/[^a-f0-9]/gi, '');
    // Ensure it's exactly 24 characters (MongoDB ObjectId length)
    if (cleaned.length > 24) {
      cleaned = cleaned.substring(0, 24);
    }
    
    const result = cleaned.length === 24 ? cleaned : null;
    if (rawId !== result) {
      console.warn('ID was cleaned:', { original: rawId, cleaned: result });
    }
    return result;
  }, [id]);
  
  // Debug logging
  React.useEffect(() => {
    console.log('InstructorWorkload - Route params:', { id, cleanId, pathname: window.location.pathname });
  }, [id, cleanId]);
  
  const [workloadData, setWorkloadData] = useState(null);
  const [instructor, setInstructor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();
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
      // Add more as needed
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
      link.download = `instructor-workload-${cleanId}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      if (!cleanId) {
        setError('Instructor ID is missing');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      // Validate the ID format (MongoDB ObjectId is 24 hex characters)
      if (!/^[a-f\d]{24}$/i.test(cleanId)) {
        setError(`Invalid instructor ID format: "${cleanId}". Expected 24-character MongoDB ObjectId.`);
        setLoading(false);
        return;
      }
      
      // Final validation and cleaning
      const finalId = cleanId ? cleanId.replace(/[^a-f0-9]/gi, '').substring(0, 24) : null;
      
      if (!finalId || finalId.length !== 24) {
        setError(`Invalid instructor ID format: "${cleanId}". Expected 24-character MongoDB ObjectId.`);
        setLoading(false);
        return;
      }
      
      console.log('Fetching workload for instructor ID:', finalId, '(original:', id, ', cleaned:', cleanId, ')');
      console.log('Full URL will be:', `/api/instructors/${finalId}/workload`);
      
      try {
        // Fetch workload data with the final cleaned ID
        const workloadRes = await apiClient.get(`/api/instructors/${finalId}/workload`);
        if (workloadRes && workloadRes.data) {
          setWorkloadData(workloadRes.data);
          // If instructor info is included in workload response, use it
          if (workloadRes.data.instructor) {
            setInstructor(workloadRes.data.instructor);
          }
        } else {
          setError('No workload data received');
        }
        // Fetch instructor info separately if not included in workload response
        if (!workloadRes?.data?.instructor) {
          try {
            const instructorRes = await apiClient.getInstructorById(finalId);
            if (instructorRes && instructorRes.data) {
              setInstructor(instructorRes.data);
            }
          } catch (err) {
            // Instructor fetch failed, but workload data is available
            console.warn('Could not fetch instructor info:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching workload:', {
          error: err,
          response: err.response,
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
          instructorId: finalId,
          originalId: id,
          cleanedId: cleanId
        });
        
        if (err.response?.status === 404) {
          const errorData = err.response?.data;
          if (errorData?.message === 'Instructor not found') {
            setError(`Instructor not found. The instructor with ID "${finalId}" does not exist in the database.`);
          } else {
            setError(`Resource not found. Please verify the instructor ID is correct.`);
          }
        } else if (err.response?.status === 400) {
          setError(`Invalid instructor ID format. Please check the URL.`);
        } else {
          const errorMessage = err.response?.data?.message || err.message || 'Failed to load workload data';
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (cleanId) {
      fetchAll();
    } else {
      setError('Invalid instructor ID');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanId]); // cleanId is derived from id via useMemo, so id is already tracked

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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
        <div ref={cardRef} style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.28)',
          padding: '1rem',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
          animation: 'fadeInCard 0.5s cubic-bezier(.4,0,.2,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
            {instructor && instructor.image ? (
              <img src={instructor.image} alt="Instructor" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb', background: '#fff' }} />
            ) : (
              <FaUserCircle style={{ fontSize: 44, color: '#2563eb', background: '#fff', borderRadius: '50%' }} />
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                {instructor ? `${instructor.firstname || ''} ${instructor.lastname || ''}`.trim() : 'Instructor'}
                {instructor?.status && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    color: instructor.status === 'active' ? '#10b981' : instructor.status === 'pending' ? '#f59e42' : '#64748b',
                    background: instructor.status === 'active' ? 'rgba(16,185,129,0.10)' : instructor.status === 'pending' ? 'rgba(245,158,66,0.10)' : 'rgba(100,116,139,0.08)',
                    borderRadius: 8,
                    padding: '1px 8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    {instructor.status === 'active' ? <FaCheckCircle style={{ color: '#10b981' }} /> : <FaClock style={{ color: '#f59e42' }} />}
                    {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#334155', opacity: 0.9 }}>{instructor?.email}</div>
              {instructor?.department && <div style={{ fontSize: 12, color: getDeptColor(instructor.department), marginTop: 2, fontWeight: 600, display: 'inline-block', background: getDeptColor(instructor.department)+'18', borderRadius: 8, padding: '1px 8px' }}>{instructor.department}</div>}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                onClick={() => navigate('/admin/faculty-management')}
                style={{
                  background: '#fff',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontWeight: 600,
                  fontSize: 12,
                  boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,0.08)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.06)'; }}
                title="Back to Faculty Management"
              >
                ← Back
              </button>

              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  background: downloading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontWeight: 600,
                  fontSize: 12,
                  boxShadow: downloading ? 'none' : '0 4px 12px rgba(37,99,235,0.25)',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: downloading ? 0.6 : 1,
                }}
                onMouseOver={e => {
                  if (!downloading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37,99,235,0.35)';
                  }
                }}
                onMouseOut={e => {
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
          </div>
          <header className="workload-header" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.4rem', color: '#1e293b', fontWeight: '700', marginBottom: 6 }}>Workload Overview</h1>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 0 }}>Summary and breakdown of teaching load</p>
          </header>
          <section className="workload-summary" style={{ display: 'flex', gap: 18, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
            <div className="summary-card" style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
              border: '2px solid #bfdbfe',
              padding: '0.8rem 1rem',
              textAlign: 'center',
              minWidth: 150,
              margin: '0 0.4rem',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }} title="Total number of classes assigned"
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.25)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.15)';
            }}>
              <h2 style={{ fontSize: '1rem', color: '#374151', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Total Classes <FaInfoCircle style={{ color: '#2563eb', fontSize: 15 }} />
              </h2>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#2563eb', margin: 0 }}>{weeklySummary.totalClasses}</p>
            </div>
            <div className="summary-card" style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(16,185,129,0.15)',
              border: '2px solid #bbf7d0',
              padding: '0.8rem 1rem',
              textAlign: 'center',
              minWidth: 150,
              margin: '0 0.4rem',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }} title="Total teaching hours this week"
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.15)';
            }}>
              <h2 style={{ fontSize: '1.15rem', color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Total Hours <FaInfoCircle style={{ color: '#10b981', fontSize: 15 }} />
              </h2>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', margin: 0 }}>{weeklySummary.totalHours} hrs</p>
            </div>
            <div className="summary-card" style={{
              background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(249,115,22,0.15)',
              border: '2px solid #fdba74',
              padding: '0.8rem 1rem',
              textAlign: 'center',
              minWidth: 150,
              margin: '0 0.4rem',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
            }} title="Day with the most teaching hours"
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(249,115,22,0.25)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.15)';
            }}>
              <h2 style={{ fontSize: '1.15rem', color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Busiest Day <FaInfoCircle style={{ color: '#f97316', fontSize: 15 }} />
              </h2>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f97316', margin: 0 }}>{weeklySummary.busiestDay}</p>
            </div>
          </section>
          <section className="charts" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', marginTop: '2rem' }}>
            <div className="chart" style={{
              background: 'white',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              padding: '1rem',
              minWidth: 260,
              flex: 1,
              margin: '0 0.4rem',
              maxWidth: 420,
              transition: 'all 0.3s ease',
              animation: 'fadeInChart 0.7s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <h2 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: 12, textAlign: 'center', fontWeight: '600' }}>Daily Breakdown</h2>
              <Bar data={barChartData} options={{ animation: { duration: 1200 } }} />
            </div>
            <div className="chart" style={{
              background: 'white',
              borderRadius: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              border: '1px solid #e2e8f0',
              padding: '1rem',
              minWidth: 260,
              flex: 1,
              margin: '0 0.4rem',
              maxWidth: 420,
              transition: 'all 0.3s ease',
              animation: 'fadeInChart 0.7s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseOver={e => {
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <h2 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: 12, textAlign: 'center', fontWeight: '600' }}>Weekly Overview</h2>
              <Pie data={pieChartData} options={{ animation: { duration: 1200 } }} />
            </div>
          </section>

          {/* Weekly Schedule Table */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>Weekly Schedule</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', boxShadow: '0 3px 12px rgba(0,0,0,0.06)', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', color: 'white' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Day</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {workloadData.dailyBreakdown.map((d, i) => (
                    <tr key={d.day} style={{ 
                      background: i % 2 === 0 ? '#f8fafc' : '#fff',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#eff6ff'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? '#f8fafc' : '#fff'}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>{d.day}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{d.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Motivational Tip */}
          <div style={{ 
            marginTop: 28, 
            textAlign: 'center', 
            color: '#64748b', 
            fontStyle: 'italic', 
            fontSize: 13, 
            padding: '12px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderRadius: 10,
            border: '1px solid #e2e8f0'
          }}>
            "Great teachers inspire hope, ignite the imagination, and instill a love of learning." – Brad Henry
          </div>
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
  );
};

export default InstructorWorkload;
