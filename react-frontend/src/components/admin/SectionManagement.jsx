import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faGraduationCap, 
  faCode, 
  faPlus,
  faArchive,
  faTimes,
  faUsers,
  faExclamationCircle,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';
import apiClient from '../../services/apiClient.js';
import { useToast } from '../common/ToastProvider.jsx';
import ConfirmationDialog from '../common/ConfirmationDialog.jsx';

const SectionManagement = () => {
  const { showToast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddSectionPopup, setShowAddSectionPopup] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    destructive: false 
  });
  const [archivedSections, setArchivedSections] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  const courses = [
    {
      id: 'bsit',
      name: 'Bachelor of Science in Information Technology',
      shortName: 'BSIT',
      icon: faGraduationCap,
      gradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
      bgGradient: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%)',
      color: '#0f2c63',
    },
    {
      id: 'bsemc-dat',
      name: 'Bachelor of Science in Entertainment and Multimedia Computing',
      shortName: 'BSEMC-DAT',
      icon: faCode,
      gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      bgGradient: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #fb923c 100%)',
      color: '#f97316',
    }
  ];

  const yearLevels = useMemo(() => [
    { id: '1styear', label: '1st Year', year: 1 },
    { id: '2ndyear', label: '2nd Year', year: 2 },
    { id: '3rdyear', label: '3rd Year', year: 3 },
    { id: '4thyear', label: '4th Year', year: 4 }
  ], []);


  const fetchSections = useCallback(async () => {
    if (!selectedCourse || !selectedYear) {
      setSections([]);
      setError(null);
      setLoadingArchived(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const yearLevel = yearLevels.find(y => y.id === selectedYear);
      const yearValue = yearLevel ? String(yearLevel.year) : selectedYear;
      const response = await apiClient.get(`/api/sections?course=${selectedCourse}&year=${yearValue}`);
      if (Array.isArray(response.data)) {
        const sortedSections = response.data.sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setSections(sortedSections);
      } else if (response.data.success === false) {
        setError(response.data.message || 'Error fetching sections');
        setSections([]);
      }
      setLoadingArchived(true);
      const archivedRes = await apiClient.get(`/api/sections/archived/list?course=${selectedCourse}&year=${yearValue}`);
      setArchivedSections(Array.isArray(archivedRes.data) ? archivedRes.data : []);
      setLoadingArchived(false);
    } catch (err) {
      setError('Error fetching sections');
      setSections([]);
      setArchivedSections([]);
      setLoadingArchived(false);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, selectedYear, yearLevels]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) {
      showToast('Please enter a section name', 'error');
      return;
    }
    if (!selectedCourse || !selectedYear) {
      showToast('Please select a course and year level', 'error');
      return;
    }
    setAddingSection(true);
    try {
      const yearLevel = yearLevels.find(y => y.id === selectedYear);
      const yearValue = yearLevel ? String(yearLevel.year) : selectedYear;
      const response = await apiClient.post('/api/sections/create', {
        course: selectedCourse,
        year: yearValue,
        name: newSectionName.trim(),
      });
      if (response.data.success) {
        showToast('Section added successfully!', 'success');
        setNewSectionName('');
        setShowAddSectionPopup(false);
        await fetchSections();
      } else {
        showToast(response.data.message || 'Failed to add section', 'error');
      }
    } catch (err) {
      console.error('Error adding section:', err);
      showToast(err.response?.data?.message || 'Error adding section', 'error');
    } finally {
      setAddingSection(false);
    }
  };

  const handleRestoreSection = async (section) => {
      try {
        await apiClient.patch(`/api/sections/${section._id}/restore`);
      showToast('Section restored successfully', 'success');
      fetchSections();
      setArchivedSections(archivedSections.filter(s => s._id !== section._id));
    } catch {
      showToast('Failed to restore section', 'error');
    }
  };

  const handleOpenArchivedModal = () => {
    setShowArchivedModal(true);
    if (archivedSections.length === 0) {
      fetchArchivedSections();
    }
  };

  const closeArchivedModal = () => {
    setShowArchivedModal(false);
  };

  const fetchArchivedSections = async () => {
    setLoadingArchived(true);
    try {
      const yearLevel = yearLevels.find(y => y.id === selectedYear);
      const yearValue = yearLevel ? String(yearLevel.year) : selectedYear;
      const res = await apiClient.get(`/api/sections/archived/list?course=${selectedCourse}&year=${yearValue}`);
      setArchivedSections(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching archived sections', err);
      showToast('Error loading archived sections.', 'error');
      setArchivedSections([]);
    } finally {
      setLoadingArchived(false);
    }
  };

  const handleArchiveSection = (section) => {
    setConfirmDialog({
      show: true,
      title: 'Archive Section',
      message: `Are you sure you want to archive section "${section.name}"? You can restore it later from the archived list.`,
      onConfirm: async () => {
        try {
          await apiClient.patch(`/api/sections/${section._id}/archive`);
          showToast('Section archived successfully', 'success');
          fetchSections();
          setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false });
        } catch {
          showToast('Failed to archive section', 'error');
          setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false });
        }
      },
      destructive: false
    });
  };

  const currentCourse = courses.find(c => c.id === selectedCourse);

  return (
    <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh', background: '#fafafa' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <Header title="Section Management" />
        <div className="dashboard-content" style={{ marginTop: '140px', padding: '0 20px 40px', background: '#fafafa' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
            Section Management
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
            Select a course and year level to create, manage, and organize student sections
          </p>
          {/* Enhanced Course Selection */}
          <div style={{
            background: '#ffffff',
            padding: '24px',
            borderRadius: '20px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            marginBottom: '24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            }} />
            <h3 style={{
              fontSize: '20px',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '20px',
              letterSpacing: '-0.3px',
            }}>
              Select Course
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => {
                    setSelectedCourse(course.id);
                    setSelectedYear(null);
                    setSections([]);
                  }}
                  style={{
                    padding: '22px',
                    background: selectedCourse === course.id ? course.color : '#ffffff',
                    color: selectedCourse === course.id ? 'white' : '#374151',
                    border: selectedCourse === course.id ? 'none' : '2px solid #e5e7eb',
                    borderRadius: '18px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '15px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '14px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                    boxShadow: selectedCourse === course.id 
                      ? `0 4px 12px ${course.color}30` 
                      : '0 2px 8px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseOver={(e) => {
                    if (selectedCourse !== course.id) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.borderColor = course.color;
                    }
                  }}
                  onMouseOut={(e) => {
                    if (selectedCourse !== course.id) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: selectedCourse === course.id 
                      ? 'rgba(255, 255, 255, 0.2)' 
                      : course.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: selectedCourse === course.id ? 'white' : 'white',
                    boxShadow: selectedCourse === course.id 
                      ? '0 4px 12px rgba(0, 0, 0, 0.1)' 
                      : `0 4px 12px ${course.color}20`,
                  }}>
                    <FontAwesomeIcon icon={course.icon} />
                  </div>
                  <div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '800',
                      marginBottom: '4px',
                      letterSpacing: '-0.3px',
                    }}>
                      {course.shortName}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      opacity: selectedCourse === course.id ? 0.9 : 0.7,
                      fontWeight: '400',
                      lineHeight: '1.4',
                    }}>
                      {course.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Enhanced Year Level Selection */}
          {selectedCourse && (
            <div style={{
              background: '#ffffff',
              padding: '24px',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              marginBottom: '24px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: currentCourse?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              }} />
              <h3 style={{
                fontSize: '20px',
                fontWeight: '800',
                color: '#1e293b',
                marginBottom: '20px',
                letterSpacing: '-0.3px',
              }}>
                Select Year Level
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '16px'
              }}>
                {yearLevels.map((year) => (
                  <button
                    key={year.id}
                    onClick={() => setSelectedYear(year.id)}
                    style={{
                      padding: '20px',
                      background: selectedYear === year.id ? currentCourse.color : '#ffffff',
                      color: selectedYear === year.id ? 'white' : '#374151',
                      border: selectedYear === year.id ? 'none' : '2px solid #e5e7eb',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'center',
                      boxShadow: selectedYear === year.id
                        ? `0 4px 12px ${currentCourse?.color || '#f97316'}30`
                        : '0 2px 8px rgba(0, 0, 0, 0.05)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseOver={(e) => {
                      if (selectedYear !== year.id) {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.borderColor = currentCourse?.color || '#f97316';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (selectedYear !== year.id) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }
                    }}
                  >
                    <div style={{
                      fontSize: '28px',
                      fontWeight: '800',
                      marginBottom: '6px',
                    }}>
                      {year.year}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      opacity: selectedYear === year.id ? 0.95 : 0.7,
                    }}>
                      {year.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enhanced Sections List */}
          {selectedCourse && selectedYear && (
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
                right: 0,
                height: '4px',
                background: currentCourse?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              }} />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingTop: '8px',
              }}>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: '0 0 4px 0',
                    letterSpacing: '-0.3px',
                  }}>
                    Sections for {courses.find(c => c.id === selectedCourse)?.shortName} - {yearLevels.find(y => y.id === selectedYear)?.label}
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    margin: 0,
                    fontWeight: '500',
                  }}>
                    {sections.length} active section(s)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowAddSectionPopup(true)}
                    style={{
                      padding: '12px 24px',
                      background: currentCourse.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                      boxShadow: `0 4px 12px ${currentCourse?.color || '#f97316'}20`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.background = currentCourse.color === '#0f2c63' ? '#1e3a72' : '#ea580c';
                      e.currentTarget.style.boxShadow = `0 6px 16px ${currentCourse?.color || '#f97316'}30`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.background = currentCourse.color;
                      e.currentTarget.style.boxShadow = `0 4px 12px ${currentCourse?.color || '#f97316'}20`;
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Add Section
                  </button>
                  <button
                    onClick={handleOpenArchivedModal}
                    style={{
                      padding: '12px 24px',
                      background: '#ffffff',
                      color: '#374151',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <FontAwesomeIcon icon={faArchive} />
                    Archived
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 32px',
                  color: '#64748b',
                }}>
                  <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }} />
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Loading sections...</p>
                </div>
              ) : error ? (
                <div style={{
                  padding: '20px',
                  background: '#fef2f2',
                  border: '2px solid #fecaca',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  color: '#dc2626',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                  }}>
                    <FontAwesomeIcon icon={faExclamationCircle} />
                  </div>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{error}</span>
                </div>
              ) : sections.length === 0 ? (
                <div style={{
                  padding: '40px 32px',
                  textAlign: 'center',
                  color: '#64748b',
                  background: '#f8fafc',
                  borderRadius: '14px',
                  border: '2px dashed #e2e8f0',
                }}>
                  <FontAwesomeIcon
                    icon={faUsers}
                    style={{ fontSize: 48, marginBottom: '16px', opacity: 0.3 }}
                  />
                  <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700' }}>
                    No sections found
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>
                    Click "Add Section" to create one
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '16px'
                }}>
                  {sections.map((section) => (
                    <div
                      key={section._id}
                      style={{
                        padding: '18px',
                        background: '#ffffff',
                        border: '2px solid #e5e7eb',
                        borderRadius: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = currentCourse?.color || '#3b82f6';
                        e.currentTarget.style.boxShadow = `0 8px 24px ${currentCourse?.color || '#3b82f6'}20`;
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Decorative gradient bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: currentCourse?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      }} />
                      <div style={{
                        fontSize: '17px',
                        fontWeight: '700',
                        color: '#1e293b',
                        letterSpacing: '-0.3px',
                      }}>
                        {courses.find(c => c.id === selectedCourse)?.shortName}-{yearLevels.find(y => y.id === selectedYear)?.year}{section.name}
                      </div>
                      <button
                        onClick={() => handleArchiveSection(section)}
                        style={{
                          padding: '8px 12px',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '2px solid #fde68a',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 8px rgba(180, 83, 9, 0.1)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fde68a';
                          e.currentTarget.style.borderColor = '#fcd34d';
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 83, 9, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fef3c7';
                          e.currentTarget.style.borderColor = '#fde68a';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(180, 83, 9, 0.1)';
                        }}
                      >
                        <FontAwesomeIcon icon={faArchive} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enhanced Instructions when no course/year selected */}
          {(!selectedCourse || !selectedYear) && (
            <div style={{
              background: '#ffffff',
              padding: '40px 32px',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
              border: '2px dashed #e2e8f0',
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#fef3c7',
                border: '2px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                color: '#b45309',
                margin: '0 auto 20px',
                boxShadow: '0 4px 12px rgba(180, 83, 9, 0.1)',
              }}>
                <FontAwesomeIcon icon={faUsers} />
              </div>
              <h3 style={{
                color: '#1e293b',
                fontSize: '20px',
                fontWeight: '800',
                marginBottom: '10px',
                letterSpacing: '-0.3px',
              }}>
                Get Started
              </h3>
              <p style={{
                color: '#64748b',
                fontSize: '14px',
                margin: 0,
                lineHeight: '1.6',
              }}>
                Please select a course and year level above to view and manage sections
              </p>
            </div>
          )}

          {/* Enhanced Archived Sections Modal */}
          {showArchivedModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}>
              <div style={{
                background: '#fff',
                borderRadius: '20px',
                width: '90%',
                maxWidth: 800,
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(2,6,23,0.3)',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: currentCourse?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  borderRadius: '20px 20px 0 0',
                }} />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px',
                  borderBottom: '2px solid #f1f5f9',
                }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>Archived Sections</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{archivedSections.length} archived section(s)</div>
                  </div>
                  <button
                    onClick={closeArchivedModal}
                    style={{
                      padding: '10px 16px',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e5e7eb';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                    }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ padding: '20px' }}>
                  {loadingArchived ? (
                    <div style={{
                      padding: 32,
                      textAlign: 'center',
                      color: '#64748b',
                    }}>
                      <FontAwesomeIcon icon={faLayerGroup} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Loading archived sections...</p>
                    </div>
                  ) : archivedSections.length === 0 ? (
                    <div style={{
                      padding: 40,
                      textAlign: 'center',
                      color: '#64748b',
                      background: '#f8fafc',
                      borderRadius: '14px',
                      border: '2px dashed #e2e8f0',
                    }}>
                      <FontAwesomeIcon icon={faArchive} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>No archived sections</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '14px' }}>
                      {archivedSections.map((s) => (
                        <div
                          key={s._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '18px',
                            borderRadius: '14px',
                            border: '2px solid #e5e7eb',
                            background: '#ffffff',
                            transition: 'all 0.3s ease',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '16px', color: '#1e293b', marginBottom: '4px' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              {courses.find(c => c.id === selectedCourse)?.shortName} - {yearLevels.find(y => y.id === selectedYear)?.label}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleRestoreSection(s)}
                              style={{
                                padding: '8px 16px',
                                background: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '12px',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(5, 150, 105, 0.2)';
                              }}
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Add Section Popup */}
          {showAddSectionPopup && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => {
                if (!addingSection) {
                  setShowAddSectionPopup(false);
                  setNewSectionName('');
                }
              }}
            >
              <div
                style={{
                  background: 'white',
                  padding: '32px',
                  borderRadius: '20px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                  maxWidth: '480px',
                  width: '90%',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: currentCourse?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                }} />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '24px',
                  paddingTop: '8px',
                }}>
                  <div>
                    <h3 style={{
                      fontSize: '22px',
                      fontWeight: '800',
                      color: '#1e293b',
                      margin: '0 0 4px 0',
                      letterSpacing: '-0.3px',
                    }}>
                      Add New Section
                    </h3>
                    <p style={{
                      fontSize: '13px',
                      color: '#64748b',
                      margin: 0,
                    }}>
                      Create a new section for {courses.find(c => c.id === selectedCourse)?.shortName} - {yearLevels.find(y => y.id === selectedYear)?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!addingSection) {
                        setShowAddSectionPopup(false);
                        setNewSectionName('');
                      }
                    }}
                    style={{
                      background: '#f3f4f6',
                      border: 'none',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}
                    disabled={addingSection}
                    onMouseEnter={(e) => {
                      if (!addingSection) {
                        e.currentTarget.style.background = '#e5e7eb';
                        e.currentTarget.style.color = '#374151';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <form onSubmit={handleAddSection}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: '700',
                      color: '#1e293b',
                      fontSize: '14px',
                    }}>
                      Section Name
                    </label>
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="e.g., A, B, C, 1, 2, 3"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = currentCourse?.color || '#f97316';
                        e.target.style.boxShadow = `0 0 0 3px ${currentCourse?.color || '#f97316'}20`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e5e7eb';
                        e.target.style.boxShadow = 'none';
                      }}
                      disabled={addingSection}
                      autoFocus
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'flex-end'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!addingSection) {
                          setShowAddSectionPopup(false);
                          setNewSectionName('');
                        }
                      }}
                      disabled={addingSection}
                      style={{
                        padding: '12px 24px',
                        background: '#ffffff',
                        color: '#374151',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        cursor: addingSection ? 'not-allowed' : 'pointer',
                        fontWeight: '600',
                        fontSize: '14px',
                        transition: 'all 0.3s ease',
                        opacity: addingSection ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!addingSection) {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingSection || !newSectionName.trim()}
                      style={{
                        padding: '12px 24px',
                        background: addingSection || !newSectionName.trim()
                          ? '#d1d5db'
                          : currentCourse.color,
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: addingSection || !newSectionName.trim() ? 'not-allowed' : 'pointer',
                        fontWeight: '700',
                        fontSize: '14px',
                        transition: 'all 0.3s ease',
                        boxShadow: addingSection || !newSectionName.trim()
                          ? 'none'
                          : `0 4px 12px ${currentCourse?.color || '#f97316'}30`,
                      }}
                      onMouseEnter={(e) => {
                        if (!addingSection && newSectionName.trim()) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.background = currentCourse.color === '#0f2c63' ? '#1e3a72' : '#ea580c';
                          e.currentTarget.style.boxShadow = `0 6px 16px ${currentCourse?.color || '#f97316'}30`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = currentCourse.color;
                        e.currentTarget.style.boxShadow = addingSection || !newSectionName.trim()
                          ? 'none'
                          : `0 4px 12px ${currentCourse?.color || '#f97316'}20`;
                      }}
                    >
                      {addingSection ? 'Adding...' : 'Add Section'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Confirmation Dialog */}
          <ConfirmationDialog
            show={confirmDialog.show}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false })}
            destructive={confirmDialog.destructive}
          />
        </div>
      </main>
    </div>
  );
};

export default SectionManagement;
