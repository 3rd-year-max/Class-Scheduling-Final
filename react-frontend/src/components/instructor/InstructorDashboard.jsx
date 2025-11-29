import InstructorSidebar from '../common/InstructorSidebar.jsx';
import InstructorHeader from '../common/InstructorHeader.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faCalendarAlt, faClock, faMapMarkerAlt, faFilter, faCalendarWeek, faSync, faExternalLinkAlt, faCheckCircle, faExclamationCircle, faChevronDown, faChevronUp, faListCheck, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import '../../styles/InstructorDashboard.css';
import { AuthContext } from '../../context/AuthContext.jsx';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '../common/ToastProvider.jsx';

const InstructorDashboard = () => {
  const { userEmail } = useContext(AuthContext);
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // 🟢 CHANGED: separated fields for first and last name
  const [instructorData, setInstructorData] = useState({ 
    instructorId: '',
    firstname: '', 
    lastname: '', 
    image: '' 
  });

  const [allSchedules, setAllSchedules] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [syncedSchedules, setSyncedSchedules] = useState([]);
  const [calendarConfigured, setCalendarConfigured] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [weeklyWorkload, setWeeklyWorkload] = useState({ classes: 0, totalMinutes: 0, averageDailyMinutes: 0, daysWithClasses: 0 });
  const [calendarMinimized, setCalendarMinimized] = useState(true);
  
  // To-Do List State
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');

  // Load todos from localStorage on mount
  useEffect(() => {
    const savedTodos = localStorage.getItem(`todos_${userEmail}`);
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, [userEmail]);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (userEmail && todos.length >= 0) {
      localStorage.setItem(`todos_${userEmail}`, JSON.stringify(todos));
    }
  }, [todos, userEmail]);

  // Add new todo
  const handleAddTodo = () => {
    if (newTodo.trim()) {
      setTodos([...todos, { id: Date.now(), text: newTodo.trim(), completed: false }]);
      setNewTodo('');
    }
  };

  // Toggle todo completion
  const handleToggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  // Delete todo
  const handleDeleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  // Filter schedules based on selected day
  const filteredSchedules = 'all' 
    ? allSchedules 
    : allSchedules.filter(schedule => {
        const scheduleDays = schedule.day.toLowerCase();
        return scheduleDays.includes('');
      });

  useEffect(() => {
    if (!userEmail) {
      console.log('No userEmail available yet');
      return;
    }

    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
    
    const resolveImageUrl = (value) => {
      if (!value) return '/images/tiger.png';
      if (value.startsWith('http')) return value;
      if (value.startsWith('/uploads/')) return `${apiBase}${value}`;
      return value;
    };

    const fetchInstructorData = () => {
      console.log('Fetching instructor profile via token for email:', userEmail);
      const token = localStorage.getItem('token');
      fetch(`${apiBase}/api/instructors/profile/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(async res => {
          console.log('Profile /me response status:', res.status);
          if (res.ok) return res.json();
          // Fallback to by-email if JWT-protected endpoint fails
          const fb = await fetch(`${apiBase}/api/instructors/profile/by-email/${encodeURIComponent(userEmail)}`);
          if (!fb.ok) throw new Error(`Failed to fetch profile data: ${res.status} ${res.statusText}`);
          return fb.json();
        })
        .then(data => {
          console.log('Instructor data received:', data);
          setInstructorData({
            instructorId: data.instructorId || '',
            firstname: data.firstname || '',
            lastname: data.lastname || '',
            image: resolveImageUrl(data.image || '')
          });
        })
        .catch(error => {
          console.error('Error fetching instructor data:', error);
          // Reset to neutral values on error (avoid showing "Error Loading...")
          setInstructorData({ instructorId: '', firstname: '', lastname: '', image: '' });
        });
    };

    fetchInstructorData();
  }, [userEmail]);

  useEffect(() => {
    // 🟢 CHANGED: Use instructor's email to fetch schedules instead of name
    if (!userEmail) {
      console.log('Skipping schedule fetch - user email not available:', userEmail);
      return;
    }

    const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

    const fetchScheduleData = async () => {
      console.log('Fetching schedules for instructor email:', userEmail);
      try {
        const token = localStorage.getItem('token');
        const emailRes = await fetch(`${apiBase}/api/schedule/instructor/${encodeURIComponent(userEmail)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('Schedule (email) response status:', emailRes.status);
        if (!emailRes.ok) {
          const errorData = await emailRes.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch by email: ${emailRes.status} ${emailRes.statusText}`);
        }
        const emailData = await emailRes.json();

        const normalize = (data) => Array.isArray(data) ? data : (data?.schedules || []);
        let emailSchedules = normalize(emailData);

        // Fallback: also fetch by name and merge unique
        let nameSchedules = [];
        const name = [instructorData.firstname, instructorData.lastname].filter(Boolean).join(' ').trim();
        if (name.length > 0) {
          const token = localStorage.getItem('token');
          const nameRes = await fetch(`${apiBase}/api/schedule/instructor/by-name/${encodeURIComponent(name)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          console.log('Schedule (name) response status:', nameRes.status);
          if (nameRes.ok) {
            const nameData = await nameRes.json();
            nameSchedules = normalize(nameData);
          }
        }

        const keyOf = (s) => `${s._id || ''}|${s.day}|${s.time}|${s.subject}`;
        const map = new Map();
        [...emailSchedules, ...nameSchedules].forEach(s => {
          if (!s) return;
          const k = keyOf(s);
          if (!map.has(k)) map.set(k, s);
        });
        const merged = Array.from(map.values());
        console.log('✅ Merged schedules count:', merged.length);
        setAllSchedules(merged);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setAllSchedules([]);
      }
    };

    fetchScheduleData();
  }, [userEmail, instructorData.firstname, instructorData.lastname]); // ensure fallback by name has data

  // Parse time range like "8:00 AM - 10:00 AM" into minutes duration
  const parseDurationMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split('-').map(p => p.trim());
    if (parts.length < 2) return 0;

    const parseTime = (t) => {
      t = t.replace(/\s+/g, ' ').trim();
      t = t.replace(/(AM|PM|am|pm)$/i, (m) => ' ' + m.toUpperCase());
      const [timePart, modifier] = t.split(' ');
      if (!timePart) return 0;
      const [hStr, mStr] = timePart.split(':');
      let h = parseInt(hStr || '0', 10);
      let m = parseInt(mStr || '0', 10) || 0;
      const mod = (modifier || '').toLowerCase();
      if (mod === 'pm' && h !== 12) h += 12;
      if (mod === 'am' && h === 12) h = 0;
      return h * 60 + m;
    };

    try {
      const start = parseTime(parts[0]);
      const end = parseTime(parts[1]);
      return Math.max(0, end - start);
    } catch (e) {
      return 0;
    }
  };

  // Compute weekly workload from schedules (treat schedules as recurring weekly slots)
  useEffect(() => {
    if (!Array.isArray(allSchedules)) {
      setWeeklyWorkload({ classes: 0, totalMinutes: 0, averageDailyMinutes: 0, daysWithClasses: 0 });
      return;
    }

    const daySet = new Set();
    let classes = 0;
    let totalMinutes = 0;

    allSchedules.forEach(s => {
      if (!s) return;
      const day = (s.day || '').toString().toLowerCase().trim();
      if (!day) return;
      const duration = parseDurationMinutes(s.time || '');
      classes += 1;
      totalMinutes += duration;
      daySet.add(day);
    });

    const daysWithClasses = daySet.size;
    const averageDailyMinutes = daysWithClasses > 0 ? Math.round(totalMinutes / daysWithClasses) : 0;

    setWeeklyWorkload({ classes, totalMinutes, averageDailyMinutes, daysWithClasses });
  }, [allSchedules]);

  const workloadByDay = useMemo(() => {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const summary = new Map();

    allSchedules.forEach((schedule) => {
      if (!schedule?.day) return;
      const normalizedDay = schedule.day.toLowerCase();
      const minutes = parseDurationMinutes(schedule.time);
      const current = summary.get(normalizedDay) || { classes: 0, minutes: 0 };
      summary.set(normalizedDay, {
        classes: current.classes + 1,
        minutes: current.minutes + minutes,
      });
    });

    return dayOrder.map((day) => ({
      key: day,
      label: day.charAt(0).toUpperCase() + day.slice(1),
      classes: summary.get(day)?.classes || 0,
      minutes: summary.get(day)?.minutes || 0,
    }));
  }, [allSchedules]);

  const busiestDay = useMemo(() => {
    return workloadByDay.reduce(
      (acc, day) => {
        if (day.minutes === 0) return acc;
        if (!acc || day.minutes > acc.minutes) return day;
        return acc;
      },
      null
    );
  }, [workloadByDay]);

  const formatMinutesVerbose = (minutes) => {
    if (!minutes) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs && mins) return `${hrs}h ${mins}m`;
    if (hrs) return `${hrs}h`;
    return `${mins}m`;
  };

  // Fetch Google Calendar events
  useEffect(() => {
    if (!userEmail) return;

    const fetchCalendarEvents = async () => {
      setLoadingCalendar(true);
      try {
        const token = localStorage.getItem('token');
        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
        
        const response = await fetch(`${apiBase}/api/instructors/calendar/events`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCalendarEvents(data.events || []);
          setSyncedSchedules(data.syncedSchedules || []);
          setCalendarConfigured(data.configured || false);
        } else if (response.status === 503) {
          // Google Calendar not configured
          setCalendarConfigured(false);
          setCalendarEvents([]);
          setSyncedSchedules([]);
        }
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        setCalendarConfigured(false);
      } finally {
        setLoadingCalendar(false);
      }
    };

    fetchCalendarEvents();
  }, [userEmail]);

  // Setup Socket.io for real-time room status notifications and schedule updates
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_BASE || 'http://localhost:5000', { autoConnect: true });

    socket.on('connect', () => {
      console.log('✅ Connected to server for notifications');
      // Subscribe to instructor-specific updates
      if (userEmail) {
        socket.emit('join-instructor-channel', { email: userEmail });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
    });

    socket.on('room-status-changed', (data) => {
      console.log('📢 Room status changed event received:', data);
      // Show toast notification to instructor
      showToast(data.message, 'info');
    });

    // Real-time schedule creation
    socket.on('schedule-created', (data) => {
      console.log('📢 New schedule created:', data);
      // Refresh schedules without page flickering
      setAllSchedules(prev => [...prev, data.schedule]);
      showToast('✓ New schedule added', 'success', 2000);
    });

    // Real-time schedule updates
    socket.on('schedule-updated', (data) => {
      console.log('📢 Schedule updated:', data);
      // Update the schedule in state without full refresh
      setAllSchedules(prev => 
        prev.map(s => s._id === data.schedule._id ? data.schedule : s)
      );
      showToast('✓ Schedule updated', 'success', 2000);
    });

    // Real-time schedule deletions
    socket.on('schedule-deleted', (data) => {
      console.log('📢 Schedule deleted:', data);
      // Remove the schedule from state
      setAllSchedules(prev => prev.filter(s => s._id !== data.scheduleId));
      showToast('✓ Schedule removed', 'info', 2000);
    });

    // Instructor-specific updates (only affects this instructor)
    socket.on(`schedule-update-${userEmail}`, (data) => {
      console.log('📢 Your schedule changed:', data);
      if (data.action === 'created') {
        setAllSchedules(prev => [...prev, data.schedule]);
      } else if (data.action === 'updated') {
        setAllSchedules(prev => 
          prev.map(s => s._id === data.schedule._id ? data.schedule : s)
        );
      } else if (data.action === 'deleted') {
        setAllSchedules(prev => prev.filter(s => s._id !== data.scheduleId));
      }
      showToast(`✓ Your schedule ${data.action}`, 'success', 2000);
    });

    // Real-time instructor notifications
    socket.on(`notification-${userEmail}`, (data) => {
      console.log('🔔 New notification received:', data);
      if (data.action === 'new-notification' && data.notification) {
        // Show notification toast with the title and message preview
        const messagePreview = data.notification.message.split('\n')[0];
        showToast(messagePreview, 'info', 3000);
      }
    });

    // Global notifications for system-wide broadcasts
    socket.on('notifications', (data) => {
      console.log('📢 Global notification broadcast:', data);
      if (data.instructorEmail === userEmail && data.notification) {
        // Show notification toast
        const messagePreview = data.notification.message.split('\n')[0];
        showToast(messagePreview, 'info', 3000);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
    });

    return () => {
      socket.disconnect();
    };
  }, [userEmail, showToast]);

  if (!userEmail) {
    return <p>Loading user information...</p>;
  }

  // Format date for display
  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };


  // Get Google Calendar URL
  const getGoogleCalendarUrl = () => {
    return `https://calendar.google.com/calendar/u/0/r`;
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', height: '100vh' }}>
      <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <InstructorHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="dashboard-content responsive-shell" style={{ marginTop: '140px' }}>
          {/* Welcome Section */}
          <div className="welcome-section" style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <FontAwesomeIcon icon={faUser} style={{ fontSize: 32, color: '#f97316' }} />
              <h2 style={{ margin: 0 }}>
                Welcome, {instructorData.firstname && instructorData.lastname 
                  ? `${instructorData.firstname} ${instructorData.lastname}`
                  : instructorData.firstname || instructorData.lastname || 'Instructor'}!
              </h2>
            </div>
            <p style={{ margin: 0 }}>
              Here's your dashboard overview and today's class schedule.
              {instructorData.instructorId && (
                <span style={{ marginLeft: '12px', padding: '4px 10px', background: '#e0e7ff', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#4f46e5' }}>
                  ID-{instructorData.instructorId}
                </span>
              )}
            </p>
          </div>


          {/* Weekly Workload Summary */}
          <div className="workload-grid">
            <article className="workload-summary-card">
              <div className="workload-summary-card__meta">
                <p>Classes This Week</p>
                <h3>{weeklyWorkload.classes}</h3>
                <span>{weeklyWorkload.daysWithClasses} active day(s)</span>
              </div>
              <div className="workload-summary-card__icon workload-summary-card__icon--orange">
                <FontAwesomeIcon icon={faCalendarWeek} />
              </div>
            </article>

            <article className="workload-summary-card">
              <div className="workload-summary-card__meta">
                <p>Total Hours</p>
                <h3>{(weeklyWorkload.totalMinutes / 60).toFixed(1)}h</h3>
                <span>{weeklyWorkload.totalMinutes} total minutes</span>
              </div>
              <div className="workload-summary-card__icon workload-summary-card__icon--sky">
                <FontAwesomeIcon icon={faClock} />
              </div>
            </article>

            <article className="workload-summary-card">
              <div className="workload-summary-card__meta">
                <p>Avg Hours / Day</p>
                <h3>{(weeklyWorkload.averageDailyMinutes / 60 || 0).toFixed(2)}h</h3>
                <span>Based on teaching days</span>
              </div>
              <div className="workload-summary-card__icon workload-summary-card__icon--green">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
            </article>

            <article className="workload-summary-card">
              <div className="workload-summary-card__meta">
                <p>Busiest Day</p>
                <h3>{busiestDay ? busiestDay.label : '—'}</h3>
                <span>
                  {busiestDay
                    ? `${busiestDay.classes} class(es) · ${formatMinutesVerbose(busiestDay.minutes)}`
                    : 'No classes yet'}
                </span>
              </div>
              <div className="workload-summary-card__icon workload-summary-card__icon--slate">
                <FontAwesomeIcon icon={faFilter} />
              </div>
            </article>
          </div>

          {/* To-Do List Section */}
          <div style={{ 
            background: 'white', 
            borderRadius: '16px', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
            padding: '24px',
            marginBottom: '30px',
            border: '2px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontSize: '20px', fontWeight: '700' }}>
                <FontAwesomeIcon icon={faListCheck} style={{ color: '#f97316' }} />
                My To-Do List
              </h3>
              <span style={{ 
                background: 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)', 
                color: 'white', 
                padding: '4px 12px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: '600' 
              }}>
                {todos.filter(t => !t.completed).length} pending
              </span>
            </div>

            {/* Add Todo Input */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Add a new task..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#f97316'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                onClick={handleAddTodo}
                style={{
                  background: 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 10px rgba(15, 44, 99, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 44, 99, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(15, 44, 99, 0.2)';
                }}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add Task
              </button>
            </div>

            {/* Todo List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todos.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  <FontAwesomeIcon icon={faListCheck} style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ margin: 0 }}>No tasks yet. Add your first task above!</p>
                </div>
              ) : (
                <div style={{
                  maxHeight: '350px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  paddingRight: '8px',
                  scrollBehavior: 'smooth'
                }}>
                  {todos.map((todo) => (
                  <div
                    key={todo.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: todo.completed ? '#f8fafc' : 'white',
                      border: `2px solid ${todo.completed ? '#e2e8f0' : '#e5e7eb'}`,
                      borderRadius: '10px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!todo.completed) {
                        e.currentTarget.style.borderColor = '#f97316';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(249, 115, 22, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = todo.completed ? '#e2e8f0' : '#e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id)}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: '#f97316'
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: '14px',
                        color: todo.completed ? '#94a3b8' : '#1e293b',
                        textDecoration: todo.completed ? 'line-through' : 'none',
                        fontWeight: todo.completed ? '400' : '500'
                      }}
                    >
                      {todo.text}
                    </span>
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        transition: 'background 0.2s',
                        fontSize: '14px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Delete task"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                  ))}
                </div>
              )}
              {todos.length > 5 && (
                <div style={{
                  textAlign: 'center',
                  padding: '12px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontStyle: 'italic'
                }}>
                  Showing 5 of {todos.length} tasks (scroll to see more)
                </div>
              )}
            </div>
          </div>

          

            {/* Schedule Results */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
                  {filteredSchedules.length > 0 
                    ? `Showing ${filteredSchedules.length} ${filteredSchedules.length === 1 ? 'class' : 'classes'} for all days`
                    : `No classes found in your schedule`
                  }
                </span>
                {filteredSchedules.length > 0 && (
                  <span style={{ 
                    color: '#f97316', 
                    fontSize: '12px', 
                    fontWeight: '600',
                    background: 'rgba(249, 115, 22, 0.1)',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}>
                    {filteredSchedules.length} {filteredSchedules.length === 1 ? 'CLASS' : 'CLASSES'}
                  </span>
                )}
              </div>
            </div>

            {filteredSchedules.length > 0 ? (
              /* Scrollable Table Container */
              <div
                style={{
                  width: '100%',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  overflowX: 'auto',
                  border: '2px solid #e5e7eb',
                  borderRadius: '14px',
                  background: 'white'
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                    fontSize: '15px',
                  }}
                >
                  <colgroup>
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '35%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      background: 'linear-gradient(135deg, #0f2c63 0%, #f97316 100%)',
                      color: 'white',
                    }}
                  >
                    <tr>
                      <th
                        style={{
                          padding: '20px 16px',
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '14px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '8px' }} />
                        Day
                      </th>
                      <th
                        style={{
                          padding: '20px 16px',
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '14px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px' }} />
                        Time
                      </th>
                      <th
                        style={{
                          padding: '20px 16px',
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '14px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px' }} />
                        Subject
                      </th>
                      <th
                        style={{
                          padding: '20px 16px',
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '14px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <FontAwesomeIcon icon={faMapMarkerAlt} style={{ marginRight: '8px' }} />
                        Room
                      </th>
                      <th
                        style={{
                          padding: '20px 16px',
                          textAlign: 'left',
                          fontWeight: '700',
                          fontSize: '14px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        <FontAwesomeIcon icon={faUser} style={{ marginRight: '8px' }} />
                        Section
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules
                      .sort((a, b) => {
                        // Sort by day first, then by time
                        const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const dayComparison = dayOrder.indexOf(a.day.toLowerCase()) - dayOrder.indexOf(b.day.toLowerCase());
                        if (dayComparison !== 0) return dayComparison;
                        
                        // Then sort by time
                        const timeStringToMinutes = (timeStr) => {
                          const cleanTime = timeStr.trim().split(' - ')[0];
                          let [time, modifier] = cleanTime.split(' ');
                          if (!modifier) return 0;
                          let [h, m] = time.split(':').map(Number);
                          if (modifier.toLowerCase() === 'pm' && h !== 12) h += 12;
                          if (modifier.toLowerCase() === 'am' && h === 12) h = 0;
                          return h * 60 + (m || 0);
                        };
                        return timeStringToMinutes(a.time) - timeStringToMinutes(b.time);
                      })
                      .map((schedule, index) => (
                        <tr 
                          key={index} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9',
                            background: index % 2 === 0 ? '#f8fafc' : 'white',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#e0f2fe';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = index % 2 === 0 ? '#f8fafc' : 'white';
                          }}
                        >
                          <td
                            style={{
                              padding: '18px 16px',
                              color: '#1e293b',
                              fontWeight: '600',
                              fontSize: '14px',
                            }}
                          >
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px'
                              }}
                            >
                              {schedule.day}
                            </span>
                          </td>
                          <td 
                            style={{ 
                              padding: '18px 16px', 
                              color: '#374151', 
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            {schedule.time}
                          </td>
                          <td 
                            style={{ 
                              padding: '18px 16px', 
                              color: '#1e293b', 
                              fontSize: '15px',
                              fontWeight: '600'
                            }}
                          >
                            {schedule.subject}
                          </td>
                          <td 
                            style={{ 
                              padding: '18px 16px', 
                              color: '#374151', 
                              fontSize: '14px',
                              fontWeight: '500'
                            }}
                          >
                            <span
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}
                            >
                              {schedule.room}
                            </span>
                          </td>
                          <td 
                            style={{ 
                              padding: '18px 16px', 
                              color: '#64748b', 
                              fontSize: '13px',
                              fontWeight: '500'
                            }}
                          >
                            {schedule.course?.toUpperCase()}-{schedule.year?.charAt(0)?.toUpperCase()}{schedule.section}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px', 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                borderRadius: '15px',
                border: '2px dashed #cbd5e1'
              }}>
                <FontAwesomeIcon 
                  icon={faCalendarAlt} 
                  style={{ 
                    fontSize: '64px', 
                    marginBottom: '20px', 
                    color: '#cbd5e1'
                  }} 
                />
                <h4 style={{ 
                  color: '#64748b', 
                  fontSize: '20px', 
                  fontWeight: '600',
                  margin: '0 0 10px 0'
                }}>
                  No Classes Found
                </h4>
                <p style={{ 
                  color: '#94a3b8', 
                  fontSize: '16px', 
                  margin: 0,
                  maxWidth: '400px',
                  marginLeft: 'auto',
                  marginRight: 'auto'
                }}>
                  {'' === 'all' 
                    ? 'You don\'t have any classes scheduled yet. Contact your administrator to assign classes.'
                    : `No classes are scheduled for . Try selecting a different day.`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Google Calendar Section */}
          {calendarConfigured && (
            <div className="instructor-card calendar-card">
              <div className="section-header">
                <div className="section-title">
                  <FontAwesomeIcon icon={faCalendarAlt} className="section-icon" />
                  <div>
                    <p className="section-eyebrow">Google Calendar</p>
                    <h3 className="section-heading">Upcoming events</h3>
                  </div>
                  {syncedSchedules.length > 0 && (
                    <span className="calendar-chip">
                      <FontAwesomeIcon icon={faCheckCircle} style={{ fontSize: '11px' }} />
                      {syncedSchedules.length} synced
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <a
                    className="calendar-link"
                    href={getGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                    Open Calendar
                  </a>
                  <button
                    onClick={() => setCalendarMinimized(prev => !prev)}
                    aria-expanded={!calendarMinimized}
                    title={calendarMinimized ? 'Show calendar details' : 'Minimize calendar'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#374151',
                      padding: '6px'
                    }}
                  >
                    <FontAwesomeIcon icon={calendarMinimized ? faChevronDown : faChevronUp} />
                  </button>
                </div>
              </div>

              {loadingCalendar ? (
                <div className="card-loading">
                  <FontAwesomeIcon icon={faSync} spin className="card-loading__icon" />
                  <p>Loading calendar events...</p>
                </div>
              ) : calendarMinimized ? (
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ color: '#0f172a' }}>{calendarEvents[0]?.summary || (calendarEvents.length > 0 ? 'Upcoming event' : 'No events')}</strong>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>{calendarEvents.length > 0 ? formatEventDate(calendarEvents[0]?.start?.dateTime || calendarEvents[0]?.start?.date || '') : 'No upcoming calendar events'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>{calendarEvents.length} events</span>
                    <button onClick={() => setCalendarMinimized(false)} style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>Show details</button>
                  </div>
                </div>
              ) : calendarEvents.length > 0 ? (
                <div className="calendar-events">
                  {calendarEvents.slice(0, 5).map((event, index) => (
                    <div key={event.id || index} className="calendar-event">
                      <h5>{event.summary || 'Untitled Event'}</h5>
                      <div className="calendar-event__meta">
                        <span>
                          <FontAwesomeIcon icon={faClock} /> {formatEventDate(event.start?.dateTime || event.start?.date || '')}
                        </span>
                        {event.location && (
                          <span>
                            <FontAwesomeIcon icon={faMapMarkerAlt} /> {event.location}
                          </span>
                        )}
                      </div>
                      {event.description && (
                        <p className="calendar-event__description">
                          {event.description.split('\n')[0]}
                        </p>
                      )}
                    </div>
                  ))}
                  {calendarEvents.length > 5 && (
                    <p className="calendar-more">
                      And {calendarEvents.length - 5} more events. View all in Google Calendar.
                    </p>
                  )}
                </div>
              ) : (
                <div className="calendar-empty">
                  <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: '36px', color: '#cbd5f5', marginBottom: '8px' }} />
                  <p>No upcoming calendar events. Your schedules sync automatically.</p>
                </div>
              )}

              {syncedSchedules.length > 0 && (
                <div className="synced-schedules">
                  <h4>
                    <FontAwesomeIcon icon={faSync} style={{ color: '#4285f4', fontSize: '14px' }} />
                    Synced Schedules ({syncedSchedules.length})
                  </h4>
                  <div className="synced-schedule-list">
                    {syncedSchedules.map((schedule) => (
                      <div key={schedule._id} className="synced-schedule-card">
                        <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#10b981', fontSize: '14px' }} />
                        <div>
                          <p>{schedule.subject}</p>
                          <p>{schedule.day} • {schedule.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!calendarConfigured && !loadingCalendar && (
            <div className="instructor-card calendar-notice">
              <div className="section-title">
                <FontAwesomeIcon icon={faExclamationCircle} className="section-icon" />
                <div>
                  <p className="section-eyebrow">Google Calendar</p>
                  <h3 className="section-heading">Integration unavailable</h3>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: '13px', marginTop: '10px', lineHeight: '1.6' }}>
                Google Calendar integration is not yet configured for your account. Once enabled, your schedules will sync automatically to Google Calendar.
                Please contact your administrator for assistance.
              </p>
            </div>
          )}
      </main>
    </div>
  );
};

export default InstructorDashboard;
