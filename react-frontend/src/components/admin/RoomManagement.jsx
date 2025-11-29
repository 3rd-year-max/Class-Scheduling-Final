import React, { useState, useEffect } from 'react';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDesktop, 
  faPlus, 
  faTimes, 
  faDoorOpen,
  faEdit,
  faCheckCircle,
  faExclamationTriangle,
  faTools,
  faArchive
} from '@fortawesome/free-solid-svg-icons';
import apiClient from '../../services/apiClient.js';
import { useToast } from '../common/ToastProvider.jsx';
import ConfirmationDialog from '../common/ConfirmationDialog.jsx';
import { SkeletonCard } from '../common/SkeletonLoader.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { normalizeRoomName, formatRoomLabel } from '../../utils/roomUtils';

const RoomManagement = () => {
  const { showToast } = useToast();
  const [showAddRoomPopup, setShowAddRoomPopup] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'room', direction: 'asc' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, destructive: false });

  // Archived rooms state
  const [archivedRooms, setArchivedRooms] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [showArchivedModal, setShowArchivedModal] = useState(false);

  // Add Room form state
  const [newRoom, setNewRoom] = useState({ room: '', area: '', status: 'available' });
  const [addLoading, setAddLoading] = useState(false);

  // Edit room modal and states
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showEditRoomPopup, setShowEditRoomPopup] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Fetch rooms from backend
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const res = await apiClient.getRooms();
      // Backend now returns plain array directly
      if (Array.isArray(res.data)) {
        setRooms(res.data);
      } else if (Array.isArray(res.data?.rooms)) {
        setRooms(res.data.rooms);
      } else {
        setRooms([]);
        console.warn('Rooms data is not an array', res.data);
      }
      setRoomError(null);
    } catch (err) {
      setRoomError('Failed to load rooms');
      console.error(err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Initialize search from URL query (?q=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchQuery(q);
  }, []);

  useEffect(() => {
    fetchRooms();
  }, []);

  // Add Room handlers
  const addRoom = () => setShowAddRoomPopup(true);
  const updateNewRoomField = (field, value) => {
    setNewRoom((prev) => ({ ...prev, [field]: value }));
  };
  const handleAddRoomSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await apiClient.createRoom(newRoom);
      if (res.data.success) {
        showToast('Room added successfully!', 'success');
        setShowAddRoomPopup(false);
        setNewRoom({ room: '', area: '', status: 'available' });
        fetchRooms();
      } else {
        showToast(res.data.message || 'Failed to add room', 'error');
      }
    } catch (err) {
      console.error('Add room failed:', err);
      showToast('Server error while adding room.', 'error');
    }
    setAddLoading(false);
  };

  // Edit Room handlers
  const navigateToRoomDetails = (room) => {
    setSelectedRoom(room);
    setShowEditRoomPopup(true);
  };
  const updateSelectedRoomField = (field, value) => {
    setSelectedRoom((prev) => ({ ...prev, [field]: value }));
  };
  const handleEditRoomSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await apiClient.updateRoom(selectedRoom._id, selectedRoom, selectedRoom.__v);
      if (res.data.success) {
        showToast('Room updated successfully!', 'success');
        setShowEditRoomPopup(false);
        fetchRooms();
      } else {
        showToast(res.data.message || 'Failed to update room', 'error');
      }
    } catch (err) {
      console.error('Update room failed:', err);
      showToast('Server error while updating room.', 'error');
    }
    setEditLoading(false);
  };

  // Archive/Delete Room handlers
  const handleArchiveRoom = (room) => {
    setConfirmDialog({
      show: true,
      title: 'Archive Room',
      message: `Are you sure you want to archive room "${room.room}"? You can restore it later from the archived list.`,
      onConfirm: async () => {
        try {
          const res = await apiClient.patch(`/api/rooms/${room._id}/archive`);
          if (res.data.success) {
            showToast('Room archived successfully!', 'success');
            fetchRooms();
          } else {
            showToast(res.data.message || 'Failed to archive room', 'error');
          }
        } catch (err) {
          console.error('Archive room failed:', err);
          showToast('Server error while archiving room.', 'error');
        }
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false });
      },
      destructive: false,
    });
  };

  const handleRestoreRoom = async (room) => {
    try {
      const res = await apiClient.patch(`/api/rooms/${room._id}/restore`);
      if (res.data.success) {
        showToast('Room restored successfully!', 'success');
        fetchRooms();
        fetchArchivedRooms();
      } else {
        showToast(res.data.message || 'Failed to restore room', 'error');
      }
    } catch (err) {
      console.error('Restore room failed:', err);
      showToast('Server error while restoring room.', 'error');
    }
  };


  const fetchArchivedRooms = async () => {
    setLoadingArchived(true);
    try {
      const res = await apiClient.get('/api/rooms/archived/list');
      setArchivedRooms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching archived rooms', err);
      showToast('Error loading archived rooms.', 'error');
      setArchivedRooms([]);
    } finally {
      setLoadingArchived(false);
    }
  };

  const handleOpenArchivedModal = () => {
    setShowArchivedModal(true);
    if (archivedRooms.length === 0) {
      fetchArchivedRooms();
    }
  };

  const closeArchivedModal = () => {
    setShowArchivedModal(false);
  };

  // Get unique areas for filter
  const areas = [...new Set(rooms.map(room => room.area).filter(Boolean))].sort();

  // Filter and sort rooms
  let filteredRooms = rooms.filter(room => {
    const matchesSearch = (searchQuery ? normalizeRoomName(room.room).includes(normalizeRoomName(searchQuery)) : true) ||
                         room.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    const matchesArea = areaFilter === 'all' || room.area === areaFilter;
    return matchesSearch && matchesStatus && matchesArea;
  });

  // Sort rooms
  filteredRooms = [...filteredRooms].sort((a, b) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = (bValue || '').toLowerCase();
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const getStatusIcon = (status) => {
    switch(status) {
      case 'available': return faCheckCircle;
      case 'occupied': return faExclamationTriangle;
      case 'maintenance': return faTools;
      default: return faCheckCircle;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'available': return { bg: '#d1fae5', text: '#065f46', border: '#10b981' };
      case 'occupied': return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' };
      case 'maintenance': return { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' };
      default: return { bg: '#d1fae5', text: '#065f46', border: '#10b981' };
    }
  };

  return (
    <>
      <div className="dashboard-container" style={{ display: 'flex', height: '100vh' }}>
        <Sidebar />
        <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
          <Header title="Room Management" />

          {/* Popup removed - using Toast system now */}

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
                  <FontAwesomeIcon 
                    icon={faDoorOpen} 
                    style={{ fontSize: 28, color: '#fff' }}
                  />
                </div>
                <div>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: '24px', fontWeight: '700', textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)' }}>Room Management</h2>
                  <p style={{ margin: '6px 0 0 0', color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px', fontWeight: '500' }}>Manage classrooms and computer laboratories efficiently</p>
                </div>
              </div>
            </div>

            {/* Stats and Actions Card */}
            <div style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              padding: '20px 24px',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              borderLeft: '4px solid #f97316',
              marginBottom: '20px',
              border: '1px solid rgba(15, 44, 99, 0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Rooms Overview
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0', fontWeight: '500' }}>
                    Total: {rooms.length} room(s)
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)',
                    }}
                    onClick={addRoom}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 44, 99, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Add Room
                  </button>
                  <button
                    onClick={handleOpenArchivedModal}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <FontAwesomeIcon icon={faArchive} />
                    Archived
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minWidth: '160px',
                    background: '#fff',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    outline: 'none',
                    color: '#1e293b'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <option value="all">All Status</option>
                  <option value="available">Available</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  style={{
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minWidth: '160px',
                    background: '#fff',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    outline: 'none',
                    color: '#1e293b'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <option value="all">All Areas</option>
                  {areas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <select
                  value={`${sortConfig.key}-${sortConfig.direction}`}
                  onChange={(e) => {
                    const [key, direction] = e.target.value.split('-');
                    setSortConfig({ key, direction });
                  }}
                  style={{
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minWidth: '160px',
                    background: '#fff',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    outline: 'none',
                    color: '#1e293b'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <option value="room-asc">Sort: Room (A-Z)</option>
                  <option value="room-desc">Sort: Room (Z-A)</option>
                  <option value="area-asc">Sort: Area (A-Z)</option>
                  <option value="area-desc">Sort: Area (Z-A)</option>
                  <option value="status-asc">Sort: Status (A-Z)</option>
                  <option value="status-desc">Sort: Status (Z-A)</option>
                </select>
              </div>
            </div>

            {/* Rooms Grid */}
            {loadingRooms ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '24px',
              }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : roomError ? (
              <div style={{
                background: '#fff',
                padding: '60px 30px',
                borderRadius: '18px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                textAlign: 'center',
                borderLeft: '5px solid #ef4444',
              }}>
                <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: 48, color: '#ef4444', marginBottom: '16px' }} />
                <p style={{ color: '#991b1b', fontSize: '16px', margin: 0 }}>{roomError}</p>
              </div>
            ) : filteredRooms.length === 0 ? (
              <EmptyState
                icon={faDoorOpen}
                title={searchQuery || statusFilter !== 'all' ? 'No rooms found' : 'No rooms yet'}
                message={searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria to find rooms.'
                  : 'Get started by adding your first room to the system.'}
                actionLabel={searchQuery || statusFilter !== 'all' ? undefined : 'Add Your First Room'}
                onAction={searchQuery || statusFilter !== 'all' ? undefined : () => setShowAddRoomPopup(true)}
              />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '20px',
              }}>
                {filteredRooms.map((room) => {
                  const statusColors = getStatusColor(room.status);
                  return (
                    <div
                      key={room._id}
                      onClick={() => navigateToRoomDetails(room)}
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        borderRadius: '14px',
                        padding: '20px',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                        border: '1px solid rgba(15, 44, 99, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(37, 99, 235, 0.2)';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)';
                        e.currentTarget.style.borderColor = 'rgba(15, 44, 99, 0.1)';
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '4px',
                        height: '100%',
                        background: `linear-gradient(180deg, ${statusColors.border} 0%, ${statusColors.border}dd 100%)`,
                      }} />
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        marginBottom: '14px'
                      }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '20px',
                          boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)'
                        }}>
                          <FontAwesomeIcon icon={faDesktop} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#1e293b',
                            margin: '0 0 4px 0',
                          }}>
                            {formatRoomLabel(room.room)}
                          </h4>
                          <p style={{
                            fontSize: '13px',
                            color: '#64748b',
                            margin: 0,
                            fontWeight: '500'
                          }}>
                            {room.area}
                          </p>
                        </div>
                      </div>

                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: statusColors.bg,
                        color: statusColors.text,
                        border: `2px solid ${statusColors.border}`,
                        fontWeight: '700',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        boxShadow: `0 2px 8px ${statusColors.border}33`
                      }}>
                        <FontAwesomeIcon icon={getStatusIcon(room.status)} style={{ fontSize: '12px' }} />
                        {room.status}
                      </div>

                      <div style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        display: 'flex',
                        gap: '6px',
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToRoomDetails(room);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.15)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.25) 100%)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(59, 130, 246, 0.15)';
                          }}
                          title="Edit Room"
                        >
                          <FontAwesomeIcon icon={faEdit} style={{ fontSize: '13px' }} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveRoom(room);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.15) 100%)',
                            border: '1px solid rgba(251, 146, 60, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f97316',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 2px 6px rgba(251, 146, 60, 0.15)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251, 146, 60, 0.2) 0%, rgba(249, 115, 22, 0.25) 100%)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 146, 60, 0.25)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.15) 100%)';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(251, 146, 60, 0.15)';
                          }}
                          title="Archive Room"
                        >
                          <FontAwesomeIcon icon={faArchive} style={{ fontSize: '13px' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Room Popup Modal */}
      {showAddRoomPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowAddRoomPopup(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              padding: '24px',
              borderRadius: '16px',
              width: '460px',
              maxWidth: '90vw',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(15, 44, 99, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#0f2c63', 
                margin: 0,
                background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Add New Room</h3>
              <button
                onClick={() => setShowAddRoomPopup(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleAddRoomSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoom.room}
                  onChange={(e) => updateNewRoomField('room', e.target.value)}
                  required
                  placeholder="e.g., ComLab 1"
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Area/Location
                </label>
                <input
                  type="text"
                  value={newRoom.area}
                  onChange={(e) => updateNewRoomField('area', e.target.value)}
                  required
                  placeholder="e.g., 3rd Floor, Main Building"
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Status
                </label>
                <select
                  value={newRoom.status}
                  onChange={(e) => updateNewRoomField('status', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                  required
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddRoomPopup(false)}
                  style={{ 
                    padding: '10px 20px',
                    border: '2px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  style={{ 
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: addLoading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)',
                    opacity: addLoading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!addLoading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 44, 99, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                  }}
                >
                  {addLoading ? 'Adding...' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Popup Modal */}
      {showEditRoomPopup && selectedRoom && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowEditRoomPopup(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              padding: '24px',
              borderRadius: '16px',
              width: '460px',
              maxWidth: '90vw',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(15, 44, 99, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#0f2c63', 
                margin: 0,
                background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Edit Room Details</h3>
              <button
                onClick={() => setShowEditRoomPopup(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleEditRoomSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Room Name
                </label>
                <input
                  type="text"
                  value={selectedRoom.room}
                  onChange={(e) => updateSelectedRoomField('room', e.target.value)}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Area/Location
                </label>
                <input
                  type="text"
                  value={selectedRoom.area}
                  onChange={(e) => updateSelectedRoomField('area', e.target.value)}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Status
                </label>
                <select
                  value={selectedRoom.status}
                  onChange={(e) => updateSelectedRoomField('status', e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#2563eb';
                    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1), 0 2px 8px rgba(0, 0, 0, 0.1)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                  required
                >
                  <option value="available">Available</option>
                  <option value="maintenance">Under Maintenance</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditRoomPopup(false)}
                  style={{ 
                    padding: '10px 20px',
                    border: '2px solid #e5e7eb',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#374151',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{ 
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: editLoading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)',
                    opacity: editLoading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!editLoading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 44, 99, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                  }}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archived Rooms Modal */}
      {showArchivedModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(2,6,23,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', borderBottom: '1px solid #eef2ff' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Archived Rooms</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{archivedRooms.length} archived room(s)</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={closeArchivedModal} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Close</button>
              </div>
            </div>

            <div style={{ padding: 18 }}>
              {loadingArchived ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading archived rooms...</div>
              ) : archivedRooms.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No archived rooms.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {archivedRooms.map((r) => (
                    <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid #e6eefb' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{formatRoomLabel(r.room)}</div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>Area: {r.area} • Status: {r.status}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleRestoreRoom(r)} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Restore</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        show={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false })}
        destructive={confirmDialog.destructive}
        confirmText={confirmDialog.destructive ? "Delete" : "Confirm"}
      />
    </>
  );
};

export default RoomManagement;
