import React, { useState, useEffect } from 'react';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import apiClient from '../../services/apiClient.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClipboardList,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faSearch,
  faFilter,
  faCalendarAlt,
  faDownload,
} from '@fortawesome/free-solid-svg-icons';
import TableSortHeader from '../common/TableSortHeader.jsx';
import jsPDF from 'jspdf';
import XLSX from 'xlsx-js-style';
import { generateSystemQRCode, generateSystemQRData } from '../../utils/qrCodeGenerator.js';

const ActivityLogs = () => {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false
  });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    source: 'all',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    fetchActivityLogs(pagination.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page]);

  useEffect(() => {
    filterLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, searchQuery, filters, sortConfig]);

  const fetchActivityLogs = async (page = 1) => {
    setLoading(true);
    try {
      // Unified activity endpoint with pagination
      const res = await apiClient.get(`/api/admin/activity?page=${page}&limit=50`);
      let activities = Array.isArray(res.data.activities) ? res.data.activities : [];
      
      // Fallback: legacy alerts endpoint if unified returns empty
      if (activities.length === 0 && !res.data.pagination) {
        const legacy = await apiClient.get('/api/admin/alerts');
        const legacyAlerts = Array.isArray(legacy.data.alerts) ? legacy.data.alerts : [];
        activities = legacyAlerts.map((a) => ({
          id: String(a._id || a.id || Math.random()),
          source: 'admin',
          type: a.type || 'alert',
          message: a.message,
          link: a.link || null,
          createdAt: a.createdAt || a.updatedAt || a.timestamp,
        }));
      }
      
      setAlerts(activities);
      
      // Update pagination if available
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load activity logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key, direction) => {
    setSortConfig({ key, direction });
  };

  const filterLogs = () => {
    let logs = [...alerts];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(log =>
        String(log.message || '').toLowerCase().includes(q) ||
        String(log.type || '').toLowerCase().includes(q) ||
        String(log.source || '').toLowerCase().includes(q)
      );
    }

    // Filter by type
    if (filters.type !== 'all') {
      logs = logs.filter(log => log.type === filters.type);
    }

    // Filter by source
    if (filters.source !== 'all') {
      logs = logs.filter(log => log.source === filters.source);
    }

    // Filter by date range
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      if (!isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        logs = logs.filter(log => {
          const logDate = new Date(log.createdAt || log.timestamp);
          return !isNaN(logDate.getTime()) && logDate >= fromDate;
        });
      }
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        logs = logs.filter(log => {
          const logDate = new Date(log.createdAt || log.timestamp);
          return !isNaN(logDate.getTime()) && logDate <= toDate;
        });
      }
    }

    // Sort logs
    logs.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle date sorting
      if (sortConfig.key === 'createdAt' || sortConfig.key === 'timestamp') {
        aValue = new Date(a.createdAt || a.timestamp || 0);
        bValue = new Date(b.createdAt || b.timestamp || 0);
      }

      // Handle string sorting
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

    setFilteredAlerts(logs);
  };

  const renderAlertIcon = (type, source) => {
    switch (type) {
      case 'room-conflict':
        return <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#dc2626', fontSize: 16 }} />;
      case 'pending-approval':
        return <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#b91c1c', fontSize: 16 }} />;
      case 'availability-update':
        return <FontAwesomeIcon icon={faCheckCircle} style={{ color: '#059669', fontSize: 16 }} />;
      case 'instructor-notification':
      case 'instructor-login':
      case 'instructor-logout':
      case 'instructor-profile-updated':
      case 'instructor-image-uploaded':
      case 'report-downloaded':
        return <FontAwesomeIcon icon={faClipboardList} style={{ color: '#4f46e5', fontSize: 16 }} />;
      default:
        return source === 'instructor'
          ? <FontAwesomeIcon icon={faClipboardList} style={{ color: '#4f46e5', fontSize: 16 }} />
          : <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#dc2626', fontSize: 16 }} />;
    }
  };

  const getAlertBadgeColor = (type, source) => {
    switch (type) {
      case 'availability-update':
        return { bg: '#dcfce7', color: '#16a34a' };
      case 'pending-approval':
        return { bg: '#fee2e2', color: '#dc2626' };
      case 'room-conflict':
        return { bg: '#fef3c7', color: '#d97706' };
      case 'instructor-login':
      case 'instructor-profile-updated':
      case 'report-downloaded':
        return { bg: '#dbeafe', color: '#0369a1' };
      case 'instructor-logout':
      case 'instructor-image-uploaded':
      case 'instructor-notification':
        return { bg: '#e0e7ff', color: '#4f46e5' };
      default:
        return source === 'instructor'
          ? { bg: '#e0e7ff', color: '#4f46e5' }
          : { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const formatTimestamp = (ts) => {
    const date = ts ? new Date(ts) : null;
    if (!date || isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatAlertType = (type) => {
    return type.replace(/-/g, ' ').toUpperCase();
  };

  const exportActivityLogsToPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;
      
      // Generate QR code for system identification
      let qrCodeDataURL = null;
      try {
        qrCodeDataURL = await generateSystemQRCode({
          reportType: 'Activity Logs Report',
          generatedDate: new Date().toISOString(),
          additionalInfo: `Total Activities: ${filteredAlerts.length}`
        }, 100);
      } catch (qrError) {
        console.warn('QR code generation failed, continuing without QR code:', qrError);
      }

    // Header
    doc.setFillColor(15, 44, 99);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Activity Logs Report', margin, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin - 60, 20);

    yPos = 40;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);

    // Table headers
    const headers = ['Type', 'Activity', 'Date & Time'];
    const colWidths = [30, 110, 40];
    let xPos = margin;

    doc.setFillColor(248, 250, 252);
    doc.rect(xPos, yPos, pageWidth - 2 * margin, 10, 'F');
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    headers.forEach((header, i) => {
      doc.text(header, xPos + 2, yPos + 7);
      xPos += colWidths[i];
    });

    yPos += 12;
    doc.setFont(undefined, 'normal');

    // Table rows
    filteredAlerts.forEach((alert, index) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = margin + 10;
        // Repeat header
        xPos = margin;
        doc.setFillColor(248, 250, 252);
        doc.rect(xPos, yPos - 10, pageWidth - 2 * margin, 10, 'F');
        doc.setFont(undefined, 'bold');
        headers.forEach((header, i) => {
          doc.text(header, xPos + 2, yPos - 3);
          xPos += colWidths[i];
        });
        doc.setFont(undefined, 'normal');
        yPos += 2;
      }

      xPos = margin;
      const typeText = formatAlertType(alert.type || alert.source || 'activity').split(' ')[0];
      const message = doc.splitTextToSize(alert.message || '', colWidths[1] - 4);
      const timeText = formatTimestamp(alert.createdAt || alert.timestamp);

      doc.text(typeText, xPos + 2, yPos + 5);
      xPos += colWidths[0];
      doc.text(message, xPos + 2, yPos + 5);
      yPos += Math.max(8, message.length * 4);
      doc.text(timeText, xPos + colWidths[1] + 2, yPos - Math.max(8, message.length * 4) + 5);
      yPos += 4;
    });

    // Add footers and QR codes to all pages
    const totalPages = doc.internal.pages.length - 1;
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 8;
    const qrSize = 20; // QR code size in mm
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      
      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      // Add QR code on the left side of footer (first page only)
      if (i === 1 && qrCodeDataURL) {
        try {
          doc.addImage(qrCodeDataURL, 'PNG', margin, footerY - qrSize - 2, qrSize, qrSize);
          doc.setFontSize(6);
          doc.text('System Verified', margin + qrSize / 2, footerY - qrSize - 4, { align: 'center' });
        } catch (error) {
          console.error('Error adding QR code to PDF:', error);
        }
      }
      
      // Left footer: System name (with space for QR code on first page)
      const leftMargin = (i === 1 && qrCodeDataURL) ? margin + qrSize + 3 : margin;
      doc.text(
        'Class Scheduling System',
        leftMargin,
        footerY,
        { align: 'left' }
      );
      
      // Center footer: Generation date
      doc.text(
        `Generated: ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        footerY,
        { align: 'center' }
      );
      
      // Right footer: Page number
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        footerY,
        { align: 'right' }
      );
    }

      doc.save(`activity-logs-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const exportActivityLogsToExcel = async () => {
    // Generate QR code data for system identification
    const qrCodeData = generateSystemQRData({
      reportType: 'Activity Logs Report (Excel)',
      generatedDate: new Date().toISOString(),
      additionalInfo: `Total Activities: ${filteredAlerts.length}`
    });
    
    const wb = XLSX.utils.book_new();
    
    const data = [
      ['Type', 'Source', 'Activity', 'Date & Time'],
      ...filteredAlerts.map(alert => [
        formatAlertType(alert.type || alert.source || 'activity'),
        alert.source || 'N/A',
        alert.message || '',
        formatTimestamp(alert.createdAt || alert.timestamp)
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Style header row
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 60 }, { wch: 25 }];
    
    // Header row styling
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: "0f2c63" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    // Add footer rows
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const totalRows = range.e.r + 1;
    const columnCount = range.e.c + 1;
    const footerStartRow = totalRows;
    
    const footerRow1 = new Array(columnCount).fill('');
    const footerRow2 = new Array(columnCount).fill('');
    const footerRow3 = new Array(columnCount).fill('');
    const footerRow4 = new Array(columnCount).fill('');
    
    footerRow1[0] = 'Class Scheduling System';
    footerRow2[0] = `Generated: ${new Date().toLocaleString()}`;
    footerRow3[0] = 'Activity Logs Report';
    footerRow4[0] = `System QR Code Data: ${qrCodeData}`;
    
    // Add footer rows to data
    const footer1Ref = XLSX.utils.encode_cell({ r: footerStartRow, c: 0 });
    const footer2Ref = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 0 });
    const footer3Ref = XLSX.utils.encode_cell({ r: footerStartRow + 2, c: 0 });
    const footer4Ref = XLSX.utils.encode_cell({ r: footerStartRow + 3, c: 0 });
    
    ws[footer1Ref] = { t: 's', v: footerRow1[0] };
    ws[footer2Ref] = { t: 's', v: footerRow2[0] };
    ws[footer3Ref] = { t: 's', v: footerRow3[0] };
    ws[footer4Ref] = { t: 's', v: footerRow4[0] };
    
    // Style footer rows
    const footerStyle = {
      font: { color: { rgb: '64748B' }, sz: 9, italic: true },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    
    ws[footer1Ref].s = { ...footerStyle, font: { ...footerStyle.font, bold: true } };
    ws[footer2Ref].s = footerStyle;
    ws[footer3Ref].s = footerStyle;
    ws[footer4Ref].s = {
      font: { color: { rgb: '4F46E5' }, sz: 8, italic: true },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    
    // Merge footer cells across all columns
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
      { s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: columnCount - 1 } },
      { s: { r: footerStartRow + 1, c: 0 }, e: { r: footerStartRow + 1, c: columnCount - 1 } },
      { s: { r: footerStartRow + 2, c: 0 }, e: { r: footerStartRow + 2, c: columnCount - 1 } },
      { s: { r: footerStartRow + 3, c: 0 }, e: { r: footerStartRow + 3, c: columnCount - 1 } }
    );
    
    // Update sheet reference to include footer rows
    const newRange = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: footerStartRow + 3, c: columnCount - 1 }
    });
    ws['!ref'] = newRange;

    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    XLSX.writeFile(wb, `activity-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', height: '100vh', background: '#fafafa' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <Header title="Activity Logs" />
        <div className="dashboard-content" style={{ marginTop: '140px', background: '#fafafa' }}>
          {/* Header Section */}
          <div style={{ 
            marginBottom: '24px',
            background: '#ffffff',
            padding: '20px 24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(15, 44, 99, 0.1)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  background: '#0f2c63',
                  padding: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(15, 44, 99, 0.2)'
                }}>
                  <FontAwesomeIcon icon={faClipboardList} style={{ fontSize: 24, color: '#fff' }} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                    Activity Logs
                  </h2>
                  <p style={{ margin: '6px 0 0 0', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
                    View all system activities and changes
                  </p>
                </div>
              </div>
              {filteredAlerts.length > 0 && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => exportActivityLogsToPDF()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#b91c1c';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#dc2626';
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.2)';
                    }}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Export PDF
                  </button>
                  <button
                    onClick={() => exportActivityLogsToExcel()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: '#0e7490',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 8px rgba(14, 116, 144, 0.2)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#155e75';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 116, 144, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#0e7490';
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 116, 144, 0.2)';
                    }}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Export Excel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div
            style={{
              background: '#fff',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: showFilters ? '16px' : 0 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <FontAwesomeIcon
                  icon={faSearch}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af',
                    fontSize: '13px',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 10px 10px 36px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    background: showFilters ? '#0f2c63' : '#ffffff',
                    color: showFilters ? '#fff' : '#374151',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    boxShadow: showFilters ? '0 2px 8px rgba(15, 44, 99, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!showFilters) {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showFilters) {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
              >
                <FontAwesomeIcon icon={faFilter} />
                Filters
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div style={{
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Type
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="schedule-created">Schedule Created</option>
                    <option value="schedule-deleted">Schedule Deleted</option>
                    <option value="instructor-added">Instructor Added</option>
                    <option value="instructor-notification">Instructor Notification</option>
                    <option value="instructor-login">Instructor Login</option>
                    <option value="instructor-logout">Instructor Logout</option>
                    <option value="instructor-profile-updated">Profile Updated</option>
                    <option value="instructor-image-uploaded">Image Uploaded</option>
                    <option value="report-downloaded">Report Downloaded</option>
                    <option value="room-conflict">Room Conflict</option>
                    <option value="availability-update">Availability Update</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Source
                  </label>
                  <select
                    value={filters.source}
                    onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  >
                    <option value="all">All Sources</option>
                    <option value="admin">Admin</option>
                    <option value="instructor">Instructor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '4px' }} />
                    Date From
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    <FontAwesomeIcon icon={faCalendarAlt} style={{ marginRight: '4px' }} />
                    Date To
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    onClick={() => setFilters({ type: 'all', source: 'all', dateFrom: '', dateTo: '' })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '2px solid #e5e7eb',
                      background: '#fff',
                      color: '#374151',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Activity Logs Table */}
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              overflow: 'hidden',
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '2px solid #f1f5f9',
                background: '#fafafa',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                All Activities
              </h3>
              <span
                style={{
                  background: '#e0e7ff',
                  color: '#4f46e5',
                  padding: '4px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                }}
              >
                {filteredAlerts.length} {filteredAlerts.length === 1 ? 'Activity' : 'Activities'}
              </span>
            </div>

            {/* Scrollable Table Container */}
            <div
              style={{
                maxHeight: 'calc(100vh - 380px)',
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' }}>
                  Loading activity logs...
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <FontAwesomeIcon
                    icon={faClipboardList}
                    style={{ fontSize: 48, color: '#d1d5db', marginBottom: '12px' }}
                  />
                  <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                    {searchQuery ? 'No matching activities found' : 'No activity logs available'}
                  </p>
                </div>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                  }}
                >
                  <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1 }}>
                    <tr>
                      <TableSortHeader
                        sortKey="type"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        style={{
                          padding: '12px 20px',
                          fontWeight: '700',
                          color: '#374151',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '2px solid #e5e7eb',
                          width: '100px',
                          background: sortConfig.key === 'type' ? '#e5e7eb' : '#f9fafb'
                        }}
                      >
                        Type
                      </TableSortHeader>
                      <TableSortHeader
                        sortKey="message"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        style={{
                          padding: '12px 20px',
                          fontWeight: '700',
                          color: '#374151',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '2px solid #e5e7eb',
                          background: sortConfig.key === 'message' ? '#e5e7eb' : '#f9fafb'
                        }}
                      >
                        Activity
                      </TableSortHeader>
                      <TableSortHeader
                        sortKey="createdAt"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        style={{
                          padding: '12px 20px',
                          fontWeight: '700',
                          color: '#374151',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          borderBottom: '2px solid #e5e7eb',
                          width: '180px',
                          background: sortConfig.key === 'createdAt' ? '#e5e7eb' : '#f9fafb'
                        }}
                      >
                        Date & Time
                      </TableSortHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((alert, index) => {
                      const badgeColor = getAlertBadgeColor(alert.type, alert.source);
                      return (
                        <tr
                          key={alert.id || index}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.2s ease',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  background: badgeColor.bg,
                                  padding: '6px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {renderAlertIcon(alert.type, alert.source)}
                              </div>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  backgroundColor: badgeColor.bg,
                                  color: badgeColor.color,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {formatAlertType(alert.type || alert.source || 'activity').split(' ')[0]}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                            <p style={{ margin: 0, color: '#1f2937', lineHeight: 1.5, fontSize: '14px' }}>
                              {alert.message}
                            </p>
                          </td>
                          <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                            <span
                              style={{
                                color: '#6b7280',
                                fontWeight: '500',
                                fontSize: '13px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {formatTimestamp(alert.createdAt || alert.timestamp)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '20px',
                borderTop: '2px solid #f1f5f9',
                background: '#fafafa'
              }}>
                <button
                  onClick={() => fetchActivityLogs(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: pagination.hasPrev ? '#0f2c63' : '#e5e7eb',
                    color: pagination.hasPrev ? 'white' : '#9ca3af',
                    fontWeight: '600',
                    cursor: pagination.hasPrev ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxShadow: pagination.hasPrev ? '0 2px 8px rgba(15, 44, 99, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (pagination.hasPrev) {
                      e.currentTarget.style.background = '#1e3a72';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pagination.hasPrev) {
                      e.currentTarget.style.background = '#0f2c63';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 44, 99, 0.2)';
                    }
                  }}
                >
                  Previous
                </button>
                
                <span style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                
                <button
                  onClick={() => fetchActivityLogs(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: pagination.hasNext ? '#0f2c63' : '#e5e7eb',
                    color: pagination.hasNext ? 'white' : '#9ca3af',
                    fontWeight: '600',
                    cursor: pagination.hasNext ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    boxShadow: pagination.hasNext ? '0 2px 8px rgba(15, 44, 99, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (pagination.hasNext) {
                      e.currentTarget.style.background = '#1e3a72';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 44, 99, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pagination.hasNext) {
                      e.currentTarget.style.background = '#0f2c63';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 44, 99, 0.2)';
                    }
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Custom Scrollbar Styling */}
        <style>{`
          .dashboard-content > div:last-child > div:last-child::-webkit-scrollbar {
            width: 8px;
          }
          .dashboard-content > div:last-child > div:last-child::-webkit-scrollbar-track {
            background: #f1f5f9;
          }
          .dashboard-content > div:last-child > div:last-child::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .dashboard-content > div:last-child > div:last-child::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
      </main>
    </div>
  );
};

export default ActivityLogs;
