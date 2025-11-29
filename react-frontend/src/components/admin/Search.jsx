import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDoorOpen, faUser, faCalendarAlt, faDownload, faArrowRight, faEnvelope, faPhone, faIdCard, faMapMarkerAlt, faClock, faChalkboardTeacher, faSearch } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import XLSX from 'xlsx-js-style';

const Search = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ rooms: [], instructors: [], schedules: [] });
  const [pagination, setPagination] = useState({
    rooms: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    instructors: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
    schedules: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
  });
  const previousQueryRef = useRef('');

  // Reset and perform new search when URL query parameter changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const newQuery = params.get('q') || '';
    
    // Only reset and search if the query has actually changed
    if (newQuery !== previousQueryRef.current) {
      previousQueryRef.current = newQuery;
      setQ(newQuery);
      
      // Reset all results and pagination immediately
      setResults({ rooms: [], instructors: [], schedules: [] });
      setPagination({
        rooms: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        instructors: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        schedules: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
      });
      
      // Perform new search if query is not empty
      if (newQuery.trim()) {
        doSearch(newQuery);
      } else {
        // Clear loading state if query is empty
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const doSearch = async (term, pageOverrides = {}) => {
    if (!term || !term.trim()) {
      setResults({ rooms: [], instructors: [], schedules: [] });
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        q: term.trim(),
        roomsPage: pageOverrides.roomsPage || 1,
        instructorsPage: pageOverrides.instructorsPage || 1,
        schedulesPage: pageOverrides.schedulesPage || 1,
        limit: 10
      };
      
      const res = await axios.get(`${apiBase}/api/admin/search`, { params });
      setResults({
        rooms: Array.isArray(res.data?.rooms) ? res.data.rooms : [],
        instructors: Array.isArray(res.data?.instructors) ? res.data.instructors : [],
        schedules: Array.isArray(res.data?.schedules) ? res.data.schedules : [],
      });
      
      if (res.data?.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (_) {
      setResults({ rooms: [], instructors: [], schedules: [] });
      setPagination({
        rooms: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        instructors: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false },
        schedules: { page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false }
      });
    }
    setLoading(false);
  };

  const counts = useMemo(() => ({
    rooms: results.rooms.length,
    instructors: results.instructors.length,
    schedules: results.schedules.length,
  }), [results]);

  const exportSearchResults = () => {
    const wb = XLSX.utils.book_new();
    
    // Export Rooms
    if (results.rooms.length > 0) {
      const roomsData = [
        ['Room', 'Area', 'Status'],
        ...results.rooms.map(r => [r.room || '', r.area || '', r.status || ''])
      ];
      const wsRooms = XLSX.utils.aoa_to_sheet(roomsData);
      wsRooms['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }];
      const headerRange = XLSX.utils.decode_range(wsRooms['!ref']);
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsRooms[cellAddress]) continue;
        wsRooms[cellAddress].s = {
          fill: { fgColor: { rgb: "0f2c63" } },
          font: { bold: true, color: { rgb: "FFFFFF" } }
        };
      }
      XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms');
    }

    // Export Instructors
    if (results.instructors.length > 0) {
      const instructorsData = [
        ['Name', 'Email', 'Department', 'Contact'],
        ...results.instructors.map(i => [
          (i.firstname && i.lastname ? `${i.firstname} ${i.lastname}` : (i.name || i.email || '')),
          i.email || '',
          i.department || '',
          i.contact || ''
        ])
      ];
      const wsInstructors = XLSX.utils.aoa_to_sheet(instructorsData);
      wsInstructors['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];
      const headerRange = XLSX.utils.decode_range(wsInstructors['!ref']);
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsInstructors[cellAddress]) continue;
        wsInstructors[cellAddress].s = {
          fill: { fgColor: { rgb: "0f2c63" } },
          font: { bold: true, color: { rgb: "FFFFFF" } }
        };
      }
      XLSX.utils.book_append_sheet(wb, wsInstructors, 'Instructors');
    }

    // Export Schedules
    if (results.schedules.length > 0) {
      const schedulesData = [
        ['Subject', 'Course', 'Year', 'Section', 'Day', 'Time', 'Room', 'Instructor'],
        ...results.schedules.map(s => [
          s.subject || '',
          s.course || '',
          s.year || '',
          s.section || '',
          s.day || '',
          s.time || '',
          s.room || '',
          s.instructor || ''
        ])
      ];
      const wsSchedules = XLSX.utils.aoa_to_sheet(schedulesData);
      wsSchedules['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
      const headerRange = XLSX.utils.decode_range(wsSchedules['!ref']);
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!wsSchedules[cellAddress]) continue;
        wsSchedules[cellAddress].s = {
          fill: { fgColor: { rgb: "0f2c63" } },
          font: { bold: true, color: { rgb: "FFFFFF" } }
        };
      }
      XLSX.utils.book_append_sheet(wb, wsSchedules, 'Schedules');
    }

    const filename = `search-results-${q.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem' }}>
        <Header title="Search" />
        <div className="dashboard-content" style={{ marginTop: '140px' }}>
          {/* Welcome Section */}
          <div className="welcome-section" style={{ 
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
            padding: '20px 24px',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(15, 44, 99, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            position: 'relative',
            overflow: 'hidden'
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
                <FontAwesomeIcon icon={faSearch} style={{ fontSize: 28, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '24px', fontWeight: '700', textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)' }}>Search Results</h2>
                <p style={{ margin: '6px 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', fontWeight: '500' }}>Search query: <strong>"{q}"</strong></p>
              </div>
            </div>
          </div>
          
          {loading && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', color: '#0f2c63', fontWeight: '500' }}>
              Loading search results...
            </div>
          )}
          {!loading && (counts.rooms > 0 || counts.instructors > 0 || counts.schedules > 0) && (
              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={exportSearchResults}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 44, 99, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                  }}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Export Excel
                </button>
              </div>
            )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: '5px solid #f97316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faDoorOpen}/> Rooms ({pagination.rooms.total || counts.rooms})
                </h3>
              </div>
              {counts.rooms === 0 ? <div style={{ color: '#6b7280' }}>No matching rooms</div> : (
                <>
                  <div style={{ display: 'grid', gap: 8, marginBottom: pagination.rooms.totalPages > 1 ? 15 : 0 }}>
                    {results.rooms.map((r)=> (
                      <div 
                        key={r._id} 
                        onClick={() => navigate(`/admin/room-management?q=${encodeURIComponent(q)}`)}
                        style={{ 
                          padding: 12, 
                          border: '1px solid #e5e7eb', 
                          borderRadius: 8, 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: '#fff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#0f2c63';
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 44, 99, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '16px' }}>{r.room}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                              <FontAwesomeIcon icon={faMapMarkerAlt} style={{ fontSize: '12px' }} />
                              <span>{r.area}</span>
                            </div>
                            <div style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              backgroundColor: r.status === 'available' ? '#dcfce7' : r.status === 'occupied' ? '#fee2e2' : '#fef3c7',
                              color: r.status === 'available' ? '#16a34a' : r.status === 'occupied' ? '#dc2626' : '#d97706',
                            }}>
                              {r.status}
                            </div>
                          </div>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} style={{ color: '#9ca3af', fontSize: '14px', marginLeft: '12px' }} />
                      </div>
                    ))}
                  </div>
                  {pagination.rooms.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                      <button
                        onClick={() => doSearch(q, { roomsPage: pagination.rooms.page - 1 })}
                        disabled={!pagination.rooms.hasPrev}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.rooms.hasPrev ? '#0f2c63' : '#e5e7eb',
                          color: pagination.rooms.hasPrev ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.rooms.hasPrev ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {pagination.rooms.page}/{pagination.rooms.totalPages}
                      </span>
                      <button
                        onClick={() => doSearch(q, { roomsPage: pagination.rooms.page + 1 })}
                        disabled={!pagination.rooms.hasNext}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.rooms.hasNext ? '#f97316' : '#e5e7eb',
                          color: pagination.rooms.hasNext ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.rooms.hasNext ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: '5px solid #f97316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faUser}/> Instructors ({pagination.instructors.total || counts.instructors})
                </h3>
              </div>
              {counts.instructors === 0 ? <div style={{ color: '#6b7280' }}>No matching instructors</div> : (
                <>
                  <div style={{ display: 'grid', gap: 8, marginBottom: pagination.instructors.totalPages > 1 ? 15 : 0 }}>
                    {results.instructors.map((i)=> (
                      <div 
                        key={i._id} 
                        onClick={() => navigate(`/admin/faculty-management?q=${encodeURIComponent(q)}`)}
                        style={{ 
                          padding: 12, 
                          border: '1px solid #e5e7eb', 
                          borderRadius: 8, 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: '#fff'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#0f2c63';
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 44, 99, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '16px' }}>
                            {i.firstname && i.lastname ? `${i.firstname} ${i.lastname}` : (i.name || i.email)}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                            {i.instructorId && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faIdCard} style={{ fontSize: '12px' }} />
                                <span>ID-{i.instructorId}</span>
                              </div>
                            )}
                            {i.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faEnvelope} style={{ fontSize: '12px' }} />
                                <span>{i.email}</span>
                              </div>
                            )}
                            {i.department && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faUser} style={{ fontSize: '12px' }} />
                                <span>{i.department}</span>
                              </div>
                            )}
                            {i.contact && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faPhone} style={{ fontSize: '12px' }} />
                                <span>{i.contact}</span>
                              </div>
                            )}
                            {i.status && (
                              <div style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                backgroundColor: i.status === 'active' ? '#dcfce7' : i.status === 'pending' ? '#fef3c7' : '#fee2e2',
                                color: i.status === 'active' ? '#16a34a' : i.status === 'pending' ? '#d97706' : '#dc2626',
                              }}>
                                {i.status}
                              </div>
                            )}
                          </div>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} style={{ color: '#9ca3af', fontSize: '14px', marginLeft: '12px' }} />
                      </div>
                    ))}
                  </div>
                  {pagination.instructors.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                      <button
                        onClick={() => doSearch(q, { instructorsPage: pagination.instructors.page - 1 })}
                        disabled={!pagination.instructors.hasPrev}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.instructors.hasPrev ? '#0f2c63' : '#e5e7eb',
                          color: pagination.instructors.hasPrev ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.instructors.hasPrev ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {pagination.instructors.page}/{pagination.instructors.totalPages}
                      </span>
                      <button
                        onClick={() => doSearch(q, { instructorsPage: pagination.instructors.page + 1 })}
                        disabled={!pagination.instructors.hasNext}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.instructors.hasNext ? '#f97316' : '#e5e7eb',
                          color: pagination.instructors.hasNext ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.instructors.hasNext ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: 16, borderLeft: '5px solid #f97316' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FontAwesomeIcon icon={faCalendarAlt}/> Schedules ({pagination.schedules.total || counts.schedules})
                </h3>
              </div>
              {counts.schedules === 0 ? <div style={{ color: '#6b7280' }}>No matching schedules</div> : (
                <>
                  <div style={{ display: 'grid', gap: 8, marginBottom: pagination.schedules.totalPages > 1 ? 15 : 0 }}>
                    {results.schedules.map((s, idx)=> (
                      <div 
                        key={s._id || idx} 
                        onClick={() => {
                          // Navigate to schedule management, or specific schedule page if course/year available
                          if (s.course && s.year) {
                            const courseId = s.course.toLowerCase().replace(/\s+/g, '-');
                            const yearId = s.year.toLowerCase().replace(/\s+/g, '');
                            navigate(`/admin/schedule-management/${courseId}/${yearId}?q=${encodeURIComponent(q)}`);
                          } else {
                            navigate(`/admin/schedule-management?q=${encodeURIComponent(q)}`);
                          }
                        }}
                        style={{ 
                          padding: 12, 
                          border: '1px solid #e5e7eb', 
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          background: '#fff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#0f2c63';
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 44, 99, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '16px' }}>{s.subject}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                              <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: '12px' }} />
                              <span>{s.course} {s.year} - {s.section}</span>
                            </div>
                            {s.day && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: '12px' }} />
                                <span>{s.day}</span>
                              </div>
                            )}
                            {s.time && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faClock} style={{ fontSize: '12px' }} />
                                <span>{s.time}</span>
                              </div>
                            )}
                            {s.room && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faDoorOpen} style={{ fontSize: '12px' }} />
                                <span>{s.room}</span>
                              </div>
                            )}
                            {s.instructor && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                                <FontAwesomeIcon icon={faChalkboardTeacher} style={{ fontSize: '12px' }} />
                                <span>{s.instructor}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <FontAwesomeIcon icon={faArrowRight} style={{ color: '#9ca3af', fontSize: '14px', marginLeft: '12px' }} />
                      </div>
                    ))}
                  </div>
                  {pagination.schedules.totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                      <button
                        onClick={() => doSearch(q, { schedulesPage: pagination.schedules.page - 1 })}
                        disabled={!pagination.schedules.hasPrev}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.schedules.hasPrev ? '#0f2c63' : '#e5e7eb',
                          color: pagination.schedules.hasPrev ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.schedules.hasPrev ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {pagination.schedules.page}/{pagination.schedules.totalPages}
                      </span>
                      <button
                        onClick={() => doSearch(q, { schedulesPage: pagination.schedules.page + 1 })}
                        disabled={!pagination.schedules.hasNext}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: pagination.schedules.hasNext ? '#f97316' : '#e5e7eb',
                          color: pagination.schedules.hasNext ? 'white' : '#9ca3af',
                          fontSize: '12px',
                          cursor: pagination.schedules.hasNext ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Search;


