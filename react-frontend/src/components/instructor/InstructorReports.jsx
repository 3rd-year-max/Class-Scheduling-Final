import React, { useState, useEffect, useContext, useCallback, useMemo } from "react";
import InstructorSidebar from "../common/InstructorSidebar.jsx";
import InstructorHeader from "../common/InstructorHeader.jsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload, faFileAlt, faCalendarAlt, faClock, faUser,
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

const InstructorReports = () => {
  const { userEmail } = useContext(AuthContext);
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
  const [filteredSchedule, setFilteredSchedule] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or table

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

    // Sorting
    filtered = sortSchedule(filtered, sortConfig.key, sortConfig.direction);
    setFilteredSchedule(filtered);
  }, [instructorSchedule, searchTerm, filterDay, sortConfig, sortSchedule, scheduleIncludesDay]);

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

  // Download CSV report
  const downloadReport = () => {
    const properLabel = {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    };
    // Expand multi-day entries into separate rows with full labels
    const expanded = [];
    filteredSchedule.forEach((s) => {
      const days = normalizeDayTokens(s.day);
      if (days.length === 0) {
        expanded.push({ ...s, day: s.day });
      } else {
        days.forEach((d) => expanded.push({ ...s, day: properLabel[d] || s.day }));
      }
    });
    const reportData = expanded.map((schedule) => ({
      Day: schedule.day,
      Time: schedule.timeDisplay || schedule.time,
      Subject: schedule.subject,
      Course: schedule.course + " " + schedule.year,
      Section: schedule.section,
      Room: schedule.room,
    }));
    const csvContent = [
      ["Day", "Time", "Subject", "Course", "Section", "Room"],
      ...reportData.map((row) => [
        row.Day, row.Time, row.Subject, row.Course, row.Section, row.Room,
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${instructorData.firstname}${instructorData.lastname}ScheduleReport.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log the download activity
    logReportDownload('CSV');
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

  // Excel Export
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Prepare data
    const expanded = expandScheduleDays();
    const sortedSchedules = [...expanded].sort((a, b) => {
      const dayOrder = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 7 };
      const aDay = (a.day || '').toLowerCase();
      const bDay = (b.day || '').toLowerCase();
      const aDayOrder = dayOrder[aDay] || 99;
      const bDayOrder = dayOrder[bDay] || 99;
      
      if (aDayOrder !== bDayOrder) {
        return aDayOrder - bDayOrder;
      }
      
      const aTime = timeStringToMinutes((a.time || '').split(' - ')[0]);
      const bTime = timeStringToMinutes((b.time || '').split(' - ')[0]);
      return aTime - bTime;
    });

    // Summary sheet
    const summaryData = [
      ['Teaching Schedule Report'],
      ['Instructor Name', `${instructorData.firstname} ${instructorData.lastname}`],
      ['Instructor ID', instructorData.instructorId || 'N/A'],
      ['Department', instructorData.department || 'N/A'],
      ['Email', instructorData.email || 'N/A'],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Summary'],
      ['Total Classes', filteredSchedule.length],
      ['Teaching Days', new Set(filteredSchedule.map(s => s.day)).size],
      ['Unique Subjects', new Set(filteredSchedule.map(s => s.subject)).size],
      ['Rooms Used', new Set(filteredSchedule.map(s => s.room)).size],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },
    ];
    wsSummary['A1'].s = { font: { bold: true, sz: 18 }, alignment: { horizontal: 'center' } };
    wsSummary['A8'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Schedule sheet
    const scheduleData = [
      ['Day', 'Time', 'Subject', 'Course', 'Year', 'Section', 'Room'],
      ...sortedSchedules.map(s => [
        s.day || '',
        s.timeDisplay || s.time || '',
        s.subject || '',
        s.course || '',
        s.year || '',
        s.section || '',
        s.room || ''
      ]),
    ];
    const wsSchedule = XLSX.utils.aoa_to_sheet(scheduleData);
    wsSchedule['!cols'] = [
      { wch: 15 }, // Day
      { wch: 20 }, // Time
      { wch: 40 }, // Subject
      { wch: 20 }, // Course
      { wch: 12 }, // Year
      { wch: 15 }, // Section
      { wch: 15 }, // Room
    ];
    
    // Style header row
    const headerRange = XLSX.utils.decode_range(wsSchedule['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!wsSchedule[cellAddress]) continue;
      wsSchedule[cellAddress].s = {
        fill: { fgColor: { rgb: "0f2c63" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }

    // Style data rows (zebra striping)
    for (let r = 1; r <= sortedSchedules.length; r++) {
      const even = (r % 2) === 0;
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c: col });
        if (wsSchedule[cellAddress]) {
          wsSchedule[cellAddress].s = {
            fill: { fgColor: { rgb: even ? "FFFFFF" : "F8FAFC" } },
            border: {
              left: { style: 'thin', color: { rgb: "E5E7EB" } },
              right: { style: 'thin', color: { rgb: "E5E7EB" } },
              top: { style: 'thin', color: { rgb: "E5E7EB" } },
              bottom: { style: 'thin', color: { rgb: "E5E7EB" } },
            },
            alignment: { vertical: "center" },
          };
        }
      }
    }

    wsSchedule['!freeze'] = { xSplit: 0, ySplit: 1 };
    wsSchedule['!autofilter'] = { ref: `A1:G${sortedSchedules.length + 1}` };
    XLSX.utils.book_append_sheet(wb, wsSchedule, 'Schedule');

    // Save file
    XLSX.writeFile(wb, `Teaching_Schedule_${instructorData.firstname}_${instructorData.lastname}.xlsx`);
    
    // Log the download activity
    logReportDownload('Excel');
  };

  const displayedWeekdays = filterDay !== "All Days"
    ? weekDays.filter(day => day.key === filterDay)
    : weekDays;

  const skipSlots = {};
  displayedWeekdays.forEach(day => { skipSlots[day.key] = {}; });

  return (
    <div className="dashboard-container" style={{ display: "flex", height: "100vh" }}>
      <InstructorSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <InstructorHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <div className="dashboard-content" style={{ marginTop: '140px' }}>
          {/* Welcome Section */}
          <div className="welcome-section" style={{ 
            marginBottom: '24px',
            background: 'linear-gradient(135deg, #0f2c63 0%, #1e3a72 20%, #2d4a81 40%, #ea580c 70%, #f97316 100%)',
            borderRadius: '16px',
            padding: '20px 24px',
            boxShadow: '0 10px 40px rgba(15, 44, 99, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
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
                <FontAwesomeIcon icon={faFileAlt} style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <h2 style={{ 
                margin: 0, 
                color: '#ffffff', 
                fontSize: '24px', 
                fontWeight: '800',
                textShadow: '0 2px 8px rgba(0,0,0,0.2)',
                letterSpacing: '-0.3px'
              }}>
                Class Reports
              </h2>
            </div>
            <p style={{ 
              margin: '0 0 16px 0', 
              color: 'rgba(255,255,255,0.95)', 
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Teaching Reports & Schedules
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', 
                background: 'rgba(255, 255, 255, 0.25)', 
                backdropFilter: 'blur(8px)',
                borderRadius: 8, 
                color: "#fff", 
                fontWeight: 700, 
                fontSize: 13, 
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: 13 }} />
                {instructorData.firstname} {instructorData.lastname}
              </div>
              {instructorData.department && (
                <div style={{ 
                  padding: '6px 12px', 
                  background: 'rgba(255, 255, 255, 0.25)', 
                  backdropFilter: 'blur(8px)',
                  borderRadius: 8, 
                  color: '#fff', 
                  fontWeight: 700, 
                  fontSize: 12, 
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}>
                  {instructorData.department}
                </div>
              )}
              {instructorData.instructorId && (
                <span style={{ 
                  padding: "6px 12px", 
                  background: "rgba(255, 255, 255, 0.25)", 
                  backdropFilter: 'blur(8px)',
                  color: "#fff", 
                  borderRadius: 8, 
                  fontSize: 12, 
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}>
                  ID-{instructorData.instructorId}
                </span>
              )}
            </div>
          </div>

          {/* Action/Search Bar */}
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', background: '#fff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', borderRadius: 12, padding: '16px 20px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setViewMode("cards")} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, border: 'none', background: viewMode==="cards" ? 'linear-gradient(100deg,#0f2c63,#f97316)' : '#e5e7eb', color: viewMode==="cards" ? 'white' : '#64748b', cursor: 'pointer', boxShadow: '0 2px 8px #0f2c6321', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}>
                <FontAwesomeIcon icon={faCalendarAlt}/> Card View
          </button>
              <button onClick={() => setViewMode("grid")} style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700, border: 'none', background: viewMode==="grid" ? 'linear-gradient(100deg,#0f2c63,#f97316)' : '#e5e7eb', color: viewMode==="grid" ? 'white' : '#64748b', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 2px 8px #0f2c6321' }}>
                <FontAwesomeIcon icon={faTable}/>
                Table View
          </button>
            </div>
            <button onClick={exportToPDF} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: 'linear-gradient(100deg,#dc2626,#ef4444)', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(220, 38, 38, 0.3)' }}>
              <FontAwesomeIcon icon={faDownload}/>
              PDF
          </button>
            <button onClick={exportToExcel} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: 'linear-gradient(100deg,#22d3ee,#0e7490)', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(34, 211, 238, 0.3)' }}>
              <FontAwesomeIcon icon={faDownload}/>
              Excel
          </button>
            <button onClick={() => window.open('/instructor/workload', '_blank')} style={{ padding: '10px 17px', borderRadius: 10, fontWeight: 700, border: 'none', background: 'linear-gradient(100deg,#8b5cf6,#6d28d9)', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)' }}>
              <FontAwesomeIcon icon={faChartBar}/>
              Workload
          </button>
            <button onClick={downloadReport} style={{ padding: '10px 19px', borderRadius: 10, fontWeight: 700, border: 'none', background: 'linear-gradient(100deg,#0f2c63,#1e40af)', color: 'white', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 2px 10px #1e40af33' }}>
              <FontAwesomeIcon icon={faDownload}/>
            Download CSV
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
                        <div style={{ background: 'linear-gradient(120deg, #0f2c63 40%, #f97316 100%)', color: '#fff', fontWeight: 800, fontSize: 18, padding: '14px 0 14px 0', textAlign: 'center', borderTopLeftRadius: 14, borderTopRightRadius: 14, letterSpacing: '.7px' }}>{day.label}</div>
                        <div style={{ padding: '22px 18px 10px 18px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: items.length ? 'flex-start' : 'center', alignItems:'stretch' }}>
                          {items.length === 0 ? (<div style={{ textAlign: 'center', fontSize: 15, color: '#cbd5e1', paddingTop: 32 }}>No classes</div>) : (
                            items.map((s, idx) => (
                              <div key={idx} style={{ background: 'linear-gradient(120deg,#f9fafc 80%,#fff0)', borderRadius: 14, boxShadow: '0 1px 5px #ecf0f311', padding: '17px 11px 12px 14px', display: 'flex', flexDirection: 'column', gap: 7, borderLeft: '5px solid #f97316', position:'relative' }}>
                                <div style={{ fontWeight: 800, fontSize: 17, color: '#1e40af', marginBottom: 2 }}>{s.subject}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <span style={{
                                    background: 'linear-gradient(90deg, #0f2c63 0%, #f97316 100%)',
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
                    <div style={{ background: 'linear-gradient(120deg,#0f2c63,#f97316 85%)', color:'#fff', fontWeight:800, fontSize:16, textAlign: 'center', padding:'18px 0', letterSpacing:'0.7px', borderTopLeftRadius:14 }}>Time</div>
                    {displayedWeekdays.map((day,idx) => (
                      <div key={day.key} style={{ background: 'linear-gradient(120deg,#0f2c63,#f97316 85%)', color:'#fff', fontWeight:800, fontSize:16, textAlign:'center', padding:'18px 0', borderTopRightRadius: idx===displayedWeekdays.length-1?14:0 }}>{day.label}</div>
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
                              background:'linear-gradient(120deg,#0f2c63 60%,#f97316 100%)',
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
