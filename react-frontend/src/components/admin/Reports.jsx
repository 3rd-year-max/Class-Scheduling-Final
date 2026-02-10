import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartBar,
  faDownload,
  faGraduationCap,
  faCode,
} from '@fortawesome/free-solid-svg-icons';
import apiClient from '../../services/apiClient.js';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import XLSX from 'xlsx-js-style';
import { generateSystemBarcode, generateSystemBarcodeData } from '../../utils/barcodeGenerator.js';
import { generateDocumentId } from '../../services/documentService.js';

const Reports = () => {
  const [allSchedules, setAllSchedules] = useState([]); // All schedules for all years and courses
  const [allSections, setAllSections] = useState([]); // All sections
  const [instructors, setInstructors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  const courses = useMemo(() => [
    {
      id: 'bsit',
      name: 'BS Information Technology',
      shortName: 'BSIT',
      icon: faGraduationCap,
      gradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
    },
    {
      id: 'bsemc-dat',
      name: 'BS Entertainment and Multimedia Computing',
      shortName: 'BSEMC-DAT',
      icon: faCode,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    },
  ], []);

  const yearLevels = useMemo(() => [
    { id: '1styear', label: '1st Year', year: 1 },
    { id: '2ndyear', label: '2nd Year', year: 2 },
    { id: '3rdyear', label: '3rd Year', year: 3 },
    { id: '4thyear', label: '4th Year', year: 4 },
  ], []);

  // Fetch all data for comprehensive reports
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('📊 Reports: Fetching all data for comprehensive reports');
      
      // Fetch all schedules for all years and courses
      const schedulePromises = [];
      const sectionPromises = [];
      
      for (const course of courses) {
        for (const yearLevel of yearLevels) {
          schedulePromises.push(
            apiClient.get(`/api/schedule?course=${course.id}&year=${yearLevel.year}`)
          );
          sectionPromises.push(
            apiClient.get(`/api/sections?course=${course.id}&year=${yearLevel.year}`)
          );
        }
      }
      
      const [schedulesResults, sectionsResults, instructorsRes, roomsRes] = await Promise.all([
        Promise.all(schedulePromises),
        Promise.all(sectionPromises),
        apiClient.getInstructors(),
        apiClient.getRooms(),
      ]);

      // Combine all schedules
      const combinedSchedules = schedulesResults.flatMap(res => 
        Array.isArray(res.data) ? res.data : []
      );
      
      // Combine all sections
      const combinedSections = sectionsResults.flatMap(res => 
        Array.isArray(res.data) ? res.data : []
      ).sort((a, b) => a.name.localeCompare(b.name));

      setAllSchedules(combinedSchedules);
      setAllSections(combinedSections);
      setInstructors(Array.isArray(instructorsRes.data) ? instructorsRes.data : []);
      
      // Handle rooms
      if (Array.isArray(roomsRes.data)) {
        setRooms(roomsRes.data);
      } else if (Array.isArray(roomsRes.data?.rooms)) {
        setRooms(roomsRes.data.rooms);
      } else {
        setRooms([]);
      }
      
      console.log('📊 Reports: All data fetched. Schedules:', combinedSchedules.length, 'Sections:', combinedSections.length, 'Instructors:', instructorsRes.data?.length || 0, 'Rooms:', roomsRes.data?.length || 0);
    } catch (error) {
      console.error('📊 Reports: Error fetching all data:', error);
    } finally {
      setLoading(false);
    }
  }, [yearLevels, courses]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  

  const timeStringToMinutes = (timeStr) => {
    if (!timeStr) return -1;
    const cleanTime = timeStr.trim().split(' - ')[0];
    let [time, modifier] = cleanTime.split(' ');
    if (!modifier) return -1;
    let [h, m] = time.split(':').map(Number);
    if (modifier.toLowerCase() === 'pm' && h !== 12) h += 12;
    if (modifier.toLowerCase() === 'am' && h === 12) h = 0;
    return h * 60 + (m || 0);
  };

  // Excel header style
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
  const generateTimeSlots = () => {
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
  // This includes partial overlaps, so schedules ending at :30 will highlight the slot up to that :30 mark
  const timeOverlapsWithSlot = (scheduleTime, slot) => {
    if (!scheduleTime) return false;
    
    const timeParts = scheduleTime.split(' - ');
    if (timeParts.length !== 2) return false;
    
    const startTime = timeStringToMinutes(timeParts[0].trim());
    const endTime = timeStringToMinutes(timeParts[1].trim());
    
    if (startTime === -1 || endTime === -1) return false;
    
    // Check if schedule overlaps with slot (start before slot ends and end after slot starts)
    // This ensures schedules ending at :30 (like 7:00 - 9:30) will highlight slots up to 9:30
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

  // Unified Excel Export with multiple sheets
  const exportToExcel = async () => {
    const wb = XLSX.utils.book_new();
    const timeSlots = generateTimeSlots();
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

    // ========== SCHEDULE SHEETS (One per Department) ==========
    for (const course of courses) {
      const sectionColumns = [];

      // Collect sections per course/year first
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

      const totalColumns = 1 + sectionColumns.length; // Time + sections
      const scheduleData = [];
      const { titleRow, subtitleRow, spacerRow } = buildSheetIntroRows(
        `${course.name} Class Schedule`,
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
      const scheduleSlotMap = new Map(); // Map schedule key to array of slot indices it spans
      
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
              cellText = courseCode ? `${courseCode} - ${subject}` : subject;
            }
            // Second cell: Instructor
            else if (positionInSchedule === 1) {
              cellText = schedule.instructor || '';
            }
            // Third cell: Room
            else if (positionInSchedule === 2) {
              cellText = schedule.room || '';
            }
            // Remaining cells: blank but still highlighted
            // (cellText stays empty, but cellColor is set)
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
          // Highlight based on schedule overlap - highlight ALL cells that schedules span
          // This includes blank cells if they're within a schedule's time range
          if (c > 0) {
            const cellHighlight = metaRow[c];
            if (cellHighlight) {
              // Schedule overlaps with this time slot - use schedule color
              // This highlights even blank cells that are within the schedule's time range
              fillColor = cellHighlight;
            } else if (rowData[c]) {
              // No schedule overlap, but has text - use column default color
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
    const sectionsData = [['Section', 'Course', 'Year', 'Total Classes', 'Subjects', 'Rooms Used', 'Instructors']];
    
    allSections.forEach(section => {
      const sectionSchedules = allSchedules.filter(s => s.section === section.name);
      const subjects = [...new Set(sectionSchedules.map(s => s.subject).filter(Boolean))].join(', ');
      const rooms = [...new Set(sectionSchedules.map(s => s.room).filter(Boolean))].join(', ');
      const instructors = [...new Set(sectionSchedules.map(s => s.instructor).filter(Boolean))].join(', ');
      
      sectionsData.push([
        section.name || '',
        section.course ? courses.find(c => c.id === section.course.toLowerCase())?.shortName || section.course : '',
        section.year ? `${section.year}${section.year === 1 ? 'st' : section.year === 2 ? 'nd' : section.year === 3 ? 'rd' : 'th'} Year` : '',
        sectionSchedules.length,
        subjects || '-',
        rooms || '-',
        instructors || '-'
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
    // Calculate optimal column widths for sections sheet
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
    // Calculate optimal column widths for rooms sheet
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
    
    instructors.forEach(inst => {
      const email = (inst.email || '').toLowerCase();
      const fullName = (inst.firstname || inst.firstName || inst.name || '').toString().toLowerCase();
      const instSchedules = allSchedules.filter(s => {
        if (!s) return false;
        if (s.instructorEmail && String(s.instructorEmail).toLowerCase() === email && email) return true;
        if (s.instructor && String(s.instructor).toLowerCase().includes(fullName) && fullName) return true;
        return false;
      });

      const sections = [...new Set(instSchedules.map(s => s.section).filter(Boolean))].join(', ');
      const subjects = [...new Set(instSchedules.map(s => s.subject).filter(Boolean))].join(', ');
      const rooms = [...new Set(instSchedules.map(s => s.room).filter(Boolean))].join(', ');
      
      const instName = inst.firstname || inst.firstName || inst.name || `${inst.firstName || ''} ${inst.lastName || ''}`.trim();
      
      instructorsData.push([
        instName || '-',
        inst.email || inst.username || '-',
        inst.department || '-',
        instSchedules.length,
        sections || '-',
        subjects || '-',
        rooms || '-'
      ]);
    });

    let instructorsColumnCount = instructorsData[0]?.length || 0;
    if (instructorsData.length > 0) {
      instructorsColumnCount = instructorsData[0].length;
      const introRows = buildSheetIntroRows('Instructor Workload', `Generated: ${generatedLabel}`, instructorsColumnCount);
      instructorsData.unshift(introRows.spacerRow);
      instructorsData.unshift(introRows.subtitleRow);
      instructorsData.unshift(introRows.titleRow);
    }
    
    const wsInstructors = XLSX.utils.aoa_to_sheet(instructorsData);
    // Calculate optimal column widths for instructors sheet
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

    // Generate barcode data for system identification
    const barcodeData = generateSystemBarcodeData({
      reportType: 'Class Schedule Report (Excel)',
      generatedDate: new Date().toISOString(),
      additionalInfo: 'Multi-sheet comprehensive schedule report'
    });
    
    // Add footer rows to all sheets
    const addFooterToSheet = (ws, sheetName, totalRows, columnCount) => {
      const footerRow1 = new Array(columnCount).fill('');
      const footerRow2 = new Array(columnCount).fill('');
      const footerRow3 = new Array(columnCount).fill('');
      const footerRow4 = new Array(columnCount).fill('');
      
      footerRow1[0] = 'Class Scheduling System';
      footerRow2[0] = `Generated: ${new Date().toLocaleString()}`;
      footerRow3[0] = `Report: ${sheetName}`;
      footerRow4[0] = `System Barcode Data: ${barcodeData}`;
      
      // Add footer rows
      const footerStartRow = totalRows;
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
      
      // Style footer rows
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
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const newRange = XLSX.utils.encode_range({
        s: range.s,
        e: { r: footerStartRow + 3, c: range.e.c }
      });
      ws['!ref'] = newRange;
    };
    
    // Add footers to all sheets
    wb.SheetNames.forEach(sheetName => {
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const totalRows = range.e.r + 1;
      const columnCount = range.e.c + 1;
      addFooterToSheet(ws, sheetName, totalRows, columnCount);
    });

    // Save the workbook
    const fileName = `Class_Schedule_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Unified PDF Export with all data
  const exportToPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const headerColor = [15, 44, 99]; // #0f2c63
      let currentY = 0;
      
      // Generate document ID and barcode for document retrieval
      let barcodeDataURL = null;
      let documentId = null;
      
      try {
        // First generate a document ID for retrieval
        const docIdResponse = await generateDocumentId({
          documentType: 'admin-report',
          reportType: 'Class Schedule Report',
          filters: {
            viewMode: 'all',
            selectedCourse: 'all',
            selectedYearLevel: 'all',
            selectedDepartment: 'all',
            selectedRoom: 'all',
            selectedInstructor: 'all',
            selectedTimeSlot: 'all'
          },
          generatedBy: 'Administrator'
        });

        if (docIdResponse.success) {
          documentId = docIdResponse.data.documentId;
          console.log('Generated document ID:', documentId);
        } else {
          console.warn('Document ID generation failed:', docIdResponse.error);
        }
        
        // Generate barcode (with or without document ID)
        barcodeDataURL = generateSystemBarcode({
          documentId: documentId,
          reportType: 'Class Schedule Report',
          generatedDate: new Date().toISOString(),
          additionalInfo: 'Comprehensive schedule report with all departments and year levels'
        }, 50);
        
        console.log('Generated barcode:', barcodeDataURL ? 'Success' : 'Failed');
      } catch (barcodeError) {
        console.warn('Barcode generation failed, continuing without barcode:', barcodeError);
      }

    // Helper function to add page header
    const addPageHeader = (title, subtitle = '') => {
    doc.setFillColor(...headerColor);
      doc.rect(0, currentY, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
      doc.text(title, margin, currentY + 18);
      if (subtitle) {
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
        doc.text(subtitle, margin, currentY + 26);
      }
    doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, currentY + 26, { align: 'right' });
      currentY = currentY + 45;
    };

    // ========== SCHEDULE SECTION ==========
    addPageHeader('CLASS SCHEDULE REPORT', 'All Schedules by Year and Department');
    
    // Organize schedules by year and department
    const dayOrder = { 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
    
    for (const yearLevel of yearLevels) {
      for (const course of courses) {
        const yearSchedules = allSchedules.filter(s => {
          const schedYear = String(s.year || '').trim();
          const schedCourse = String(s.course || '').toLowerCase().trim();
          return schedYear === String(yearLevel.year) && schedCourse === course.id;
        });
        
        if (yearSchedules.length > 0) {
          // Check if we need a new page
          if (currentY > 250) {
            doc.addPage();
            currentY = 0;
            addPageHeader('CLASS SCHEDULE REPORT (Continued)', `${yearLevel.label} - ${course.shortName}`);
          }
          
          // Section header
          doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
          doc.setTextColor(15, 44, 99);
          doc.text(`${yearLevel.label} - ${course.shortName}`, margin, currentY);
          currentY += 8;
          
          // Sort schedules
          yearSchedules.sort((a, b) => {
            const sectionCompare = (a.section || '').localeCompare(b.section || '');
            if (sectionCompare !== 0) return sectionCompare;
            
            const aDays = (a.day || '').toLowerCase().split('/');
            const bDays = (b.day || '').toLowerCase().split('/');
            const aDay = aDays[0]?.trim() || '';
            const bDay = bDays[0]?.trim() || '';
            const aDayOrder = dayOrder[aDay] || 99;
            const bDayOrder = dayOrder[bDay] || 99;
            if (aDayOrder !== bDayOrder) return aDayOrder - bDayOrder;
            
            const aTime = timeStringToMinutes((a.time || '').split(' - ')[0]);
            const bTime = timeStringToMinutes((b.time || '').split(' - ')[0]);
            return aTime - bTime;
          });
          
          const tableData = yearSchedules.map(schedule => [
            schedule.section || '',
            (schedule.day || '').replace(/\//g, ', '),
            schedule.time || '',
            schedule.subject || '',
            schedule.instructor || '',
            schedule.room || ''
          ]);
          
    doc.autoTable({
            startY: currentY,
            head: [['Section', 'Day', 'Time', 'Subject', 'Instructor', 'Room']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
              fontSize: 9,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
      },
    });

          currentY = doc.lastAutoTable.finalY + 15;
        }
      }
    }

    // ========== SECTIONS SECTION ==========
    doc.addPage();
    currentY = 0;
    addPageHeader('SECTIONS REPORT', 'All Sections Overview');
    
    const sectionsTableData = allSections.map(section => {
      const sectionSchedules = allSchedules.filter(s => s.section === section.name);
      const subjects = [...new Set(sectionSchedules.map(s => s.subject).filter(Boolean))].join(', ');
      const rooms = [...new Set(sectionSchedules.map(s => s.room).filter(Boolean))].join(', ');
      const instructors = [...new Set(sectionSchedules.map(s => s.instructor).filter(Boolean))].join(', ');
      
      return [
        section.name || '',
        section.course ? courses.find(c => c.id === section.course.toLowerCase())?.shortName || section.course : '',
        section.year ? `${section.year}${section.year === 1 ? 'st' : section.year === 2 ? 'nd' : section.year === 3 ? 'rd' : 'th'} Year` : '',
        sectionSchedules.length,
        subjects || '-',
        rooms || '-',
        instructors || '-'
      ];
    });

    doc.autoTable({
      startY: currentY,
      head: [['Section', 'Course', 'Year', 'Total Classes', 'Subjects', 'Rooms Used', 'Instructors']],
      body: sectionsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
      },
    });

    // ========== ROOMS SECTION ==========
    doc.addPage();
    currentY = 0;
    addPageHeader('ROOMS REPORT', 'All Available Facilities');
    
    const roomsTableData = rooms.map(room => {
      const roomSchedules = allSchedules.filter(s => s.room === (room.room || room.name));
      const sectionsUsing = [...new Set(roomSchedules.map(s => s.section).filter(Boolean))].join(', ');
      const subjectsUsing = [...new Set(roomSchedules.map(s => s.subject).filter(Boolean))].join(', ');
      
      return [
        room.room || room.name || '-',
        room.area || room.location || '-',
        room.status || 'available',
        roomSchedules.length,
        sectionsUsing || '-',
        subjectsUsing || '-'
      ];
    });
    
    doc.autoTable({
      startY: currentY,
      head: [['Room', 'Area / Location', 'Status', 'Total Classes', 'Sections Using', 'Subjects Using']],
      body: roomsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
      },
    });

    // ========== INSTRUCTORS SECTION ==========
    doc.addPage();
    currentY = 0;
    addPageHeader('INSTRUCTORS REPORT', 'All Instructors Overview');
    
    const instructorsTableData = instructors.map(inst => {
      const email = (inst.email || '').toLowerCase();
      const fullName = (inst.firstname || inst.firstName || inst.name || '').toString().toLowerCase();
      const instSchedules = allSchedules.filter(s => {
        if (!s) return false;
        if (s.instructorEmail && String(s.instructorEmail).toLowerCase() === email && email) return true;
        if (s.instructor && String(s.instructor).toLowerCase().includes(fullName) && fullName) return true;
        return false;
      });
      
      const sections = [...new Set(instSchedules.map(s => s.section).filter(Boolean))].join(', ');
      const subjects = [...new Set(instSchedules.map(s => s.subject).filter(Boolean))].join(', ');
      const rooms = [...new Set(instSchedules.map(s => s.room).filter(Boolean))].join(', ');
      const instName = inst.firstname || inst.firstName || inst.name || `${inst.firstName || ''} ${inst.lastName || ''}`.trim();
      
      return [
        instName || '-',
        inst.email || inst.username || '-',
        inst.department || '-',
        instSchedules.length,
        sections || '-',
        subjects || '-',
        rooms || '-'
      ];
    });

    doc.autoTable({
      startY: currentY,
      head: [['Name', 'Email', 'Department', 'Total Classes', 'Sections', 'Subjects', 'Rooms']],
      body: instructorsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [30, 41, 59],
        fontSize: 8,
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: [229, 231, 235],
        lineWidth: 0.5,
      },
    });

    // Add footers and barcodes to all pages
    const totalPages = doc.internal.pages.length - 1;
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 8;
    const barcodeWidth = 45; // barcode width in mm
    const barcodeHeight = 12; // barcode height in mm
    
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      
      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      // Add barcode on the left side of footer (first page only)
      if (i === 1 && barcodeDataURL) {
        try {
          doc.addImage(barcodeDataURL, 'PNG', margin, footerY - barcodeHeight - 2, barcodeWidth, barcodeHeight);
          doc.setFontSize(6);
          doc.text('System Verified', margin + barcodeWidth / 2, footerY - barcodeHeight - 4, { align: 'center' });
        } catch (error) {
          console.error('Error adding barcode to PDF:', error);
        }
      }
      
      // Left footer: System name (with space for barcode on first page)
      const leftMargin = (i === 1 && barcodeDataURL) ? margin + barcodeWidth + 3 : margin;
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

      // Save the PDF
      const fileName = `Class_Schedule_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };
  



  return (
    <div className="dashboard-container" style={{ display: 'flex', height: '100vh', background: '#fafafa' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#fafafa' }}>
        <Header title="Reports" />
        <div className="dashboard-content" style={{ marginTop: '140px', background: '#fafafa' }}>

          <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>Class Schedule Reports</h2>
          <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>Export comprehensive reports including schedules, sections, rooms, and instructors</p>
          {/* Export Section */}
          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              color: '#64748b',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              border: '1px solid rgba(15, 44, 99, 0.1)'
            }}>
              Loading reports...
            </div>
          ) : (
            <div
              style={{
                background: '#ffffff',
                padding: '32px',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                borderLeft: '4px solid #f97316',
                textAlign: 'center',
                border: '1px solid rgba(15, 44, 99, 0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: '#f97316',
              }} />
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#0f2c63', 
                marginBottom: '10px'
              }}>
                Export Reports
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px', fontWeight: '500' }}>
                Export comprehensive reports including all schedules (1st-4th year, all departments), sections, rooms, and instructors
              </p>
              
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={exportToExcel}
                  style={{
                    padding: '14px 28px',
                    background: '#0e7490',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(14, 116, 144, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.background = '#155e75';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(14, 116, 144, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = '#0e7490';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 116, 144, 0.2)';
                  }}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Export as Excel
                </button>
                <button
                  onClick={exportToPDF}
                  style={{
                    padding: '14px 28px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.background = '#b91c1c';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
                  }}
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Export as PDF
                </button>
              </div>
              
              <div style={{ 
                marginTop: '28px', 
                padding: '20px', 
                background: '#f8fafc', 
                borderRadius: '12px', 
                textAlign: 'left',
                border: '1px solid rgba(15, 44, 99, 0.1)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
              }}>
                <h4 style={{ 
                  fontSize: '15px', 
                  fontWeight: '700', 
                  color: '#1e293b', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FontAwesomeIcon icon={faChartBar} style={{ fontSize: '16px', color: '#0f2c63' }} />
                  Excel Export Includes:
                </h4>
                <ul style={{ margin: 0, paddingLeft: '24px', color: '#64748b', lineHeight: '1.8', fontSize: '13px' }}>
                  <li style={{ marginBottom: '8px' }}><strong style={{ color: '#1e293b' }}>Schedule Sheet:</strong> All schedules from 1st to 4th year, organized by departments (BSIT, BSEMC-DAT)</li>
                  <li style={{ marginBottom: '8px' }}><strong style={{ color: '#1e293b' }}>Sections Sheet:</strong> All sections with their details</li>
                  <li style={{ marginBottom: '8px' }}><strong style={{ color: '#1e293b' }}>Room Sheet:</strong> All rooms with usage statistics</li>
                  <li><strong style={{ color: '#1e293b' }}>Instructor Sheet:</strong> All instructors with their schedules</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Reports;
