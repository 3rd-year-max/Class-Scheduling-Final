import React, { useState, useEffect } from 'react';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import apiClient from '../../services/apiClient.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { io } from 'socket.io-client';
import { useToast } from '../common/ToastProvider.jsx';
import {
  faChalkboardTeacher,
  faCalendarAlt,
  faUsers,
  faChartBar,
  faBuilding,
} from '@fortawesome/free-solid-svg-icons';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const AdminDashboard = () => {
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summaryStats, setSummaryStats] = useState({
    totalInstructors: 0,
    totalSchedules: 0,
    totalRooms: 0,
    totalSections: 0
  });
  const [scheduleByYear, setScheduleByYear] = useState([]);
  const [instructorWorkload, setInstructorWorkload] = useState([]);
  const [roomUsage, setRoomUsage] = useState([]);

  useEffect(() => {
    const fetchSummaryStats = async () => {
      try {
        // Fetch all data in parallel using apiClient
        const [instructorsRes, schedulesRes, roomsRes, sectionsRes] = await Promise.all([
          apiClient.get('/api/instructors'),
          apiClient.get('/api/schedule'),
          apiClient.get('/api/rooms'),
          apiClient.get('/api/sections') // Fetch sections directly for accurate count
        ]);
        
        console.log('Instructors Response:', instructorsRes.data);
        console.log('Schedules Response:', schedulesRes.data);
        console.log('Rooms Response:', roomsRes.data);
        console.log('Sections Response:', sectionsRes.data);
        
        // Handle both plain array and wrapper responses
        const instructorsArray = Array.isArray(instructorsRes.data) ? instructorsRes.data : instructorsRes.data?.instructors || [];
        const schedulesArray = Array.isArray(schedulesRes.data) ? schedulesRes.data : schedulesRes.data?.schedules || [];
        const roomsArray = Array.isArray(roomsRes.data) ? roomsRes.data : roomsRes.data?.rooms || [];
        const sectionsArray = Array.isArray(sectionsRes.data) ? sectionsRes.data : sectionsRes.data?.sections || [];
        
        // Calculate stats
        const scheduleByYearMap = {};
        const instructorWorkloadMap = {};
        const roomUsageMap = {};

        if (Array.isArray(schedulesArray)) {
          schedulesArray.forEach(schedule => {
            // Count schedules by year (only active/non-archived)
            if (!schedule.archived) {
              const year = schedule.year || 'Unknown';
              scheduleByYearMap[year] = (scheduleByYearMap[year] || 0) + 1;
              
              // Count instructor workload
              const instructor = schedule.instructor || 'Unknown';
              instructorWorkloadMap[instructor] = (instructorWorkloadMap[instructor] || 0) + 1;
              
              // Count room usage
              const room = schedule.room || 'Unknown';
              roomUsageMap[room] = (roomUsageMap[room] || 0) + 1;
            }
          });
        }

        // Use directly fetched sections for accurate count (not derived from schedules)
        const totalSections = Array.isArray(sectionsArray) ? sectionsArray.length : 0;

        // Helper function to convert year number to ordinal (1st, 2nd, 3rd, 4th)
        const getOrdinalYear = (year) => {
          const num = parseInt(year);
          if (isNaN(num)) return `Year ${year}`;
          const suffixes = ['th', 'st', 'nd', 'rd'];
          const suffix = (num % 100 >= 11 && num % 100 <= 13) ? 'th' : suffixes[num % 10] || 'th';
          return `${num}${suffix} Year`;
        };

        // Convert maps to chart data
        const scheduleByYearData = Object.entries(scheduleByYearMap)
          .map(([year, count]) => ({ year: getOrdinalYear(year), yearNum: parseInt(year) || 999, schedules: count }))
          .sort((a, b) => a.yearNum - b.yearNum)
          .map(({ year, schedules }) => ({ year, schedules }));

        const instructorWorkloadData = Object.entries(instructorWorkloadMap)
          .map(([instructor, count]) => ({ name: instructor, classes: count }))
          .sort((a, b) => b.classes - a.classes)
          .slice(0, 8); // Top 8 instructors

        const roomUsageData = Object.entries(roomUsageMap)
          .map(([room, count]) => ({ room, uses: count }))
          .sort((a, b) => b.uses - a.uses);

        setScheduleByYear(scheduleByYearData);
        setInstructorWorkload(instructorWorkloadData);
        setRoomUsage(roomUsageData);
        
        const stats = {
          totalInstructors: instructorsArray.length,
          totalSchedules: schedulesArray.length,
          totalRooms: roomsArray.length,
          totalSections: totalSections
        };
        
        console.log('Summary Stats:', stats);
        setSummaryStats(stats);
      } catch (err) {
        console.error('Failed to load summary stats', err);
      }
    };

    fetchSummaryStats();
  }, []);

  // Setup Socket.io for real-time updates (admin sees all changes)
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_BASE || 'http://localhost:5000', { autoConnect: true });

    socket.on('connect', () => {
      console.log('✅ Admin connected to real-time updates');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
    });

    // Real-time schedule creation
    socket.on('schedule-created', (data) => {
      console.log('📢 New schedule created:', data);
      // Increment schedule count and show notification
      setSummaryStats(prev => ({
        ...prev,
        totalSchedules: prev.totalSchedules + 1
      }));
      showToast('✓ New schedule created in system', 'success', 2000);
    });

    // Real-time schedule updates
    socket.on('schedule-updated', (data) => {
      console.log('📢 Schedule updated:', data);
      // Show notification without changing count (same number of schedules)
      showToast('✓ Schedule updated', 'info', 2000);
    });

    // Real-time schedule deletions
    socket.on('schedule-deleted', (data) => {
      console.log('📢 Schedule deleted:', data);
      // Decrement schedule count and show notification
      setSummaryStats(prev => ({
        ...prev,
        totalSchedules: Math.max(0, prev.totalSchedules - 1)
      }));
      showToast('✓ Schedule removed from system', 'info', 2000);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from real-time updates');
    });

    return () => {
      socket.disconnect();
    };
  }, [showToast]);

  const statCards = [
    {
      label: 'Total Instructors',
      value: summaryStats.totalInstructors,
      subtitle: 'Active faculty members',
      icon: faChalkboardTeacher,
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      bgColor: '#fef3c7',
      iconColor: '#f97316',
    },
    {
      label: 'Total Schedules',
      value: summaryStats.totalSchedules,
      subtitle: 'Classes scheduled',
      icon: faCalendarAlt,
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      bgColor: '#e0f2fe',
      iconColor: '#0ea5e9',
    },
    {
      label: 'Total Rooms',
      value: summaryStats.totalRooms,
      subtitle: 'Available facilities',
      icon: faBuilding,
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      bgColor: '#d1fae5',
      iconColor: '#10b981',
    },
    {
      label: 'Total Sections',
      value: summaryStats.totalSections,
      subtitle: 'Student groups',
      icon: faUsers,
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
      bgColor: '#e0e7ff',
      iconColor: '#6366f1',
    },
  ];

  return (
    <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <Header title="Admin Dashboard" onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
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
                <FontAwesomeIcon icon={faChartBar} style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                }}>
                  Welcome to the Admin Dashboard
                </h2>
                <p style={{
                  margin: '6px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500',
                }}>
                  Manage your class scheduling system efficiently with real-time insights and analytics
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Overview Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
            marginBottom: '40px'
          }}>
            {statCards.map((card, index) => (
              <div
                key={index}
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
                }}
              >
                {/* Decorative gradient bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: card.gradient,
                }} />
                
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: '0 0 8px 0',
                      fontSize: '13px',
                      color: '#64748b',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {card.label}
                    </p>
                    <h3 style={{
                      margin: '0 0 6px 0',
                      fontSize: '32px',
                      fontWeight: '800',
                      color: '#0f172a',
                      lineHeight: '1.2',
                    }}>
                      {card.value}
                    </h3>
                    <span style={{
                      fontSize: '13px',
                      color: '#94a3b8',
                      fontWeight: '500',
                    }}>
                      {card.subtitle}
                    </span>
                  </div>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: card.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    color: card.iconColor,
                    flexShrink: 0,
                    boxShadow: `0 4px 12px ${card.iconColor}20`,
                  }}>
                    <FontAwesomeIcon icon={card.icon} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Data Visualizations */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '24px',
            marginTop: '20px'
          }}>
            {/* Schedule Distribution by Year - Enhanced */}
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '5px',
                height: '100%',
                background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
              }} />
              <div style={{ paddingLeft: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '18px',
                  }}>
                    <FontAwesomeIcon icon={faChartBar} />
                  </div>
                  <div>
                    <h3 style={{
                      color: '#1e293b',
                      fontSize: '18px',
                      fontWeight: '700',
                      margin: 0,
                      letterSpacing: '-0.3px',
                    }}>
                      Schedules by Year Level
                    </h3>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: '#64748b',
                    }}>
                      Distribution across academic years
                    </p>
                  </div>
                </div>
                {scheduleByYear.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={scheduleByYear}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="year"
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      <Bar
                        dataKey="schedules"
                        fill="url(#colorGradient1)"
                        radius={[12, 12, 0, 0]}
                      />
                      <defs>
                        <linearGradient id="colorGradient1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#94a3b8',
                  }}>
                    <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top Instructors by Workload - Enhanced */}
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '5px',
                height: '100%',
                background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
              }} />
              <div style={{ paddingLeft: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '18px',
                  }}>
                    <FontAwesomeIcon icon={faChalkboardTeacher} />
                  </div>
                  <div>
                    <h3 style={{
                      color: '#1e293b',
                      fontSize: '18px',
                      fontWeight: '700',
                      margin: 0,
                      letterSpacing: '-0.3px',
                    }}>
                      Top Instructors by Classes
                    </h3>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: '#64748b',
                    }}>
                      Most active faculty members
                    </p>
                  </div>
                </div>
                {instructorWorkload.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={instructorWorkload} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        fontSize={12}
                        stroke="#64748b"
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      <Bar
                        dataKey="classes"
                        fill="url(#colorGradient2)"
                        radius={[0, 12, 12, 0]}
                      />
                      <defs>
                        <linearGradient id="colorGradient2" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#94a3b8',
                  }}>
                    <FontAwesomeIcon icon={faChalkboardTeacher} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Room Usage Distribution - Enhanced */}
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              position: 'relative',
              overflow: 'hidden',
              gridColumn: '1 / -1',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '5px',
                height: '100%',
                background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
              }} />
              <div style={{ paddingLeft: '12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '18px',
                  }}>
                    <FontAwesomeIcon icon={faBuilding} />
                  </div>
                  <div>
                    <h3 style={{
                      color: '#1e293b',
                      fontSize: '18px',
                      fontWeight: '700',
                      margin: 0,
                      letterSpacing: '-0.3px',
                    }}>
                      Room Usage Distribution
                    </h3>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12px',
                      color: '#64748b',
                    }}>
                      Facility utilization across campus
                    </p>
                  </div>
                </div>
                {roomUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={roomUsage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ room, percent }) => `${room}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="uses"
                      >
                        {roomUsage.map((entry, index) => {
                          const colors = [
                            '#3b82f6', '#f59e0b', '#10b981', '#ef4444',
                            '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
                            '#6366f1', '#14b8a6', '#f43f5e', '#a855f7'
                          ];
                          return (
                            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#94a3b8',
                  }}>
                    <FontAwesomeIcon icon={faBuilding} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '13px' }}>No data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 1200px) {
          div[style*="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
