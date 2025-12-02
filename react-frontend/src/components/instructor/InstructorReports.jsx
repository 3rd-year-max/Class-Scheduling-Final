import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import InstructorSidebar from "../common/InstructorSidebar.jsx";
import InstructorHeader from "../common/InstructorHeader.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload, faFileAlt, faCalendarAlt, faClock,
  faSearch, faDoorOpen, faGraduationCap, faTable, faChartBar,
} from "@fortawesome/free-solid-svg-icons";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  generateTimeSlots,
  timeStringToMinutes,
  TIME_SLOT_CONFIGS,
} from "../../utils/timeUtils.js";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import axios from 'axios';
import apiClient from '../../services/apiClient.js';
import { faCode } from '@fortawesome/free-solid-svg-icons';
import { io } from 'socket.io-client';
import { useToast } from '../common/ToastProvider.jsx';

const InstructorReports = () => {
  const { userEmail } = useContext(AuthContext);
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [instructorData, setInstructorData] = useState({
    instructorId: "", firstname: "", lastname: "", email: "", department: "",
  });

  const [instructorSchedule, setInstructorSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig] = useState({ key: "day", direction: "asc" });
  const [filterDay, setFilterDay] = useState("All Days");
  const [filterYear, setFilterYear] = useState("All Years");
  const [filteredSchedule, setFilteredSchedule] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or table

  // Courses and year levels for Excel export (matching admin format)
  const courses = useMemo(() => [
    {
      id: 'bsit',
      name: 'BS Information Technology',
      shortName: 'BSIT',
      icon: faGraduationCap,
      gradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
      color: '#0f2c63',
    },
    {
      id: 'bsemc-dat',
      name: 'BS Entertainment and Multimedia Computing',
      shortName: 'BSEMC-DAT',
      icon: faCode,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      color: '#7c3aed',
    },
  ], []);

  const yearLevels = useMemo(() => [
    { id: '1styear', label: '1st Year', year: 1 },
    { id: '2ndyear', label: '2nd Year', year: 2 },
    { id: '3rdyear', label: '3rd Year', year: 3 },
    { id: '4thyear', label: '4th Year', year: 4 },
  ], []);

  // Generate time slots for the weekly grid view
  const timeSlots = useMemo(() => generateTimeSlots(
    TIME_SLOT_CONFIGS.DETAILED.startHour,
    TIME_SLOT_CONFIGS.DETAILED.endHour,
    TIME_SLOT_CONFIGS.DETAILED.duration,
  ), []);

  // Days of the week for the grid
  // Initialize search from URL query (?q=)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearchTerm(q);
  }, []);
  const weekDays = [
    { key: "Monday", label: "Monday", short: "Mon" },
    { key: "Tuesday", label: "Tuesday", short: "Tue" },
    { key: "Wednesday", label: "Wednesday", short: "Wed" },
    { key: "Thursday", label: "Thursday", short: "Thu" },
    { key: "Friday", label: "Friday", short: "Fri" },
  ];

  // Normalize a time range into minutes and a consistent display
  const normalizeTimeRange = useCallback((timeRange) => {
    const raw = String(timeRange || "");
    // Accept formats like "7:30 AM - 9:00 AM" or "7:30AM-9:00AM" or "07:30-09:00"
    const parts = raw.split(/\s*-\s*/);
    const startPart = (parts[0] || "").trim();
    const endPart = (parts[1] || "").trim();
    const startMinutes = timeStringToMinutes(startPart);
    const endMinutes = timeStringToMinutes(endPart);
    return {
      display: endPart ? `${startPart} - ${endPart}` : startPart,
      startMinutes,
      endMinutes,
    };
  }, []);

  // Normalize a single schedule item into a consistent shape for rendering
  const normalizeScheduleItem = useCallback((raw) => {
    if (!raw || typeof raw !== "object") return null;
    const subject = String(raw.subject || raw.Subject || "").trim();
    const timeRaw = String(raw.time || raw.Time || "").trim();
    const room = String(raw.room || raw.Room || "").trim();
    const section = String(raw.section || raw.Section || "").trim();
    // course could be string or object; year could be on raw or inside course
    let courseVal = raw.course;
    let yearVal = raw.year || raw.Year;
    if (courseVal && typeof courseVal === "object") {
      // common variants: { name, code, year }
      courseVal = courseVal.name || courseVal.code || "";
      yearVal = yearVal || courseVal?.year;
    }
    const course = String(courseVal || "").trim();
    const year = String(yearVal || "").trim();
    const day = String(raw.day || raw.Day || "").trim();
    const { display: time, startMinutes, endMinutes } = normalizeTimeRange(timeRaw);
    return { day, time, timeDisplay: time, startMinutes, endMinutes, subject, course, year, section, room, _id: raw._id };
  }, [normalizeTimeRange]);

  // Normalize day tokens for different formats (e.g., mon, monday)
  const normalizeDayTokens = (value) => {
    if (!value) return [];
    const alias = {
      mon: "monday", monday: "monday",
      tue: "tuesday", tues: "tuesday", tuesday: "tuesday",
      wed: "wednesday", weds: "wednesday", wednesday: "wednesday",
      thu: "thursday", thur: "thursday", thurs: "thursday", thursday: "thursday",
      fri: "friday", friday: "friday",
      sat: "saturday", saturday: "saturday",
      sun: "sunday", sunday: "sunday",
    };
    return value
      .toLowerCase()
      .split(/[^a-z]/)
      .map((t) => alias[t])
      .filter(Boolean);
  };

  // Fetch instructor data and schedule
  useEffect(() => {
    const fetchInstructorData = async () => {
      if (!userEmail) {
        console.log("No userEmail available yet");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        // Fetch instructor profile data
        const profileResponse = await fetch(
          `/api/instructors/profile/by-email/${encodeURIComponent(userEmail)}`
        );
        if (!profileResponse.ok) throw new Error("Failed to fetch instructor profile");
        const profileData = await profileResponse.json();
        setInstructorData({
          instructorId: profileData.instructorId,
          firstname: profileData.firstname,
          lastname: profileData.lastname,
          email: profileData.email,
          department: profileData.department,
        });

        // Fetch schedule by email, then fallback by name and merge unique
        const instructorEmail = profileData.email;
        let merged = [];
        const normalize = (data) => Array.isArray(data) ? data : (data?.schedules || []);
        const token = localStorage.getItem('token');

        if (instructorEmail && instructorEmail.trim()) {
          const scheduleResponse = await fetch(`/api/schedule/instructor/${encodeURIComponent(instructorEmail)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (scheduleResponse.ok) {
            const scheduleData = await scheduleResponse.json();
            merged = normalize(scheduleData);
          } else {
            const errorData = await scheduleResponse.json().catch(() => ({}));
            console.error('Failed to fetch schedules:', errorData.message || scheduleResponse.statusText);
          }
        }

        const fullName = `${profileData.firstname || ''} ${profileData.lastname || ''}`.trim();
        if (fullName.length > 0) {
          try {
            const byNameRes = await fetch(`/api/schedule/instructor/by-name/${encodeURIComponent(fullName)}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (byNameRes.ok) {
              const byNameData = await byNameRes.json();
              const byName = normalize(byNameData);
              const keyOf = (s) => `${s._id || ''}|${s.day}|${s.time}|${s.subject}`;
              const map = new Map(merged.map((s) => [keyOf(s), s]));
              byName.forEach((s) => { if (s) map.set(keyOf(s), s); });
              merged = Array.from(map.values());
            }
          } catch (e) {
            console.log('Fallback by-name fetch failed', e);
          }
        }

        // Normalize all schedule entries for consistent rendering in both views
        const normalized = merged
          .filter(Boolean)
          .map((s) => normalizeScheduleItem(s))
          .filter(Boolean);
        setInstructorSchedule(normalized);
      } catch (error) {
        console.error("Error fetching instructor data:", error);
        setError(error.message);
        setInstructorSchedule([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInstructorData();
  }, [userEmail, normalizeScheduleItem]);

  // Setup Socket.io for real-time schedule updates
  useEffect(() => {
    if (!userEmail) return;

    const socket = io(process.env.REACT_APP_API_BASE || 'http://localhost:5000', { autoConnect: true });

    socket.on('connect', () => {
      console.log('✅ Connected to server for schedule updates (Reports)');
      // Subscribe to instructor-specific updates
      if (userEmail) {
        socket.emit('join-instructor-channel', { email: userEmail });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.io connection error:', error);
    });

    // Real-time schedule creation
    socket.on('schedule-created', (data) => {
      console.log('📢 New schedule created (Reports):', data);
      if (data.schedule && data.schedule.instructorEmail?.toLowerCase() === userEmail?.toLowerCase()) {
        setInstructorSchedule(prev => {
          const exists = prev.some(s => s._id === data.schedule?._id);
          if (exists) return prev;
          const normalized = normalizeScheduleItem(data.schedule);
          return normalized ? [...prev, normalized] : prev;
        });
        showToast('✓ New schedule added', 'success', 2000);
      }
    });

    // Real-time schedule updates
    socket.on('schedule-updated', (data) => {
      console.log('📢 Schedule updated (Reports):', data);
      if (data.schedule && data.schedule.instructorEmail?.toLowerCase() === userEmail?.toLowerCase()) {
        setInstructorSchedule(prev => {
          const normalized = normalizeScheduleItem(data.schedule);
          return normalized 
            ? prev.map(s => s._id === data.schedule._id ? normalized : s)
            : prev;
        });
        showToast('✓ Schedule updated', 'success', 2000);
      }
    });

    // Real-time schedule deletions
    socket.on('schedule-deleted', (data) => {
      console.log('📢 Schedule deleted (Reports):', data);
      if (data.schedule && data.schedule.instructorEmail?.toLowerCase() === userEmail?.toLowerCase()) {
        setInstructorSchedule(prev => prev.filter(s => s._id !== data.scheduleId));
        showToast('✓ Schedule removed', 'info', 2000);
      }
    });

    // Real-time schedule archive/restore
    socket.on('schedule-archived', (data) => {
      console.log('📢 Schedule archived (Reports):', data);
      if (data.schedule && data.schedule.instructorEmail?.toLowerCase() === userEmail?.toLowerCase()) {
        setInstructorSchedule(prev => prev.filter(s => s._id !== data.schedule._id));
        showToast('✓ Schedule archived', 'info', 2000);
      }
    });

    socket.on('schedule-restored', (data) => {
      console.log('📢 Schedule restored (Reports):', data);
      if (data.schedule && data.schedule.instructorEmail?.toLowerCase() === userEmail?.toLowerCase()) {
        const normalized = normalizeScheduleItem(data.schedule);
        if (normalized) {
          setInstructorSchedule(prev => {
            const exists = prev.some(s => s._id === normalized._id);
            return exists ? prev : [...prev, normalized];
          });
          showToast('✓ Schedule restored', 'success', 2000);
        }
      }
    });

    // Instructor-specific updates (only affects this instructor)
    socket.on(`schedule-update-${userEmail}`, (data) => {
      console.log('📢 Your schedule changed (Reports):', data);
      if (data.action === 'created') {
        setInstructorSchedule(prev => {
          const exists = prev.some(s => s._id === data.schedule?._id);
          if (exists) return prev;
          const normalized = normalizeScheduleItem(data.schedule);
          return normalized ? [...prev, normalized] : prev;
        });
      } else if (data.action === 'updated') {
        setInstructorSchedule(prev => {
          const normalized = normalizeScheduleItem(data.schedule);
          return normalized 
            ? prev.map(s => s._id === data.schedule._id ? normalized : s)
            : prev;
        });
      } else if (data.action === 'deleted') {
        setInstructorSchedule(prev => prev.filter(s => s._id !== data.scheduleId));
      } else if (data.action === 'archived') {
        setInstructorSchedule(prev => prev.filter(s => s._id !== data.schedule?._id));
      } else if (data.action === 'restored') {
        const normalized = normalizeScheduleItem(data.schedule);
        if (normalized) {
          setInstructorSchedule(prev => {
            const exists = prev.some(s => s._id === normalized._id);
            return exists ? prev : [...prev, normalized];
          });
        }
      }
      showToast(`✓ Your schedule ${data.action}`, 'success', 2000);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from server (Reports)');
    });

    return () => {
      socket.disconnect();
    };
  }, [userEmail, normalizeScheduleItem, showToast]);

  // Utility to get day order for sorting
  const getDayOrder = (day) => {
    const dayOrder = {
      Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
    };
    return dayOrder[day] || 999;
  };

  // Sort schedule data
  const sortSchedule = useCallback((schedules, key, direction) => {
    return [...schedules].sort((a, b) => {
      let aValue, bValue;
      switch (key) {
        case "day":
          aValue = getDayOrder(a.day);
          bValue = getDayOrder(b.day);
          break;
        case "time":
          {
            const getStart = (s) =>
              typeof s?.startMinutes === "number"
                ? s.startMinutes
                : timeStringToMinutes(String(s?.time || ""));
            aValue = getStart(a);
            bValue = getStart(b);
          }
          break;
        case "subject":
          aValue = a.subject?.toLowerCase() || "";
          bValue = b.subject?.toLowerCase() || "";
          break;
        case "course":
          aValue = `${a.course || ""} ${a.year || ""}`.trim().toLowerCase();
          bValue = `${b.course || ""} ${b.year || ""}`.trim().toLowerCase();
          break;
        case "room":
          aValue = a.room?.toLowerCase() || "";
          bValue = b.room?.toLowerCase() || "";
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, []);

  // Utility: check if a schedule includes a specific day
  const scheduleIncludesDay = useCallback((scheduleDay, dayLabel) => {
    if (!scheduleDay || !dayLabel) return false;
    const tokens = normalizeDayTokens(scheduleDay);
    return tokens.includes(String(dayLabel).toLowerCase());
  }, []);

  // Filter and sort schedule data on changes
  useEffect(() => {
    let filtered = instructorSchedule;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((s) => {
        const courseYear = `${s.course || ""} ${s.year || ""}`.toLowerCase();
        return (
          (s.subject || "").toLowerCase().includes(q) ||
          courseYear.includes(q) ||
          (s.room || "").toLowerCase().includes(q) ||
          (s.section || "").toLowerCase().includes(q) ||
          (s.day || "").toLowerCase().includes(q)
        );
      });
    }

    // Day filter (supports multi-day entries)
    if (filterDay !== "All Days") {
      filtered = filtered.filter((schedule) =>
        scheduleIncludesDay(schedule.day, filterDay)
      );
    }

    // Year level filter
    if (filterYear !== "All Years") {
      filtered = filtered.filter((schedule) => {
        // Handle both string and number year values
        const scheduleYear = String(schedule.year || "").trim();
        const filterYearValue = String(filterYear).trim();
        // Match year values - handle "1", "1st", "first year", etc.
        const normalizedScheduleYear = scheduleYear.toLowerCase().replace(/[^0-9]/g, '');
        const normalizedFilterYear = filterYearValue.replace(/[^0-9]/g, '');
        // Direct match or extract number from strings like "1st", "2nd", etc.
        return normalizedScheduleYear === normalizedFilterYear || 
               scheduleYear === filterYearValue ||
               String(schedule.year) === filterYearValue;
      });
    }

    // Sorting
    filtered = sortSchedule(filtered, sortConfig.key, sortConfig.direction);
    setFilteredSchedule(filtered);
  }, [instructorSchedule, searchTerm, filterDay, filterYear, sortConfig, sortSchedule, scheduleIncludesDay]);

  // removed old tableSchedules (not used in admin-style table)

  // removed dayHasSchedules (not used)

  // Log report download activity
  const logReportDownload = async (reportType) => {
    try {
      await axios.post(`${process.env.REACT_APP_API_BASE || 'http://localhost:5000'}/api/instructors/log-activity`, {
        type: 'report-downloaded',
        reportType: reportType,
        message: `Downloaded ${reportType} report`,
        email: userEmail
      });
    } catch (error) {
      console.error('Failed to log report download:', error);
      // Don't fail the download if logging fails
    }
  };


  // Helper function to expand multi-day schedules
  const expandScheduleDays = () => {
    const properLabel = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    };
    const expanded = [];
    filteredSchedule.forEach((s) => {
      const days = normalizeDayTokens(s.day);
      if (days.length === 0) {
        expanded.push({ ...s, day: s.day });
      } else {
        days.forEach((d) => expanded.push({ ...s, day: properLabel[d] || s.day }));
      }
    });
    return expanded;
  };

  // PDF Export: Professional table format schedule report
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    
    // Colors
    const headerColor = [15, 44, 99]; // #0f2c63

    // Report Header
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('TEACHING SCHEDULE REPORT', margin, 18);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(
      `${instructorData.firstname} ${instructorData.lastname} • ${instructorData.department || 'N/A'}`,
      margin,
      26
    );
    
    if (instructorData.instructorId) {
      doc.setFontSize(9);
      doc.text(`Instructor ID: ${instructorData.instructorId}`, margin, 32);
    }
    
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 26, { align: 'right' });

    // Get and prepare schedules
    const expanded = expandScheduleDays();
    
    // Sort schedules by day and time for better organization
    const dayOrder = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 7 };
    const sortedSchedules = [...expanded].sort((a, b) => {
      const aDay = (a.day || '').toLowerCase();
      const bDay = (b.day || '').toLowerCase();
      const aDayOrder = dayOrder[aDay] || 99;
      const bDayOrder = dayOrder[bDay] || 99;
      
      if (aDayOrder !== bDayOrder) {
        return aDayOrder - bDayOrder;
      }
      
      // Sort by time if same day
      const aTime = timeStringToMinutes((a.time || '').split(' - ')[0]);
      const bTime = timeStringToMinutes((b.time || '').split(' - ')[0]);
      return aTime - bTime;
    });

    // Prepare table data
    const tableData = sortedSchedules.map(schedule => [
      schedule.day || '',
      schedule.timeDisplay || schedule.time || '',
      schedule.subject || '',
      `${schedule.course || ''} ${schedule.year || ''} - ${schedule.section || ''}`.trim(),
      schedule.room || ''
    ]);

    // Summary Information Box
    const summaryY = instructorData.instructorId ? 50 : 45;
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, summaryY, pageWidth - (margin * 2), 25, 3, 3, 'FD');
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Summary Information', margin + 3, summaryY + 8);
    
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    const summaryText = [
      `Total Classes: ${filteredSchedule.length}`,
      `• Teaching Days: ${new Set(filteredSchedule.map(s => s.day)).size}`,
      `• Unique Subjects: ${new Set(filteredSchedule.map(s => s.subject)).size}`,
      `• Rooms Used: ${new Set(filteredSchedule.map(s => s.room)).size}`
    ];
    doc.text(summaryText.join('  '), margin + 3, summaryY + 16);

    // Generate table using autoTable
    doc.autoTable({
      startY: summaryY + 30,
      head: [['Day', 'Time', 'Subject', 'Course Section', 'Room']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'left',
        valign: 'middle',
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 9,
        halign: 'left',
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Day
        1: { cellWidth: 30 }, // Time
        2: { cellWidth: 'auto' }, // Subject
        3: { cellWidth: 45 }, // Course Section
        4: { cellWidth: 25 }, // Room
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
        cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      },
      didDrawPage: (data) => {
        // Add header on each page (except first)
        if (data.pageNumber > 1) {
          doc.setFillColor(...headerColor);
          doc.rect(0, 0, pageWidth, 20, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(
            `${instructorData.firstname} ${instructorData.lastname} • ${instructorData.department || 'N/A'}`,
            margin,
            12
          );
        }
      },
    });

    // Add page numbers to all pages after table is drawn
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'right' }
      );
    }

    // Save the PDF
    doc.save(`Teaching_Schedule_${instructorData.firstname}_${instructorData.lastname}.pdf`);
    
    // Log the download activity
    logReportDownload('PDF');
  };

  // Helper functions for Excel export (matching admin format)
  const excelHeaderStyle = {
    fill: { fgColor: { rgb: '0F2C63' } },
    font: { color: { rgb: 'FFFFFF' }, bold: true, sz: 12 },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };

  const excelSubHeaderStyle = {
    fill: { fgColor: { rgb: 'E0E7FF' } },
    font: { color: { rgb: '0F172A' }, bold: true, sz: 11 },
    border: {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  };

  const scheduleHighlightPalette = [
    'FFE4E6', // rose
    'FEF3C7', // amber
    'DCFCE7', // green
    'E0E7FF', // indigo
    'E9D5FF', // purple
    'FDE68A', // yellow
    'BAE6FD', // sky
    'FBCFE8', // pink
  ];

  const buildSheetIntroRows = (title, subtitle, columnCount) => {
    const createRow = (text = '') => {
      const row = new Array(columnCount).fill('');
      if (text) row[0] = text;
      return row;
    };

    return {
      titleRow: createRow(title),
      subtitleRow: createRow(subtitle),
      spacerRow: createRow(''),
    };
  };

  const applyRowStyle = (worksheet, rowIndex, columnCount, style) => {
    for (let c = 0; c < columnCount; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c });
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = style;
      }
    }
  };

  // Generate time slots in 30-minute intervals from 7:30 AM to 9:00 PM
  const generateTimeSlotsForExcel = () => {
    const slots = [];
    let hour = 7;
    let minute = 30; // Start at 7:30 AM
    const endHour = 21; // 9:00 PM
    const endMinute = 0;
    
    while (true) {
      const startHour = hour;
      const startMinute = minute;
      
      // Calculate end time (30 minutes later)
      let slotEndHour = hour;
      let slotEndMinute = minute + 30;
      while (slotEndMinute >= 60) {
        slotEndMinute -= 60;
        slotEndHour += 1;
      }
      
      // If slot end exceeds 9:00 PM, cap it at 9:00 PM
      if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMinute > endMinute)) {
        slotEndHour = endHour;
        slotEndMinute = endMinute;
      }
      
      // Format time
      const startPeriod = startHour >= 12 ? 'PM' : 'AM';
      const startHour12 = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
      const startTimeStr = `${startHour12}:${String(startMinute).padStart(2, '0')} ${startPeriod}`;
      
      const endPeriod = slotEndHour >= 12 ? 'PM' : 'AM';
      const endHour12 = slotEndHour > 12 ? slotEndHour - 12 : (slotEndHour === 0 ? 12 : slotEndHour);
      const endTimeStr = `${endHour12}:${String(slotEndMinute).padStart(2, '0')} ${endPeriod}`;
      
      slots.push({
        label: `${startTimeStr} - ${endTimeStr}`,
        startMinutes: startHour * 60 + startMinute,
        endMinutes: slotEndHour * 60 + slotEndMinute,
      });
      
      // Stop if we've reached 9:00 PM
      if (slotEndHour >= endHour && slotEndMinute >= endMinute) break;
      
      // Move to next slot
      hour = slotEndHour;
      minute = slotEndMinute;
    }
    
    return slots;
  };

  // Check if a schedule time overlaps with a time slot
  const timeOverlapsWithSlot = (scheduleTime, slot) => {
    if (!scheduleTime) return false;
    
    const timeParts = scheduleTime.split(' - ');
    if (timeParts.length !== 2) return false;
    
    const startTime = timeStringToMinutes(timeParts[0].trim());
    const endTime = timeStringToMinutes(timeParts[1].trim());
    
    if (startTime === -1 || endTime === -1) return false;
    
    // Check if schedule overlaps with slot (start before slot ends and end after slot starts)
    return startTime < slot.endMinutes && endTime > slot.startMinutes;
  };

  const parseScheduleTimeRange = (scheduleTime) => {
    if (!scheduleTime) return null;
    const parts = scheduleTime.split(' - ');
    if (parts.length !== 2) return null;
    const start = timeStringToMinutes(parts[0].trim());
    const end = timeStringToMinutes(parts[1].trim());
    if (start === -1 || end === -1) return null;
    return { startMinutes: start, endMinutes: end };
  };

  // Calculate optimal column widths based on content
  const calculateColumnWidths = (worksheet, data, minWidth = 10, maxWidth = 50) => {
    const cols = [];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // For each column, find the maximum content length
    for (let c = 0; c <= range.e.c; c++) {
      let maxLength = minWidth;
      
      // Check all rows in this column
      for (let r = 0; r <= range.e.r; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellRef];
        
        if (cell && cell.v) {
          // Get cell value as string
          let cellValue = '';
          if (typeof cell.v === 'string') {
            cellValue = cell.v;
          } else if (typeof cell.v === 'number') {
            cellValue = cell.v.toString();
          } else if (cell.v.toString) {
            cellValue = cell.v.toString();
          }
          
          // Calculate length (account for newlines and wrapping)
          const lines = cellValue.split('\n');
          const maxLineLength = Math.max(...lines.map(line => line.length));
          
          // Add some padding (2-3 characters) and account for wrapping
          const estimatedWidth = maxLineLength + 3;
          maxLength = Math.max(maxLength, estimatedWidth);
        }
      }
      
      // Clamp to min/max
      const width = Math.min(Math.max(maxLength, minWidth), maxWidth);
      cols.push({ wch: width });
    }
    
    return cols;
  };

  // Excel Export (matching admin format but filtered to instructor)
  const exportToExcel = async () => {
    try {
    const wb = XLSX.utils.book_new();
      const timeSlots = generateTimeSlotsForExcel();
      const generatedLabel = new Date().toLocaleString();
      const scheduleColorMap = new Map();
      let scheduleColorCursor = 0;
      const getScheduleColor = (key) => {
        if (!scheduleColorMap.has(key)) {
          const color = scheduleHighlightPalette[scheduleColorCursor % scheduleHighlightPalette.length];
          scheduleColorMap.set(key, color);
          scheduleColorCursor += 1;
        }
        return scheduleColorMap.get(key);
      };

      // Get instructor's schedules (already filtered)
      const allSchedules = filteredSchedule.map(s => ({
        ...s,
        time: s.timeDisplay || s.time,
        course: String(s.course || '').toLowerCase().trim(),
        year: String(s.year || '').trim(),
        section: String(s.section || '').trim(),
      }));

      // Fetch sections and rooms that the instructor uses
      let allSections = [];
      let rooms = [];
      
      try {
        // Get unique course/year combinations from instructor's schedules
        const courseYearSet = new Set();
        allSchedules.forEach(s => {
          if (s.course && s.year) {
            courseYearSet.add(`${s.course}|${s.year}`);
          }
        });

        // Fetch sections for those course/year combinations
        const sectionPromises = [];
        for (const courseYear of courseYearSet) {
          const [course, year] = courseYear.split('|');
          sectionPromises.push(apiClient.get(`/api/sections?course=${course}&year=${year}`));
        }
        
        const sectionsResults = await Promise.all(sectionPromises);
        allSections = sectionsResults.flatMap(res => 
          Array.isArray(res.data) ? res.data : []
        ).filter(s => allSchedules.some(sched => 
          String(sched.section || '').trim() === String(s.name || '').trim() &&
          String(sched.course || '').toLowerCase().trim() === String(s.course || '').toLowerCase().trim() &&
          String(sched.year || '').trim() === String(s.year || '').trim()
        ));

        // Fetch rooms
        const roomsRes = await apiClient.getRooms();
        const allRooms = Array.isArray(roomsRes.data) ? roomsRes.data : (roomsRes.data?.rooms || []);
        const instructorRoomNames = [...new Set(allSchedules.map(s => s.room).filter(Boolean))];
        rooms = allRooms.filter(r => instructorRoomNames.includes(r.room || r.name));
      } catch (err) {
        console.error('Error fetching sections/rooms:', err);
      }

      // ========== SCHEDULE SHEETS (One per Department) ==========
      for (const course of courses) {
        const sectionColumns = [];

        // Collect sections per course/year first (only instructor's sections)
        for (const yearLevel of yearLevels) {
          const courseSections = allSections
            .filter(s => {
              const schedCourse = String(s.course || '').toLowerCase().trim();
              const schedYear = String(s.year || '').trim();
              return schedCourse === course.id && schedYear === String(yearLevel.year);
            })
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

          courseSections.forEach(section => {
            const paletteIndex = sectionColumns.length % scheduleHighlightPalette.length;
            const highlightColor = scheduleHighlightPalette[paletteIndex];
            sectionColumns.push({
              course: course.id,
              year: yearLevel.year,
              sectionName: section.name,
              yearLabel: yearLevel.label,
              highlightColor,
            });
          });
        }

        if (sectionColumns.length === 0) continue; // Skip if no sections for this course

        const totalColumns = 1 + sectionColumns.length; // Time + sections
        const scheduleData = [];
        const { titleRow, subtitleRow, spacerRow } = buildSheetIntroRows(
          `${course.name} Class Schedule - ${instructorData.firstname} ${instructorData.lastname}`,
          `Generated: ${generatedLabel}`,
          totalColumns
        );

        const titleRowIndex = scheduleData.length;
        scheduleData.push(titleRow);
        const subtitleRowIndex = scheduleData.length;
        scheduleData.push(subtitleRow);
        const spacerRowIndex = scheduleData.length;
        scheduleData.push(spacerRow);

        const yearHeaderRow = ['Year Level'];
        const sectionHeaderRow = ['Time Slot'];
        const yearSegments = [];
        let currentSegment = null;

        sectionColumns.forEach((sectionCol, idx) => {
          const columnIndex = idx + 1; // account for time column
          yearHeaderRow.push(sectionCol.yearLabel);
          sectionHeaderRow.push(`${course.shortName}-${sectionCol.year} ${sectionCol.sectionName}`);

          if (!currentSegment || currentSegment.year !== sectionCol.year) {
            if (currentSegment) yearSegments.push(currentSegment);
            currentSegment = { year: sectionCol.year, start: columnIndex, end: columnIndex };
          } else {
            currentSegment.end = columnIndex;
          }
        });
        if (currentSegment) yearSegments.push(currentSegment);

        const yearHeaderRowIndex = scheduleData.length;
        scheduleData.push(yearHeaderRow);
        const sectionHeaderRowIndex = scheduleData.length;
        scheduleData.push(sectionHeaderRow);

        // Data rows
        const dataRowMetas = [];
        
        // First, collect all schedules and determine which slot index each schedule starts at
        const scheduleSlotMap = new Map();
        
        sectionColumns.forEach((sectionCol, colIndex) => {
          const sectionSchedules = allSchedules.filter(s => {
            const schedYear = String(s.year || '').trim();
            const schedCourse = String(s.course || '').toLowerCase().trim();
            const schedSection = String(s.section || '').trim();

            return (
              schedYear === String(sectionCol.year) &&
              schedCourse === sectionCol.course &&
              schedSection === sectionCol.sectionName
            );
          });

          sectionSchedules.forEach(schedule => {
            const scheduleKey =
              schedule._id ||
              `${schedule.section || ''}|${schedule.subject || ''}|${schedule.day || ''}|${schedule.time || ''}|${schedule.room || ''}`;
            
            const timeRange = parseScheduleTimeRange(schedule.time);
            if (!timeRange) return;

            // Find all slots this schedule spans
            const slotIndices = [];
            timeSlots.forEach((slot, slotIndex) => {
              if (timeOverlapsWithSlot(schedule.time, slot)) {
                slotIndices.push({ slotIndex, startMinutes: slot.startMinutes });
              }
            });

            // Sort by start time to get the order
            slotIndices.sort((a, b) => a.startMinutes - b.startMinutes);

            if (!scheduleSlotMap.has(scheduleKey)) {
              scheduleSlotMap.set(scheduleKey, {
                schedule,
                columns: new Map(),
              });
            }
            scheduleSlotMap.get(scheduleKey).columns.set(colIndex, slotIndices);
          });
        });

        // Now build the rows
        timeSlots.forEach((slot, slotIndex) => {
          const row = [slot.label];
          const metaRow = [null];

          sectionColumns.forEach((sectionCol, colIndex) => {
            let cellText = '';
            let cellColor = null;

            // Find which schedule (if any) should display content in this cell
            for (const [, scheduleData] of scheduleSlotMap.entries()) {
              const columnSlots = scheduleData.columns.get(colIndex);
              if (!columnSlots) continue;

              const slotInfo = columnSlots.find(s => s.slotIndex === slotIndex);
              if (!slotInfo) continue;

              // Find the position of this slot in the schedule's time range
              const positionInSchedule = columnSlots.findIndex(s => s.slotIndex === slotIndex);
              
              const schedule = scheduleData.schedule;
              const scheduleKeyForColor =
                schedule._id ||
                `${schedule.section || ''}|${schedule.subject || ''}|${schedule.day || ''}|${schedule.time || ''}|${schedule.room || ''}`;
              const highlightColor = getScheduleColor(scheduleKeyForColor);
              cellColor = cellColor || highlightColor;

              // First cell: Course code - Subject
              if (positionInSchedule === 0) {
                const courseCode = schedule.course || '';
                const subject = schedule.subject || '';
                cellText = courseCode ? `${courseCode.toUpperCase()} - ${subject}` : subject;
              }
              // Second cell: Instructor
              else if (positionInSchedule === 1) {
                cellText = `${instructorData.firstname} ${instructorData.lastname}`;
              }
              // Third cell: Room
              else if (positionInSchedule === 2) {
                cellText = schedule.room || '';
              }
              // Remaining cells: blank but still highlighted
            }

            row.push(cellText);
            metaRow.push(cellColor);
          });

          scheduleData.push(row);
          dataRowMetas.push(metaRow);
        });

        const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleData);

        // Calculate optimal column widths based on content
        wsSchedule['!cols'] = calculateColumnWidths(wsSchedule, scheduleData, 12, 40);

        wsSchedule['!freeze'] = { xSplit: 1, ySplit: sectionHeaderRowIndex + 1 };

        wsSchedule['!rows'] = wsSchedule['!rows'] || [];
        wsSchedule['!rows'][titleRowIndex] = { hpt: 28 };
        wsSchedule['!rows'][subtitleRowIndex] = { hpt: 18 };
        wsSchedule['!rows'][spacerRowIndex] = { hpt: 6 };

        wsSchedule['!merges'] = [
          { s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: totalColumns - 1 } },
          { s: { r: subtitleRowIndex, c: 0 }, e: { r: subtitleRowIndex, c: totalColumns - 1 } },
        ];
        yearSegments.forEach(segment => {
          if (segment.start <= segment.end) {
            wsSchedule['!merges'].push({
              s: { r: yearHeaderRowIndex, c: segment.start },
              e: { r: yearHeaderRowIndex, c: segment.end },
            });
          }
        });

        const titleCellRef = XLSX.utils.encode_cell({ r: titleRowIndex, c: 0 });
        if (wsSchedule[titleCellRef]) {
          wsSchedule[titleCellRef].s = {
            font: { sz: 16, bold: true, color: { rgb: '0F172A' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
        const subtitleCellRef = XLSX.utils.encode_cell({ r: subtitleRowIndex, c: 0 });
        if (wsSchedule[subtitleCellRef]) {
          wsSchedule[subtitleCellRef].s = {
            font: { sz: 10, color: { rgb: '475569' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }

        applyRowStyle(wsSchedule, yearHeaderRowIndex, totalColumns, excelSubHeaderStyle);
        applyRowStyle(wsSchedule, sectionHeaderRowIndex, totalColumns, excelHeaderStyle);

        const totalRows = scheduleData.length;
        const dataStartRow = sectionHeaderRowIndex + 2; // Excel row number
        for (let r = dataStartRow; r <= totalRows; r++) {
          const even = (r - dataStartRow) % 2 === 0;
          const rowData = scheduleData[r - 1] || [];
          const metaRow = dataRowMetas[r - dataStartRow] || [];
          for (let c = 0; c < totalColumns; c++) {
            const cellRef = XLSX.utils.encode_col(c) + r;
            if (!wsSchedule[cellRef]) {
              wsSchedule[cellRef] = { t: 's', v: '' };
            }

            let fillColor = even ? 'FFFFFF' : 'F8FAFC';
            if (c > 0) {
              const cellHighlight = metaRow[c];
              if (cellHighlight) {
                fillColor = cellHighlight;
              } else if (rowData[c]) {
                const columnMeta = sectionColumns[c - 1];
                if (columnMeta?.highlightColor) {
                  fillColor = columnMeta.highlightColor;
                }
              }
            }

            wsSchedule[cellRef].s = {
              fill: { fgColor: { rgb: fillColor } },
              border: {
                left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                right: { style: 'thin', color: { rgb: 'E5E7EB' } },
                top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
              },
              alignment: {
                horizontal: c === 0 ? 'center' : 'left',
                vertical: 'top',
                wrapText: true,
              },
              font: { color: { rgb: '0F172A' }, sz: c === 0 ? 9 : 10 },
            };
          }
        }

        XLSX.utils.book_append_sheet(wb, wsSchedule, course.shortName);
      }

      // ========== SECTIONS SHEET ==========
      const sectionsData = [['Section', 'Course', 'Year', 'Total Classes', 'Subjects', 'Rooms Used', 'Instructor']];
      
      allSections.forEach(section => {
        const sectionSchedules = allSchedules.filter(s => s.section === section.name);
        const subjects = [...new Set(sectionSchedules.map(s => s.subject).filter(Boolean))].join(', ');
        const roomsUsed = [...new Set(sectionSchedules.map(s => s.room).filter(Boolean))].join(', ');
        
        sectionsData.push([
          section.name || '',
          section.course ? courses.find(c => c.id === section.course.toLowerCase())?.shortName || section.course : '',
          section.year ? `${section.year}${section.year === 1 ? 'st' : section.year === 2 ? 'nd' : section.year === 3 ? 'rd' : 'th'} Year` : '',
          sectionSchedules.length,
          subjects || '-',
          roomsUsed || '-',
          `${instructorData.firstname} ${instructorData.lastname}`
        ]);
      });

      let sectionsColumnCount = sectionsData[0]?.length || 0;
      if (sectionsData.length > 0) {
        sectionsColumnCount = sectionsData[0].length;
        const introRows = buildSheetIntroRows('Sections Overview', `Generated: ${generatedLabel}`, sectionsColumnCount);
        sectionsData.unshift(introRows.spacerRow);
        sectionsData.unshift(introRows.subtitleRow);
        sectionsData.unshift(introRows.titleRow);
      }
      
      const wsSections = XLSX.utils.aoa_to_sheet(sectionsData);
      wsSections['!cols'] = calculateColumnWidths(wsSections, sectionsData, 12, 50);
      wsSections['!freeze'] = { xSplit: 0, ySplit: 4 };
      const sectionsLastCol = sectionsColumnCount > 0 ? XLSX.utils.encode_col(sectionsColumnCount - 1) : 'A';
      wsSections['!autofilter'] = { ref: `A4:${sectionsLastCol}${sectionsData.length}` };
      wsSections['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(sectionsColumnCount - 1, 0) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(sectionsColumnCount - 1, 0) } },
      ];
      wsSections['!rows'] = [
        { hpt: 26 },
        { hpt: 18 },
        { hpt: 6 },
      ];
      
      const sectionsTitleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (wsSections[sectionsTitleCell]) {
        wsSections[sectionsTitleCell].s = {
          font: { sz: 14, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      const sectionsSubtitleCell = XLSX.utils.encode_cell({ r: 1, c: 0 });
      if (wsSections[sectionsSubtitleCell]) {
        wsSections[sectionsSubtitleCell].s = {
          font: { sz: 10, color: { rgb: '475569' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      
      applyRowStyle(wsSections, 3, sectionsColumnCount, excelHeaderStyle);
      
      for (let r = 5; r <= sectionsData.length; r++) {
        const even = (r - 5) % 2 === 0;
        for (let c = 0; c < sectionsColumnCount; c++) {
          const cellRef = XLSX.utils.encode_col(c) + r;
          if (!wsSections[cellRef]) {
            wsSections[cellRef] = { t: 's', v: '' };
          }
          wsSections[cellRef].s = {
            fill: { fgColor: { rgb: even ? 'FFFFFF' : 'F8FAFC' } },
            border: {
              left: { style: 'thin', color: { rgb: 'E5E7EB' } },
              right: { style: 'thin', color: { rgb: 'E5E7EB' } },
              top: { style: 'thin', color: { rgb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            },
            alignment: { horizontal: c >= 4 ? 'left' : 'center', vertical: 'center', wrapText: true },
            font: { color: { rgb: '1E293B' }, sz: 11 },
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsSections, 'Sections');

      // ========== ROOM SHEET ==========
      const roomsData = [['Room', 'Area / Location', 'Status', 'Total Classes', 'Sections Using', 'Subjects Using']];
      
      rooms.forEach(room => {
        const roomSchedules = allSchedules.filter(s => s.room === (room.room || room.name));
        const sectionsUsing = [...new Set(roomSchedules.map(s => s.section).filter(Boolean))].join(', ');
        const subjectsUsing = [...new Set(roomSchedules.map(s => s.subject).filter(Boolean))].join(', ');
        
        roomsData.push([
          room.room || room.name || '-',
          room.area || room.location || '-',
          room.status || 'available',
          roomSchedules.length,
          sectionsUsing || '-',
          subjectsUsing || '-'
        ]);
      });

      let roomsColumnCount = roomsData[0]?.length || 0;
      if (roomsData.length > 0) {
        roomsColumnCount = roomsData[0].length;
        const introRows = buildSheetIntroRows('Rooms Utilization', `Generated: ${generatedLabel}`, roomsColumnCount);
        roomsData.unshift(introRows.spacerRow);
        roomsData.unshift(introRows.subtitleRow);
        roomsData.unshift(introRows.titleRow);
      }
      
      const wsRooms = XLSX.utils.aoa_to_sheet(roomsData);
      wsRooms['!cols'] = calculateColumnWidths(wsRooms, roomsData, 12, 50);
      wsRooms['!freeze'] = { xSplit: 0, ySplit: 4 };
      const roomsLastCol = roomsColumnCount > 0 ? XLSX.utils.encode_col(roomsColumnCount - 1) : 'A';
      wsRooms['!autofilter'] = { ref: `A4:${roomsLastCol}${roomsData.length}` };
      wsRooms['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(roomsColumnCount - 1, 0) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(roomsColumnCount - 1, 0) } },
      ];
      wsRooms['!rows'] = [
        { hpt: 26 },
        { hpt: 18 },
        { hpt: 6 },
      ];
      
      const roomsTitleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (wsRooms[roomsTitleCell]) {
        wsRooms[roomsTitleCell].s = {
          font: { sz: 14, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      const roomsSubtitleCell = XLSX.utils.encode_cell({ r: 1, c: 0 });
      if (wsRooms[roomsSubtitleCell]) {
        wsRooms[roomsSubtitleCell].s = {
          font: { sz: 10, color: { rgb: '475569' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      
      applyRowStyle(wsRooms, 3, roomsColumnCount, excelHeaderStyle);
      
      for (let r = 5; r <= roomsData.length; r++) {
        const even = (r - 5) % 2 === 0;
        for (let c = 0; c < roomsColumnCount; c++) {
          const cellRef = XLSX.utils.encode_col(c) + r;
          if (!wsRooms[cellRef]) {
            wsRooms[cellRef] = { t: 's', v: '' };
          }
          wsRooms[cellRef].s = {
            fill: { fgColor: { rgb: even ? 'FFFFFF' : 'F8FAFC' } },
            border: {
              left: { style: 'thin', color: { rgb: 'E5E7EB' } },
              right: { style: 'thin', color: { rgb: 'E5E7EB' } },
              top: { style: 'thin', color: { rgb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            },
            alignment: { horizontal: c >= 4 ? 'left' : 'center', vertical: 'center', wrapText: true },
            font: { color: { rgb: '1E293B' }, sz: 11 },
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsRooms, 'Room');

      // ========== INSTRUCTOR SHEET ==========
      const instructorsData = [['Name', 'Email', 'Department', 'Total Classes', 'Sections', 'Subjects', 'Rooms']];
      
      instructorsData.push([
        `${instructorData.firstname} ${instructorData.lastname}` || '-',
        instructorData.email || '-',
        instructorData.department || '-',
        allSchedules.length,
        [...new Set(allSchedules.map(s => s.section).filter(Boolean))].join(', ') || '-',
        [...new Set(allSchedules.map(s => s.subject).filter(Boolean))].join(', ') || '-',
        [...new Set(allSchedules.map(s => s.room).filter(Boolean))].join(', ') || '-'
      ]);

      let instructorsColumnCount = instructorsData[0]?.length || 0;
      if (instructorsData.length > 0) {
        instructorsColumnCount = instructorsData[0].length;
        const introRows = buildSheetIntroRows('Instructor Workload', `Generated: ${generatedLabel}`, instructorsColumnCount);
        instructorsData.unshift(introRows.spacerRow);
        instructorsData.unshift(introRows.subtitleRow);
        instructorsData.unshift(introRows.titleRow);
      }
      
      const wsInstructors = XLSX.utils.aoa_to_sheet(instructorsData);
      wsInstructors['!cols'] = calculateColumnWidths(wsInstructors, instructorsData, 12, 50);
      wsInstructors['!freeze'] = { xSplit: 0, ySplit: 4 };
      const instructorsLastCol = instructorsColumnCount > 0 ? XLSX.utils.encode_col(instructorsColumnCount - 1) : 'A';
      wsInstructors['!autofilter'] = { ref: `A4:${instructorsLastCol}${instructorsData.length}` };
      wsInstructors['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(instructorsColumnCount - 1, 0) } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(instructorsColumnCount - 1, 0) } },
      ];
      wsInstructors['!rows'] = [
        { hpt: 26 },
        { hpt: 18 },
        { hpt: 6 },
      ];
      
      const instructorsTitleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
      if (wsInstructors[instructorsTitleCell]) {
        wsInstructors[instructorsTitleCell].s = {
          font: { sz: 14, bold: true, color: { rgb: '0F172A' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      const instructorsSubtitleCell = XLSX.utils.encode_cell({ r: 1, c: 0 });
      if (wsInstructors[instructorsSubtitleCell]) {
        wsInstructors[instructorsSubtitleCell].s = {
          font: { sz: 10, color: { rgb: '475569' } },
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      }
      
      applyRowStyle(wsInstructors, 3, instructorsColumnCount, excelHeaderStyle);
      
      for (let r = 5; r <= instructorsData.length; r++) {
        const even = (r - 5) % 2 === 0;
        for (let c = 0; c < instructorsColumnCount; c++) {
          const cellRef = XLSX.utils.encode_col(c) + r;
          if (!wsInstructors[cellRef]) {
            wsInstructors[cellRef] = { t: 's', v: '' };
          }
          wsInstructors[cellRef].s = {
            fill: { fgColor: { rgb: even ? 'FFFFFF' : 'F8FAFC' } },
            border: {
              left: { style: 'thin', color: { rgb: 'E5E7EB' } },
              right: { style: 'thin', color: { rgb: 'E5E7EB' } },
              top: { style: 'thin', color: { rgb: 'E5E7EB' } },
              bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
            },
            alignment: { horizontal: c >= 4 ? 'left' : 'center', vertical: 'center', wrapText: true },
            font: { color: { rgb: '1E293B' }, sz: 11 },
          };
        }
      }
      
      XLSX.utils.book_append_sheet(wb, wsInstructors, 'Instructor');

      // Save the workbook
      const fileName = `Teaching_Schedule_${instructorData.firstname}_${instructorData.lastname}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    
    // Log the download activity
    logReportDownload('Excel');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel file. Please try again.');
    }
  };

  const displayedWeekdays = filterDay !== "All Days"
    ? weekDays.filter(day => day.key === filterDay)
    : weekDays;

  const skipSlots = {};
  displayedWeekdays.forEach(day => { skipSlots[day.key] = {}; });

  return (
    <div className="dashboard-container" style={{ display: "flex", height: "100vh" }}>
      <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <InstructorHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="dashboard-content" style={{ marginTop: '140px', background: '#fafafa' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '800', color: '#1f2937' }}>
            Class Reports
          </h2>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
            Teaching Reports & Schedules
            {instructorData.firstname && instructorData.lastname && ` - ${instructorData.firstname} ${instructorData.lastname}`}
            {instructorData.department && ` - ${instructorData.department}`}
            {instructorData.instructorId && ` - ID-${instructorData.instructorId}`}
          </p>
          {/* Action/Search Bar */}
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', background: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', borderRadius: 12, padding: '16px 20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setViewMode("cards")} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, border: 'none', background: viewMode==="cards" ? '#0f2c63' : '#e5e7eb', color: viewMode==="cards" ? 'white' : '#64748b', cursor: 'pointer', boxShadow: '0 2px 8px rgba(15, 44, 99, 0.1)', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { if (viewMode==="cards") e.currentTarget.style.background = '#1e3a72'; }} onMouseLeave={(e) => { if (viewMode==="cards") e.currentTarget.style.background = '#0f2c63'; }}>
                <FontAwesomeIcon icon={faCalendarAlt}/> Card View
          </button>
              <button onClick={() => setViewMode("grid")} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, border: 'none', background: viewMode==="grid" ? '#0f2c63' : '#e5e7eb', color: viewMode==="grid" ? 'white' : '#64748b', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 2px 8px rgba(15, 44, 99, 0.1)', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { if (viewMode==="grid") e.currentTarget.style.background = '#1e3a72'; }} onMouseLeave={(e) => { if (viewMode==="grid") e.currentTarget.style.background = '#0f2c63'; }}>
                <FontAwesomeIcon icon={faTable}/>
                Table View
          </button>
            </div>
            <button onClick={exportToPDF} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(220, 38, 38, 0.2)', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#b91c1c'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(220, 38, 38, 0.2)'; }}>
              <FontAwesomeIcon icon={faDownload}/>
              PDF
          </button>
            <button onClick={exportToExcel} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: '#0e7490', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(14, 116, 144, 0.2)', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#155e75'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 116, 144, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#0e7490'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(14, 116, 144, 0.2)'; }}>
              <FontAwesomeIcon icon={faDownload}/>
              Excel
          </button>
            <button onClick={() => window.open('/instructor/workload', '_blank')} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: '#8b5cf6', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.2)', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(139, 92, 246, 0.2)'; }}>
              <FontAwesomeIcon icon={faChartBar}/>
              Workload
          </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, flex: 1 }}>
              <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <FontAwesomeIcon icon={faSearch} style={{ position: "absolute", left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 16 }} />
                <input type="text" placeholder="Search subject, course, room, section..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '12px 12px 12px 38px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: 'white', transition: 'all 0.2s ease', outline: 'none', boxShadow: 'none', fontWeight: 600, color: '#24292f' }} />
        </div>
              <select value={filterDay} onChange={e => setFilterDay(e.target.value)} style={{ minWidth: 120, padding: '12px 12px 12px 20px', border: '2px solid #f97316', background: 'white', color: '#f97316', fontWeight: 700, borderRadius: 8, outline: 'none', fontSize: 14 }}>
                <option value="All Days">Filter: All Days</option>
                {weekDays.map(day => (
                <option key={day.key} value={day.key}>{day.label}</option>
              ))}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ minWidth: 130, padding: '12px 12px 12px 20px', border: '2px solid #0f2c63', background: 'white', color: '#0f2c63', fontWeight: 700, borderRadius: 8, outline: 'none', fontSize: 14 }}>
                <option value="All Years">Filter: All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
            </select>
          </div>
          </div>

          {/* === 4. Views Section === */}
          {loading ? (
            <div style={{ width: '100%', textAlign: 'center', padding: 60 }}>
              <FontAwesomeIcon icon={faClock} style={{ fontSize: 48, color: '#e5e7eb', marginBottom: 18 }} />
              <p style={{ fontWeight: 700, color: '#64748b', fontSize: 20 }}>Loading schedule data...</p>
        </div>
          ) : error ? (
            <div style={{ width: '100%', textAlign: 'center', padding: 50 }}>
              <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: 48, opacity: 0.5, marginBottom: 10, color: '#ef4444' }} />
              <p style={{ fontSize: 20, color: '#ef4444', fontWeight: 700 }}>Error loading schedule: {error}</p>
          </div>
          ) : (
            <>
              {viewMode === "cards" ? (
                <div style={{ display: 'flex', gap: 22, margin: '38px 0', padding: '0 36px 14px 36px', flexWrap: 'wrap' }}>
                  {weekDays.map(day => {
                    // expand day's classes:
                    const dayToken = day.key.toLowerCase();
                    const items = filteredSchedule.filter(s => normalizeDayTokens(s.day).includes(dayToken));
                return (
                      <div key={day.key} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 4px 18px #0f2c6334', flex: '1 1 280px', minWidth: 270, maxWidth: 320, minHeight: 236, display: 'flex', flexDirection: 'column', marginBottom: 8, border: `3px solid ${items.length ? '#f97316' : '#e5e7eb'}` }}>
                        <div style={{ background: '#0f2c63', color: '#fff', fontWeight: 800, fontSize: 18, padding: '14px 0 14px 0', textAlign: 'center', borderTopLeftRadius: 14, borderTopRightRadius: 14, letterSpacing: '.7px' }}>{day.label}</div>
                        <div style={{ padding: '22px 18px 10px 18px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: items.length ? 'flex-start' : 'center', alignItems:'stretch' }}>
                          {items.length === 0 ? (<div style={{ textAlign: 'center', fontSize: 15, color: '#cbd5e1', paddingTop: 32 }}>No classes</div>) : (
                            items.map((s, idx) => (
                              <div key={idx} style={{ background: '#f9fafc', borderRadius: 14, boxShadow: '0 1px 5px rgba(236, 240, 243, 0.1)', padding: '17px 11px 12px 14px', display: 'flex', flexDirection: 'column', gap: 7, borderLeft: '5px solid #f97316', position:'relative' }}>
                                <div style={{ fontWeight: 800, fontSize: 17, color: '#1e40af', marginBottom: 2 }}>{s.subject}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{
                                    background: '#0f2c63',
                                    color: 'white',
                                    fontWeight: 900,
                                    fontSize: 15,
                                    borderRadius: 18,
                                    padding: '4px 14px',
                                    boxShadow: '0 2px 6px #f973162a',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                          gap: 6,
                        }}>
                                    <FontAwesomeIcon icon={faClock} style={{ fontSize: 13, color: '#fff8' }} /> {s.timeDisplay || s.time}
                                  </span>
                        </div>
                                <div style={{ fontSize: 14, color: '#64748b', display: 'flex', gap: 7, alignItems: 'center' }}>
                                  <FontAwesomeIcon icon={faGraduationCap} style={{ fontSize: 12, color: '#fb923c' }} /> {`${(s.course || '').toUpperCase()} ${s.year}`} <span>‣</span> {s.section}
                                  <span style={{ margin: '0 2px', color: '#eab308' }}>&bull;</span>
                                  <FontAwesomeIcon icon={faDoorOpen} style={{ fontSize: 12, color: '#0f2c63' }} /> {s.room}
                    </div>
                  </div>
                            ))
                          )}
                            </div>
                          </div>
                        );
                  })}
            </div>
              ) : (
                <div style={{ padding: '36px 24px 24px 24px', maxWidth: 1600, margin: '0 auto', background: '#fff', borderRadius: 22, boxShadow: '0 8px 32px #0f2c6312', overflowX: 'auto' }}>
                  {/* Compute displayedWeekdays based on filterDay */}
                  <div style={{ display: 'grid', gridTemplateColumns: '120px repeat(' + displayedWeekdays.length + ', 1fr)', minWidth: 900 }}>
                    {/* Grid Header */}
                    <div style={{ background: '#0f2c63', color:'#fff', fontWeight:800, fontSize:16, textAlign: 'center', padding:'18px 0', letterSpacing:'0.7px', borderTopLeftRadius:14 }}>Time</div>
                    {displayedWeekdays.map((day,idx) => (
                      <div key={day.key} style={{ background: '#0f2c63', color:'#fff', fontWeight:800, fontSize:16, textAlign:'center', padding:'18px 0', borderTopRightRadius: idx===displayedWeekdays.length-1?14:0 }}>{day.label}</div>
                    ))}
                    {/* Grid Body */}
                    {timeSlots.map((slot, slotIndex) => {
                      const rowCells = [
                        <div key={'time-'+slotIndex} style={{padding:'13px 7px', fontWeight: 700, fontSize: 15, borderLeft:'3px solid #f97316', background:slotIndex%2===0?'#fff':'#f3f4f6', color:'#64748b', textAlign:'center', minHeight: 44, display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <FontAwesomeIcon icon={faClock} style={{marginRight:6,fontSize:13}}/> {slot}
                        </div>
                      ];
                      displayedWeekdays.forEach((day) => {
                        if (skipSlots[day.key][slotIndex]) {
                          // This slot was covered by a previous class's rowSpan block
                          return;
                        }
                        const dayToken = day.key.toLowerCase();
                        // Find if a schedule starts at this slot for this day
                        const scheduleStartHere = filteredSchedule.find((s) => {
                          const tokens = normalizeDayTokens(s.day);
                          const slotStartMin = timeStringToMinutes(slot.split('-')[0].trim());
                          return tokens.includes(dayToken)
                            && typeof s.startMinutes === 'number' && Math.floor(s.startMinutes/1) === slotStartMin;
                        });
                        if (scheduleStartHere) {
                          // Compute row span for this block (how many slots to merge)
                          const { startMinutes, endMinutes } = scheduleStartHere;
                          const step = TIME_SLOT_CONFIGS.DETAILED.duration || 30;
                          const startRounded = Math.floor(startMinutes/step)*step;
                          const endRounded = Math.ceil(endMinutes/step)*step;
                          const rowSpan = Math.max(1, Math.ceil((endRounded-startRounded)/step));
                          // Mark future slots to be skipped for this day
                          for(let skip = 1; skip<rowSpan; ++skip) {
                            skipSlots[day.key][slotIndex+skip]=true;
                          }
                          rowCells.push(
                            <div key={day.key+'-'+slotIndex} style={{
                              gridRow: `span ${rowSpan}`,
                              minHeight: 44*rowSpan, display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center', padding:'0px 4px',
                              background:'#0f2c63',
                              borderRadius:11, color:'#fff', fontWeight:800, fontSize:15, boxShadow:'0 4px 16px #0f2c6321', position:'relative', border: '2px solid #f97316', margin:'2px 3px'
                            }}>
                              <div style={{fontWeight:900, fontSize:15,marginBottom:2}}>{scheduleStartHere.subject}</div>
                              <div style={{fontSize:13,opacity:0.94, fontWeight:500}}>{scheduleStartHere.timeDisplay || scheduleStartHere.time}</div>
                              <div style={{marginTop:1, fontSize:12,display:'flex',alignItems:'center',gap:7}}>
                                <span style={{background:'#fff2',borderRadius:7,padding:'2.5px 8px',color:'#fffbbb',fontWeight:700}}>{`${(scheduleStartHere.course||'').toUpperCase()} ${scheduleStartHere.year}`}</span>
                                <span style={{fontStyle:'italic',marginLeft:6}}><FontAwesomeIcon icon={faDoorOpen}/> {scheduleStartHere.room}</span>
                                  </div>
                                </div>
                          );
                        } else {
                          rowCells.push(<div key={day.key+'-'+slotIndex} style={{minHeight:44, background:slotIndex%2===0?'#fff':'#f3f4f6', borderBottom:'1.5px solid #e5e7eb', borderRight:'1.5px solid #e5e7eb'}}/>);
                        }
                      });
                      return rowCells;
                    })}
            </div>
          </div>
        )}

              {/* === 5. Stat Bar === */}
              <div style={{ display: 'flex', gap: 30, justifyContent: 'center', margin: '6px 0 36px 0', padding: '12px 0', flexWrap: 'wrap' }}>
                {[{
                  val: filteredSchedule.length, label: 'Classes Shown', icon: faFileAlt, accent: '#f97316', bg: '#ffedd5'
                },{
                  val: new Set(filteredSchedule.map(s=>s.day)).size, label: 'Teaching Days', icon: faCalendarAlt, accent: '#0f2c63', bg: '#e0e7ef'
                },{
                  val: new Set(filteredSchedule.map(s=>s.subject)).size, label: 'Unique Subjects', icon: faSearch, accent: '#ea580c', bg: '#ffe4e6'
                },{
                  val: new Set(filteredSchedule.map(s=>s.room)).size, label: 'Rooms Used', icon: faDoorOpen, accent: '#174ea6', bg: '#fffbeb'
                }].map((s, i) => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120, background: s.bg, borderRadius: 14, boxShadow: '0 2px 8px #6b728014', padding: '17px 18px', gap: 4, border: `2.5px solid ${s.accent}` }}>
                    <FontAwesomeIcon icon={s.icon} style={{ color: s.accent, fontSize: 23, marginBottom: 3, opacity: 0.86 }} />
                    <div style={{ fontWeight: 800, fontSize: 23, color: s.accent }}>{s.val}</div>
                    <div style={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>{s.label}</div>
            </div>
                ))}
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default InstructorReports;
