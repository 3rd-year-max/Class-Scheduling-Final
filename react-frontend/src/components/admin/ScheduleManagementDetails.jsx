import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faCalendarPlus,
  faCalendarAlt,
  faGraduationCap,
  faCode,
  faTimes,
  faExclamationCircle,
  faClock,
  faUser,
  faDoorOpen,
  faFileAlt,
  faEdit,
  faArchive
} from '@fortawesome/free-solid-svg-icons';
import apiClient from '../../services/apiClient.js';
import { generateTimeSlots, TIME_SLOT_CONFIGS, timeRangesOverlap, getTimeRangeDuration, minutesToTimeString, timeStringToMinutes } from '../../utils/timeUtils.js';
import { normalizeRoomName, formatRoomLabel } from '../../utils/roomUtils';
import Sidebar from '../common/Sidebar.jsx';
import Header from '../common/Header.jsx';
import { useToast } from '../common/ToastProvider.jsx';
import ConfirmationDialog from '../common/ConfirmationDialog.jsx';
import ConflictResolutionModal from './ConflictResolutionModal.jsx';

// ============== SCHEDULE VALIDATION UTILITIES ==============
const parseTime = (timeStr) => {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  
  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
};

const doTimesOverlap = (start1, end1, start2, end2) => {
  const s1 = parseTime(start1);
  const e1 = parseTime(end1);
  const s2 = parseTime(start2);
  const e2 = parseTime(end2);
  
  if (s1 === null || e1 === null || s2 === null || e2 === null) {
    return false;
  }
  
  return s1 < e2 && s2 < e1;
};

const doDaysOverlap = (day1, day2) => {
  const normalize = (day) => day.trim().toLowerCase();
  const d1 = normalize(day1);
  const d2 = normalize(day2);
  
  if (d1 === d2) return true;
  
  const days1 = d1.includes('/') ? d1.split('/') : [d1];
  const days2 = d2.includes('/') ? d2.split('/') : [d2];
  
  return days1.some(day => days2.includes(day));
};

// Shared room normalization/format helpers imported from utils

// ============== INSTRUCTOR SESSION VALIDATION ==============
const categorizeTimeOfDay = (timeStr) => {
  const time = parseTime(timeStr);
  if (time === null) return null;
  const lunchStart = 12 * 60; // 12:00 PM
  const lunchEnd = 13 * 60;   // 1:00 PM
  if (time < lunchStart) return 'morning';
  if (time >= lunchEnd) return 'afternoon';
  return 'lunch';
};

const checkInstructorSessionLimit = (newSchedule, existingSchedules, instructorName) => {
  const [newStart, newEnd] = newSchedule.time.split(' - ').map(t => t.trim());
  const newStartMin = parseTime(newStart);
  const newEndMin = parseTime(newEnd);
  const lunchStart = 12 * 60; // 12:00 PM
  const lunchEnd = 13 * 60;   // 1:00 PM

  // Enforce 1-hour lunch break (no overlap with 12:00–1:00)
  if (newStartMin < lunchEnd && newEndMin > lunchStart) {
    return { valid: false, message: 'Schedule conflicts with mandatory lunch break (12:00 PM - 1:00 PM)' };
  }

  // Gather instructor's sessions for the same day
  const sameDaySessions = existingSchedules.filter(sched =>
    sched.instructor === instructorName && doDaysOverlap(newSchedule.day, sched.day)
  );

  // Compute period counts (by start time)
  const countByPeriod = (sessions) => sessions.reduce((acc, sched) => {
    const [s] = sched.time.split(' - ').map(t => t.trim());
    const p = categorizeTimeOfDay(s);
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const currentCounts = countByPeriod(sameDaySessions);
  const newPeriod = categorizeTimeOfDay(newStart);

  // Max subjects per period: morning 2, afternoon-evening 3
  if (newPeriod === 'morning' && (currentCounts.morning || 0) >= 2) {
    return { valid: false, message: `${instructorName} already has 2 classes in the morning on ${newSchedule.day}.` };
  }
  if (newPeriod === 'afternoon' && (currentCounts.afternoon || 0) >= 3) {
    return { valid: false, message: `${instructorName} already has 3 classes in the afternoon/evening on ${newSchedule.day}.` };
  }

  // Build list including the new session
  const allSessions = [...sameDaySessions, { time: newSchedule.time }]
    .map(s => {
      const [sStart, sEnd] = s.time.split(' - ').map(t => t.trim());
      return { startMin: parseTime(sStart), endMin: parseTime(sEnd), period: categorizeTimeOfDay(sStart) };
    })
    .filter(s => s.startMin != null && s.endMin != null)
    .sort((a, b) => a.startMin - b.startMin);

  // Limit total classes per day to 5 (2 morning + 3 afternoon)
  if (allSessions.length > 5) {
    return { valid: false, message: `${instructorName} has reached the daily limit of 5 classes for ${newSchedule.day}.` };
  }

  // Enforce max 2 consecutive classes per period (back-to-back within the same period)
  const checkConsecutive = (period) => {
    let run = 1; let lastEnd = null;
    for (const s of allSessions.filter(x => x.period === period)) {
      if (lastEnd === null) { lastEnd = s.endMin; continue; }
      if (s.startMin === lastEnd) {
        run += 1;
        if (run > 2) return false;
      } else {
        run = 1;
      }
      lastEnd = s.endMin;
    }
    return true;
  };
  if (!checkConsecutive('morning')) {
    return { valid: false, message: `${instructorName} cannot have more than 2 consecutive morning classes on ${newSchedule.day}.` };
  }
  if (!checkConsecutive('afternoon')) {
    return { valid: false, message: `${instructorName} cannot have more than 2 consecutive afternoon classes on ${newSchedule.day}.` };
  }

  // Enforce "free time" after 4 classes: require 60 minutes free after the 4th before a 5th can start
  const prevSessions = sameDaySessions
    .map(s => {
      const [sStart, sEnd] = s.time.split(' - ').map(t => t.trim());
      return { startMin: parseTime(sStart), endMin: parseTime(sEnd) };
    })
    .filter(s => s.startMin != null && s.endMin != null)
    .sort((a, b) => a.startMin - b.startMin);

  if (prevSessions.length >= 4) {
    const lastPrevEnd = Math.max(...prevSessions.map(s => s.endMin));
    if (newStartMin < lastPrevEnd + 60) {
      return { valid: false, message: `${instructorName} must have a 1-hour free time after the 4th class before scheduling another class on ${newSchedule.day}.` };
    }
  }

  return { valid: true };
};
// ============== END INSTRUCTOR SESSION VALIDATION ==============

const checkScheduleConflicts = (newSchedule, existingSchedules) => {
  const conflicts = {
    instructor: [],
    room: [],
    section: []
  };
  
  const [newStart, newEnd] = newSchedule.time.split(' - ').map(t => t.trim());
  
  existingSchedules.forEach(schedule => {
    if (!doDaysOverlap(newSchedule.day, schedule.day)) {
      return;
    }
    
    const [schedStart, schedEnd] = schedule.time.split(' - ').map(t => t.trim());
    
    if (!doTimesOverlap(newStart, newEnd, schedStart, schedEnd)) {
      return;
    }
    
    if (newSchedule.instructor === schedule.instructor) {
      conflicts.instructor.push({
        subject: schedule.subject,
        section: `${schedule.course?.toUpperCase()}-${schedule.year?.charAt(0).toUpperCase()}${schedule.section}`,
        day: schedule.day,
        time: schedule.time
      });
    }
    
    if (newSchedule.room === schedule.room) {
      conflicts.room.push({
        subject: schedule.subject,
        section: `${schedule.course?.toUpperCase()}-${schedule.year?.charAt(0).toUpperCase()}${schedule.section}`,
        instructor: schedule.instructor,
        day: schedule.day,
        time: schedule.time
      });
    }
    
    if (newSchedule.section === schedule.section && 
        newSchedule.course === schedule.course && 
        newSchedule.year === schedule.year) {
      conflicts.section.push({
        subject: schedule.subject,
        instructor: schedule.instructor,
        room: schedule.room,
        day: schedule.day,
        time: schedule.time
      });
    }
  });
  
  return conflicts;
};
// ============== END VALIDATION UTILITIES ==============

const ScheduleManagementDetails = () => {
  const { course, year } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const formatYearParam = (yearParam) => {
    // Extract just the numeric part (1, 2, 3, 4) from year parameter like "1styear" or "1st year"
    const match = yearParam.match(/(\d+)/);
    return match ? String(match[1]) : yearParam;
  };

  const normalizedYear = formatYearParam(year);

  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showAddSchedulePopup, setShowAddSchedulePopup] = useState(false);
  const [instructors, setInstructors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, destructive: false });
  const [conflictDetails, setConflictDetails] = useState(null);
  const [pendingScheduleData, setPendingScheduleData] = useState(null);
  
  const [showEditSchedulePopup, setShowEditSchedulePopup] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState({ visible: false, schedule: null, suggestions: [], loading: false });
  const [showArchivedModal, setShowArchivedModal] = useState(false);
  const [archivedSchedules, setArchivedSchedules] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [formDay, setFormDay] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const startTimeInputRef = useRef(null);
  const endTimeInputRef = useRef(null);

  const courseDetails = {
    bsit: {
      name: 'Bachelor of Science in Information Technology',
      shortName: 'BSIT',
      icon: faGraduationCap,
      gradient: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
    },
    'bsemc-dat': {
      name: 'Bachelor of Science in Entertainment and Multimedia Computing',
      shortName: 'BSEMC-DAT',
      icon: faCode,
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    }
  };

  const formatYearDisplay = (yearParam) => {
    return yearParam.replace(/(\d+)/, '$1 ').replace(/([a-z])([A-Z])/g, '$1 $2');
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sectionsRes, schedulesRes, instructorsRes, roomsRes] = await Promise.all([
        apiClient.get(`/api/sections?course=${course}&year=${normalizedYear}`),
        apiClient.get(`/api/schedule?course=${course}&year=${normalizedYear}`),
        apiClient.get('/api/instructors'),
        apiClient.get('/api/rooms')
      ]);
  
      // Data fetched successfully
      const sortedSections = (Array.isArray(sectionsRes.data) ? sectionsRes.data : []).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setSections(sortedSections);
      
      // Ensure archived schedules are hidden from active lists
      let schedulesData = [];
      if (Array.isArray(schedulesRes.data)) schedulesData = schedulesRes.data;
      else if (schedulesRes.data && Array.isArray(schedulesRes.data.schedules)) schedulesData = schedulesRes.data.schedules;
      setSchedules(schedulesData.filter(s => !s.archived));
      
      // Handle instructor data - backend now returns plain array
      let instructorsArray = [];
      if (Array.isArray(instructorsRes.data)) {
        instructorsArray = instructorsRes.data;
      } else if (instructorsRes.data?.instructors && Array.isArray(instructorsRes.data.instructors)) {
        instructorsArray = instructorsRes.data.instructors;
      }
      const activeInstructors = instructorsArray
        .filter(inst => inst.status === 'active')
        .map(inst => ({
          id: inst.instructorId || inst._id,
          name: `${inst.firstname} ${inst.lastname}`,
          email: inst.email
        }));
      setInstructors(activeInstructors);
      
      // Handle rooms - backend now returns plain array
      let roomsArray = [];
      if (Array.isArray(roomsRes.data)) {
        roomsArray = roomsRes.data;
      } else if (roomsRes.data?.rooms && Array.isArray(roomsRes.data.rooms)) {
        roomsArray = roomsRes.data.rooms;
      }
      setRooms(roomsArray);
    } catch (error) {
      showToast('Error fetching data.', 'error');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [course, normalizedYear, showToast]);

  const fetchArchivedSchedules = async () => {
    setArchivedLoading(true);
    try {
      const res = await apiClient.get('/api/schedule/archived');
      if (Array.isArray(res.data)) setArchivedSchedules(res.data);
      else if (res.data?.schedules && Array.isArray(res.data.schedules)) setArchivedSchedules(res.data.schedules);
      else setArchivedSchedules([]);
    } catch (err) {
      console.error('Error fetching archived schedules', err);
      showToast('Error loading archived schedules.', 'error');
      setArchivedSchedules([]);
    } finally {
      setArchivedLoading(false);
    }
  };

  useEffect(() => {
    // Reset selectedSection when course or year changes to prevent stale section references
    setSelectedSection(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      setSelectedSection(sections[0]);
    }
  }, [sections, selectedSection]);

  useEffect(() => {
    if (!showAddSchedulePopup || !selectedSection || !formDay) {
      if (!showAddSchedulePopup) {
        setAvailabilitySlots([]);
      }
      return;
    }

    let cancelled = false;
    const fetchAvailability = async () => {
      setAvailabilityLoading(true);
      try {
        const params = {
          day: formDay,
          course,
          year: normalizedYear,
          section: selectedSection.name,
        };
        if (formInstructor) params.instructor = formInstructor;
        if (formRoom) params.room = formRoom;
        const { data } = await apiClient.getScheduleAvailability(params);
        if (cancelled) return;
        setAvailabilitySlots(data?.availability || []);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch availability:', error);
        setAvailabilitySlots([]);
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    fetchAvailability();
    return () => {
      cancelled = true;
    };
  }, [
    showAddSchedulePopup,
    selectedSection,
    formDay,
    formInstructor,
    formRoom,
    course,
    normalizedYear,
  ]);
  
  const resetAddScheduleState = useCallback(() => {
    setFormDay('');
    setFormInstructor('');
    setFormRoom('');
    setAvailabilitySlots([]);
    if (startTimeInputRef.current) startTimeInputRef.current.value = '';
    if (endTimeInputRef.current) endTimeInputRef.current.value = '';
  }, []);

  const openAddSchedulePopup = () => {
    resetAddScheduleState();
    setShowAddSchedulePopup(true);
  };

  const closeAddSchedulePopup = () => {
    resetAddScheduleState();
    setShowAddSchedulePopup(false);
    setConflictDetails(null);
    setPendingScheduleData(null);
  };
  
  const getSectionSchedules = useCallback((sectionName) => {
    return schedules.filter(sched => sched.section === sectionName);
  }, [schedules]);

  const handleSlotSelect = (slot) => {
    if (startTimeInputRef.current) startTimeInputRef.current.value = slot.start;
    if (endTimeInputRef.current) endTimeInputRef.current.value = slot.end;
    setConflictDetails(null);
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    setAddingSchedule(true);

    const formData = new FormData(e.target);
    const instructorName = formData.get('instructor');
    
    // Find instructor email from the instructor name
    const selectedInstructor = instructors.find(inst => inst.name === instructorName);
    const instructorEmail = selectedInstructor ? selectedInstructor.email : '';
    
    // Creating schedule for instructor
    
    const scheduleData = {
      course,
      year: normalizedYear,
      section: selectedSection.name,
      subject: formData.get('subject'),
      day: formData.get('day'),
      time: `${formData.get('startTime')} - ${formData.get('endTime')}`,
      instructor: instructorName,
      room: formData.get('room')
    };
    
    // Only add instructorEmail if we found it
    if (instructorEmail) {
      scheduleData.instructorEmail = instructorEmail;
    }

    // ✅ Check instructor session limits FIRST
    const sessionCheck = checkInstructorSessionLimit(
      scheduleData, 
      schedules, 
      instructorName
    );
    
    if (!sessionCheck.valid) {
      showToast(sessionCheck.message, 'error');
      setAddingSchedule(false);
      return;
    }

    // Check for conflicts
    const conflicts = checkScheduleConflicts(scheduleData, schedules);
    const hasConflicts = conflicts.instructor.length > 0 || 
                        conflicts.room.length > 0 || 
                        conflicts.section.length > 0;

    if (hasConflicts) {
      setConflictDetails(conflicts);
      setPendingScheduleData(scheduleData);
      setAddingSchedule(false);
      return;
    }

    // No conflicts, proceed with creation
    await submitSchedule(scheduleData, e.target);
  };

  const submitSchedule = async (scheduleData, formElement = null) => {
    try {
      const res = await apiClient.createSchedule(scheduleData);
      if (res.data.success) {
        showToast('Schedule added successfully!', 'success');
        closeAddSchedulePopup();
        await fetchData();
        if (formElement) formElement.reset();
      } else {
        showToast(res.data.message || 'Failed to add schedule.', 'error');
      }
    } catch (error) {
      if (error.response?.status === 409) {
        showToast(error.response.data.message || 'Schedule conflict detected.', 'error');
      } else {
        showToast('Error adding schedule.', 'error');
      }
      console.error('Error adding schedule:', error);
    } finally {
      setAddingSchedule(false);
    }
  };

  const handleConflictProceed = async () => {
    if (pendingScheduleData) {
      await submitSchedule(pendingScheduleData);
    }
  };

  const handleConflictModify = () => {
    setConflictDetails(null);
    setPendingScheduleData(null);
    // Keep the form open so user can modify
  };

  const handleConflictCancel = () => {
    setConflictDetails(null);
    setPendingScheduleData(null);
    closeAddSchedulePopup();
  };

  const handleArchiveSchedule = (scheduleId) => {
    setConfirmDialog({
      show: true,
      title: 'Archive Schedule',
      message: 'Are you sure you want to archive this schedule? It will be hidden from active lists.',
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/api/schedule/${scheduleId}/archive`);
          if (res.data.success) {
            showToast('Schedule archived successfully.', 'success');
            await fetchData();
          } else {
            showToast(res.data.message || 'Failed to archive schedule.', 'error');
          }
        } catch (err) {
          console.error('Error archiving schedule:', err);
          showToast('Error archiving schedule.', 'error');
        }
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, destructive: false });
      },
      destructive: false,
    });
  };
 
  const openArchivedModal = () => {
    setShowArchivedModal(true);
    fetchArchivedSchedules();
  };

  const closeArchivedModal = () => {
    setShowArchivedModal(false);
    setArchivedSchedules([]);
  };

  const handleRestoreSchedule = async (scheduleId) => {
    try {
      const res = await apiClient.post(`/api/schedule/${scheduleId}/restore`);
      if (res.data.success) {
        showToast('Schedule restored.', 'success');
        await fetchData();
        await fetchArchivedSchedules();
      } else {
        showToast(res.data.message || 'Failed to restore schedule.', 'error');
      }
    } catch (err) {
      console.error('Error restoring schedule', err);
      showToast('Error restoring schedule.', 'error');
    }
  };

  const handleEditClick = (schedule) => {
    setScheduleToEdit(schedule);
    setShowEditSchedulePopup(true);
  };

  // --- Reschedule helpers ---
  const openRescheduleModal = (schedule) => {
    setRescheduleModal({ visible: true, schedule, suggestions: [], loading: true });
    // compute suggestions asynchronously
    setTimeout(() => computeRescheduleSuggestions(schedule), 50);
  };

  const closeRescheduleModal = () => setRescheduleModal({ visible: false, schedule: null, suggestions: [], loading: false });

  const computeRescheduleSuggestions = (schedule) => {
    try {
      // enforce fixed duration for suggestions: 2 hours 30 minutes (150 minutes)
      const duration = 150;
      // --- Subject analysis ---
      const subjectSchedules = schedules.filter(s => s.subject === schedule.subject && s.course === schedule.course && s.year === schedule.year);
      const subjectTotalMinutes = subjectSchedules.reduce((sum, s) => sum + getTimeRangeDuration(s.time), 0);
      const subjectTotalHours = +(subjectTotalMinutes / 60).toFixed(2);
      const subjectOccurrences = subjectSchedules.length;
      const roomsUsed = [...new Set(subjectSchedules.map(s => s.room).filter(Boolean))];

      // Rooms used by others: map room -> [{subject, day, time}]
      const roomsUsedByOthers = {};
      roomsUsed.forEach((r) => {
        roomsUsedByOthers[r] = schedules
          .filter(s => s.room === r && s.subject !== schedule.subject)
          .map(s => ({ subject: s.subject, day: s.day, time: s.time, section: s.section }));
      });

      // Basic data quality checks (errors)
      const errors = [];
      subjectSchedules.forEach((s) => {
        const dur = getTimeRangeDuration(s.time);
        if (dur <= 0) errors.push(`Invalid time for schedule ${s._id || s.subject}: "${s.time}"`);
        if (!s.room) errors.push(`Missing room for schedule ${s._id || s.subject} on ${s.day}`);
      });
      // end subject analysis
      const step = TIME_SLOT_CONFIGS.DETAILED.duration || 30;
      const slots = generateTimeSlots(TIME_SLOT_CONFIGS.DETAILED.startHour, TIME_SLOT_CONFIGS.DETAILED.endHour, step);
      // Only consider the same day as the original schedule for reschedule suggestions
      const days = [schedule.day];

      const suggestions = [];

      for (const day of days) {
        for (let i = 0; i < slots.length; i++) {
          const slotStart = slots[i].split(' - ')[0];
          const startMin = timeStringToMinutes(slotStart);
          const endMin = startMin + duration;
          if (endMin > TIME_SLOT_CONFIGS.DETAILED.endHour * 60) continue;
          const candidateTime = `${minutesToTimeString(startMin)} - ${minutesToTimeString(endMin)}`;

          // Skip if same as current
          if (day === schedule.day && candidateTime === schedule.time) continue;

          // Skip any candidate that overlaps with any existing schedule (we only suggest fully free slots)
          const anyOverlap = schedules.some(s => s._id !== schedule._id && timeRangesOverlap(s.time, candidateTime) && doDaysOverlap(s.day, day));
          if (anyOverlap) continue;

          // Find an available room (prefer original) - since we already ensured no overlap, prefer original room if still available
          let chosenRoom = null;
          // prefer original room if normalized names match and room is available
          const normalizedOriginal = normalizeRoomName(schedule.room);
          const originalRoomAvailable = rooms.find(r => normalizeRoomName(r.room || r.name) === normalizedOriginal && r.status === 'available');
          if (originalRoomAvailable) chosenRoom = originalRoomAvailable.room || originalRoomAvailable.name;
          else {
            const available = rooms.find(r => r.status === 'available');
            if (available) chosenRoom = available.room || available.name;
          }
          if (!chosenRoom) continue;

          suggestions.push({ day, time: candidateTime, room: chosenRoom });
          if (suggestions.length >= 8) break;
        }
        if (suggestions.length >= 8) break;
      }

      setRescheduleModal(prev => ({ ...prev, suggestions, loading: false, subjectAnalysis: { subjectTotalHours, subjectOccurrences, roomsUsed, roomsUsedByOthers, errors } }));
    } catch (err) {
      console.error('Error computing reschedule suggestions', err);
      setRescheduleModal(prev => ({ ...prev, suggestions: [], loading: false, subjectAnalysis: { subjectTotalHours: 0, subjectOccurrences: 0, roomsUsed: [], roomsUsedByOthers: {}, errors: ['Internal error computing suggestions'] } }));
    }
  };

  const applyReschedule = async (suggestion) => {
    if (!rescheduleModal.schedule) return;
    setRescheduleModal(prev => ({ ...prev, loading: true }));
    try {
      const schedule = rescheduleModal.schedule;
      // Send all required fields for the backend update endpoint
      const update = {
        course: schedule.course,
        year: schedule.year,
        section: schedule.section,
        subject: schedule.subject,
        instructor: schedule.instructor,
        instructorEmail: schedule.instructorEmail,
        day: suggestion.day,
        time: suggestion.time,
        room: suggestion.room,
        version: schedule.__v, // Include current version for MVCC conflict detection
      };
      const res = await apiClient.updateSchedule(schedule._id, update, schedule.__v);
      if (res.data.success) {
        showToast('Schedule rescheduled successfully.', 'success');
        await fetchData();
        closeRescheduleModal();
      } else {
        showToast(res.data.message || 'Failed to reschedule.', 'error');
        setRescheduleModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Error applying reschedule', err);
      if (err.response?.status === 409) {
        showToast('⚠️ Schedule was modified. Please refresh and try again.', 'error');
      } else {
        showToast('Error rescheduling. Check conflicts or server logs.', 'error');
      }
      setRescheduleModal(prev => ({ ...prev, loading: false }));
    }
  };
  // --- end reschedule helpers ---

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditingSchedule(true);

    const formData = new FormData(e.target);
    const instructorName = formData.get('instructor');
    
    // Find instructor email from the instructor name
    const selectedInstructor = instructors.find(inst => inst.name === instructorName);
    const instructorEmail = selectedInstructor ? selectedInstructor.email : '';
    
    const scheduleData = {
      course: scheduleToEdit.course,
      year: scheduleToEdit.year,
      section: scheduleToEdit.section,
      subject: formData.get('subject'),
      day: formData.get('day'),
      time: `${formData.get('startTime')} - ${formData.get('endTime')}`,
      instructor: instructorName,
      room: formData.get('room')
    };
    
    // Add instructorEmail if found
    if (instructorEmail) {
      scheduleData.instructorEmail = instructorEmail;
    }

    try {
      const res = await apiClient.updateSchedule(scheduleToEdit._id, scheduleData, scheduleToEdit.__v);
      if (res.data.success) {
        showToast('Schedule updated successfully!', 'success');
        setShowEditSchedulePopup(false);
        setScheduleToEdit(null);
        await fetchData();
      } else {
        showToast(res.data.message || 'Failed to update schedule.', 'error');
      }
    } catch (error) {
      if (error.response?.status === 409) {
        showToast('⚠️ Schedule was modified by another user. Please refresh and try again.', 'error');
      } else {
        showToast('Error updating schedule.', 'error');
      }
      console.error('Error updating schedule:', error);
    } finally {
      setEditingSchedule(false);
    }
  };

  // Template apply functionality removed (templates/import UI deprecated)

  return (
    <div className="dashboard-container" style={{ display: 'flex', height: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      <Sidebar />
      <main className="main-content" style={{ flex: 1, padding: '1rem', overflowY: 'auto' }}>
        <Header title="Schedule Management" />
        <div className="dashboard-content" style={{ marginTop: '140px', padding: '0 20px 40px' }}>
          {/* Enhanced Back Button */}
          <button
            onClick={() => navigate('/admin/schedule-management')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: '#ffffff',
              border: '2px solid #e5e7eb',
              borderRadius: '14px',
              color: '#374151',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '24px',
              fontSize: '15px',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f9fafb';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.transform = 'translateX(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back to Year Levels</span>
          </button>

          {/* Enhanced Course Header */}
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
                <FontAwesomeIcon 
                  icon={courseDetails[course]?.icon || faGraduationCap}
                  style={{ fontSize: 28, color: '#fff' }}
                />
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                }}>
                  {courseDetails[course]?.shortName} - {formatYearDisplay(year)}
                </h2>
                <p style={{
                  margin: '6px 0 0 0',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontWeight: '500',
                }}>
                  {courseDetails[course]?.name}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 40px',
              color: '#64748b',
              background: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            }}>
              <FontAwesomeIcon icon={faClock} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Loading sections and schedules...</p>
            </div>
          ) : sections.length === 0 ? (
            <div style={{
              background: '#ffffff',
              padding: '60px 40px',
              borderRadius: '24px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
              border: '2px dashed #e2e8f0',
            }}>
              <FontAwesomeIcon
                icon={courseDetails[course]?.icon || faGraduationCap}
                style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3, color: '#f97316' }}
              />
              <p style={{
                color: '#64748b',
                marginBottom: '24px',
                fontSize: '18px',
                fontWeight: '600',
              }}>
                No sections found for {courseDetails[course]?.shortName} {formatYearDisplay(year)}.
              </p>
              <button
                onClick={() => navigate('/admin/manage-schedule')}
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '15px',
                  boxShadow: '0 4px 12px rgba(15, 44, 99, 0.3)',
                  transition: 'all 0.3s ease',
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
                Go to Section Management
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '28px' }}>
              {/* Enhanced Sections Sidebar */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '28px',
                  borderRadius: '24px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  height: 'fit-content',
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto',
                  position: 'relative',
                }}
              >
                {/* Top gradient accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: courseDetails[course]?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  borderRadius: '24px 24px 0 0',
                }} />
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                  paddingBottom: '20px',
                  borderBottom: '2px solid #f1f5f9',
                  paddingTop: '8px',
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#1e293b',
                    margin: 0,
                    letterSpacing: '-0.3px',
                  }}>
                    Sections
                  </h3>
                  <span style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                  }}>
                    {sections.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {sections.map((section) => (
                    <button
                      key={section._id}
                      onClick={() => setSelectedSection(section)}
                      style={{
                        background: selectedSection?._id === section._id 
                          ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' 
                          : '#f9fafb',
                        border: selectedSection?._id === section._id 
                          ? '2px solid #3b82f6' 
                          : '2px solid transparent',
                        padding: '18px',
                        borderRadius: '16px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        boxShadow: selectedSection?._id === section._id 
                          ? '0 4px 12px rgba(59, 130, 246, 0.15)' 
                          : 'none',
                      }}
                      onMouseOver={(e) => {
                        if (selectedSection?._id !== section._id) {
                          e.currentTarget.style.background = '#f3f4f6';
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (selectedSection?._id !== section._id) {
                          e.currentTarget.style.background = '#f9fafb';
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: selectedSection?._id === section._id ? '#1e40af' : '#1f2937',
                        marginBottom: '6px',
                      }}>
                        {course.toUpperCase()}-{year.charAt(0).toUpperCase()}{section.name}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: selectedSection?._id === section._id ? '#3b82f6' : '#6b7280',
                        fontWeight: '500',
                      }}>
                        {getSectionSchedules(section.name).length} schedule(s)
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Enhanced Schedules Content */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '32px',
                  borderRadius: '24px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  height: 'fit-content',
                  maxHeight: 'calc(100vh - 280px)',
                  overflowY: 'auto',
                  position: 'relative',
                }}
              >
                {/* Top gradient accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: courseDetails[course]?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  borderRadius: '24px 24px 0 0',
                }} />
                {!selectedSection ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '80px 30px',
                    color: '#64748b',
                  }}>
                    <FontAwesomeIcon icon={faUser} style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Select a section to review schedules.</p>
                  </div>
                ) : (
                  (() => {
                    const sectionSchedules = getSectionSchedules(selectedSection?.name || '');
                    return (
                      <>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '28px',
                          paddingBottom: '24px',
                          borderBottom: '2px solid #f1f5f9',
                          paddingTop: '8px',
                        }}>
                          <div>
                            <h3 style={{
                              fontSize: '24px',
                              fontWeight: '800',
                              color: '#1e293b',
                              margin: '0 0 6px 0',
                              letterSpacing: '-0.5px',
                            }}>
                              {course.toUpperCase()}-{year.charAt(0).toUpperCase()}{selectedSection.name}
                            </h3>
                            <p style={{
                              fontSize: '15px',
                              color: '#64748b',
                              margin: 0,
                              fontWeight: '500',
                            }}>
                              {sectionSchedules.length} schedule(s) listed below
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                              onClick={openAddSchedulePopup}
                              style={{
                                padding: '12px 20px',
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                                transition: 'all 0.3s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(5, 150, 105, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
                              }}
                            >
                              <FontAwesomeIcon icon={faPlus} />
                              Add Schedule
                            </button>
                            <button
                              onClick={openArchivedModal}
                              style={{
                                padding: '12px 20px',
                                background: '#ffffff',
                                color: '#374151',
                                border: '2px solid #e5e7eb',
                                borderRadius: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
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
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <FontAwesomeIcon icon={faFileAlt} />
                              Archived
                            </button>
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                          gap: '24px',
                        }}>
                          {sectionSchedules.length === 0 ? (
                            <div style={{
                              gridColumn: '1 / -1',
                              textAlign: 'center',
                              padding: '60px 20px',
                              color: '#64748b',
                              background: '#f8fafc',
                              borderRadius: '16px',
                              border: '2px dashed #e2e8f0',
                            }}>
                              <FontAwesomeIcon icon={faCalendarAlt} style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                              <p style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>This section has no schedules yet.</p>
                              <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.7 }}>Click "Add Schedule" to create one</p>
                            </div>
                          ) : (
                            sectionSchedules.map((schedule) => (
                              <div
                                key={schedule._id}
                                style={{
                                  background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
                                  border: '2px solid #e5e7eb',
                                  borderRadius: '20px',
                                  padding: '24px',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  position: 'relative',
                                  overflow: 'hidden',
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.borderColor = '#3b82f6';
                                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.2)';
                                  e.currentTarget.style.transform = 'translateY(-4px)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.borderColor = '#e5e7eb';
                                  e.currentTarget.style.boxShadow = 'none';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                {/* Decorative gradient bar */}
                                <div style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  height: '4px',
                                  background: courseDetails[course]?.gradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                }} />
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  marginBottom: '20px',
                                  paddingBottom: '18px',
                                  borderBottom: '1px solid #e5e7eb',
                                  paddingTop: '4px',
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <h4 style={{
                                      fontSize: '18px',
                                      fontWeight: '700',
                                      color: '#1f2937',
                                      margin: '0 0 8px 0',
                                      letterSpacing: '-0.3px',
                                    }}>
                                      {schedule.subject}
                                    </h4>
                                    <p style={{
                                      fontSize: '13px',
                                      color: '#6b7280',
                                      margin: 0,
                                      fontWeight: '500',
                                    }}>
                                      Instructor: <strong style={{ color: '#1f2937' }}>{schedule.instructor || 'TBA'}</strong>
                                    </p>
                                  </div>
                                  <span style={{
                                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                    color: '#b45309',
                                    padding: '6px 14px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    boxShadow: '0 2px 8px rgba(180, 83, 9, 0.15)',
                                    whiteSpace: 'nowrap',
                                    marginLeft: '12px',
                                  }}>
                                    {schedule.day}
                                  </span>
                                </div>

                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '12px',
                                  fontSize: '14px',
                                  color: '#374151',
                                  marginBottom: '20px',
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: '#1f2937',
                                    padding: '10px',
                                    background: '#f8fafc',
                                    borderRadius: '10px',
                                  }}>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '10px',
                                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                    }}>
                                      <FontAwesomeIcon icon={faClock} />
                                    </div>
                                    <span style={{ fontWeight: '600' }}>{schedule.time}</span>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px',
                                    background: '#f8fafc',
                                    borderRadius: '10px',
                                  }}>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '10px',
                                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                    }}>
                                      <FontAwesomeIcon icon={faDoorOpen} />
                                    </div>
                                    <span style={{ fontWeight: '500' }}>{schedule.room || 'Room TBA'}</span>
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px',
                                    background: '#f8fafc',
                                    borderRadius: '10px',
                                  }}>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '10px',
                                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#ffffff',
                                      fontSize: '14px',
                                    }}>
                                      <FontAwesomeIcon icon={faUser} />
                                    </div>
                                    <span style={{ fontWeight: '500' }}>{schedule.section}</span>
                                  </div>
                                </div>

                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginTop: '20px',
                                  paddingTop: '20px',
                                  borderTop: '1px solid #e5e7eb',
                                  flexWrap: 'wrap',
                                  gap: '10px',
                                }}>
                                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <button
                                      onClick={() => handleEditClick(schedule)}
                                      style={{
                                        padding: '10px 16px',
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                        color: '#b45309',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        gap: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(180, 83, 9, 0.15)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(180, 83, 9, 0.25)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(180, 83, 9, 0.15)';
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faEdit} />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => openRescheduleModal(schedule)}
                                      style={{
                                        padding: '10px 16px',
                                        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                                        color: '#3730a3',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        gap: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(55, 48, 163, 0.15)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(55, 48, 163, 0.25)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(55, 48, 163, 0.15)';
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faCalendarPlus} />
                                      Reschedule
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      onClick={() => handleArchiveSchedule(schedule._id)}
                                      style={{
                                        padding: '10px 14px',
                                        background: '#ffffff',
                                        color: '#374151',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.3s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#f9fafb';
                                        e.currentTarget.style.borderColor = '#d1d5db';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#ffffff';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }}
                                    >
                                      <FontAwesomeIcon icon={faArchive} />
                                      Archive
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )
                  })()
                )}
              </div>
            </div>
          )}
          {showAddSchedulePopup && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}>
              <div style={{
                background: 'white',
                borderRadius: '18px',
                width: '90%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px',
                  borderBottom: '2px solid #f3f4f6',
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <FontAwesomeIcon icon={faPlus} style={{ color: '#059669' }} />
                    Add Schedule
                  </h3>
                  <button
                    onClick={closeAddSchedulePopup}
                    disabled={addingSchedule}
                    style={{
                      background: '#f3f4f6',
                      border: 'none',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                {/* Conflict Warning */}
                {conflictDetails && (
                  <div style={{
                    margin: '20px 24px',
                    padding: '16px',
                    background: '#fef2f2',
                    border: '2px solid #fecaca',
                    borderRadius: '10px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '12px',
                      color: '#991b1b',
                      fontWeight: '700',
                      fontSize: '15px',
                    }}>
                      <FontAwesomeIcon icon={faExclamationCircle} />
                      <span>Schedule Conflict Detected!</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#7f1d1d' }}>
                      {conflictDetails.instructor.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Instructor Conflict:</strong> {conflictDetails.instructor[0].instructor} is already teaching "{conflictDetails.instructor[0].subject}" ({conflictDetails.instructor[0].section}) on {conflictDetails.instructor[0].day} at {conflictDetails.instructor[0].time}
                        </div>
                      )}
                      {conflictDetails.room.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Room Conflict:</strong> Room {conflictDetails.room[0].room} is already booked for "{conflictDetails.room[0].subject}" ({conflictDetails.room[0].section}) on {conflictDetails.room[0].day} at {conflictDetails.room[0].time}
                        </div>
                      )}
                      {conflictDetails.section.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                          <strong>Section Conflict:</strong> This section already has "{conflictDetails.section[0].subject}" scheduled on {conflictDetails.section[0].day} at {conflictDetails.section[0].time}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setConflictDetails(null)}
                      style={{
                        marginTop: '12px',
                        padding: '8px 16px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Modify Schedule
                    </button>
                  </div>
                )}

                <form onSubmit={handleAddSchedule} style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Subject Name *
                    </label>
                    <input
                      name="subject"
                      type="text"
                      placeholder="e.g., Data Structures and Algorithms"
                      required
                      disabled={addingSchedule}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  {/* ✅ UPDATED: Individual Day Selection */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Day *
                    </label>
                    <select
                      name="day"
                      required
                      disabled={addingSchedule}
                      value={formDay}
                      onChange={(e) => {
                        setConflictDetails(null);
                        setFormDay(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Day</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Start Time *
                      </label>
                      <input
                        name="startTime"
                        type="text"
                        placeholder="e.g., 9:00 AM"
                        pattern="^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$"
                        title="Enter time in HH:MM AM/PM format"
                        required
                        disabled={addingSchedule}
                        onChange={() => setConflictDetails(null)}
                        ref={startTimeInputRef}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        End Time *
                      </label>
                      <input
                        name="endTime"
                        type="text"
                        placeholder="e.g., 10:30 AM"
                        pattern="^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$"
                        title="Enter time in HH:MM AM/PM format"
                        required
                        disabled={addingSchedule}
                        onChange={() => setConflictDetails(null)}
                        ref={endTimeInputRef}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>

                  {formDay && (
                    <div
                      style={{
                        marginBottom: '20px',
                        padding: '16px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        background: '#f8fafc',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '10px',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          Available slots for {formDay}
                        </span>
                        {availabilityLoading && (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>Loading…</span>
                        )}
                      </div>
                      {availabilitySlots.length === 0 ? (
                        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                          No available slots based on the current selection.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {availabilitySlots.map((slot, idx) => (
                            <button
                              key={`${slot.start}-${slot.end}-${idx}`}
                              type="button"
                              onClick={() => handleSlotSelect(slot)}
                              disabled={addingSchedule}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '999px',
                                border: '1px solid #c7d2fe',
                                background: '#eef2ff',
                                color: '#3730a3',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              {slot.start} - {slot.end}
                            </button>
                          ))}
                        </div>
                      )}
                      <p style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                        Click a slot to autofill the start and end time fields.
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Instructor *
                    </label>
                    <select
                      name="instructor"
                      required
                      disabled={addingSchedule}
                      value={formInstructor}
                      onChange={(e) => {
                        setConflictDetails(null);
                        setFormInstructor(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Instructor</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.name}>
                          {instructor.name} ({instructor.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Room *
                    </label>
                    <select
                      name="room"
                      required
                      disabled={addingSchedule}
                      value={formRoom}
                      onChange={(e) => {
                        setConflictDetails(null);
                        setFormRoom(e.target.value);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Room</option>
                      {rooms
                        .filter(room => room.status === 'available')
                        .map((room) => (
                          <option key={room._id} value={room.room}>
                            {formatRoomLabel(room.room)} ({room.area})
                          </option>
                        ))}
                    </select>
                    {rooms.filter(room => room.status === 'available').length === 0 && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#ef4444' }}>
                        No available rooms. Please check room status in Room Management.
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={closeAddSchedulePopup}
                      disabled={addingSchedule}
                      style={{
                        padding: '12px 24px',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingSchedule}
                      style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {addingSchedule ? 'Adding...' : 'Add Schedule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reschedule Modal */}
          {rescheduleModal.visible && (
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
              <div style={{ background: '#fff', borderRadius: 12, width: '92%', maxWidth: 760, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(2,6,23,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', borderBottom: '1px solid #eef2ff' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{rescheduleModal.schedule?.subject || 'Reschedule'}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{rescheduleModal.schedule?.instructor} • {rescheduleModal.schedule?.room}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={closeRescheduleModal} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>

                <div style={{ padding: 18 }}>
                  {/* Subject analysis display */}
                  {rescheduleModal.subjectAnalysis && (
                    <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e6eefb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, color: '#475569' }}>Subject</div>
                          <div style={{ fontWeight: 800 }}>{rescheduleModal.schedule?.subject || '-'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: '#475569' }}>Total Hours (week)</div>
                          <div style={{ fontWeight: 800 }}>{rescheduleModal.subjectAnalysis.subjectTotalHours} hrs</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: '#475569' }}>Occurrences</div>
                          <div style={{ fontWeight: 800 }}>{rescheduleModal.subjectAnalysis.subjectOccurrences}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: '#475569' }}>Rooms Used</div>
                          <div style={{ fontWeight: 800 }}>{rescheduleModal.subjectAnalysis.roomsUsed.length > 0 ? rescheduleModal.subjectAnalysis.roomsUsed.join(', ') : '—'}</div>
                        </div>
                      </div>

                      {rescheduleModal.subjectAnalysis.errors && rescheduleModal.subjectAnalysis.errors.length > 0 && (
                        <div style={{ marginTop: 8, color: '#7f1d1d', fontSize: 13 }}>
                          <strong>Data issues:</strong>
                          <ul style={{ margin: '6px 0 0 18px' }}>
                            {rescheduleModal.subjectAnalysis.errors.map((err, i) => <li key={i}>{err}</li>)}
                          </ul>
                        </div>
                      )}

                      {rescheduleModal.subjectAnalysis.roomsUsed && Object.keys(rescheduleModal.subjectAnalysis.roomsUsedByOthers || {}).length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Rooms currently used by other subjects (examples)</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(rescheduleModal.subjectAnalysis.roomsUsedByOthers).map(([room, uses]) => (
                              <div key={room} style={{ padding: 8, borderRadius: 8, background: '#fff', border: '1px solid #e6eefb', minWidth: 160 }}>
                                <div style={{ fontWeight: 800 }}>{room}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{uses.slice(0,3).map(u => `${u.subject} (${u.day} ${u.time})`).join('; ') || '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {rescheduleModal.loading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Looking for available slots within this week...</div>
                  ) : rescheduleModal.suggestions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No suitable suggestions found for this week.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {rescheduleModal.suggestions.map((sug, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid #e6edf3' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{sug.day} • {sug.time}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>Room: <strong style={{ color: '#0f1724' }}>{sug.room}</strong></div>
                          </div>
                          <div>
                            <button onClick={() => applyReschedule(sug)} style={{ padding: '8px 14px', background: 'linear-gradient(90deg,#0f2c63,#1e40af)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Apply</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Archived Schedules Modal */}
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
                    <div style={{ fontSize: 16, fontWeight: 800 }}>Archived Schedules</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{archivedSchedules.length} archived schedule(s)</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button onClick={closeArchivedModal} style={{ padding: '8px 12px', background: '#f3f4f6', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Close</button>
                  </div>
                </div>

                <div style={{ padding: 18 }}>
                  {archivedLoading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading archived schedules...</div>
                  ) : archivedSchedules.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No archived schedules.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {archivedSchedules.map((s) => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, border: '1px solid #e6eefb' }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>{s.subject} <span style={{ fontWeight: 600, color: '#64748b' }}>• {s.course} {s.year} {s.section}</span></div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>{s.day} • {s.time} — {s.room} — {s.instructor}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleRestoreSchedule(s._id)} style={{ padding: '8px 12px', background: 'linear-gradient(90deg,#059669,#047857)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Restore</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Edit Schedule Popup */}
          {showEditSchedulePopup && scheduleToEdit && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}>
              <div style={{
                background: 'white',
                borderRadius: '18px',
                width: '90%',
                maxWidth: '500px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '24px',
                  borderBottom: '2px solid #f3f4f6',
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <FontAwesomeIcon icon={faEdit} style={{ color: '#d97706' }} />
                    Edit Schedule
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditSchedulePopup(false);
                      setScheduleToEdit(null);
                    }}
                    disabled={editingSchedule}
                    style={{
                      background: '#f3f4f6',
                      border: 'none',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      color: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Subject Name *
                    </label>
                    <input
                      name="subject"
                      type="text"
                      defaultValue={scheduleToEdit.subject}
                      placeholder="e.g., Data Structures and Algorithms"
                      required
                      disabled={editingSchedule}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Day *
                    </label>
                    <select
                      name="day"
                      defaultValue={scheduleToEdit.day}
                      required
                      disabled={editingSchedule}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Day</option>
                      <option value="Monday">Monday</option>
                      <option value="Tuesday">Tuesday</option>
                      <option value="Wednesday">Wednesday</option>
                      <option value="Thursday">Thursday</option>
                      <option value="Friday">Friday</option>
                      <option value="Saturday">Saturday</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        Start Time *
                      </label>
                      <input
                        name="startTime"
                        type="text"
                        defaultValue={scheduleToEdit.time?.split(' - ')[0]?.trim() || ''}
                        placeholder="8:00 AM"
                        required
                        disabled={editingSchedule}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                        End Time *
                      </label>
                      <input
                        name="endTime"
                        type="text"
                        defaultValue={scheduleToEdit.time?.split(' - ')[1]?.trim() || ''}
                        placeholder="9:30 AM"
                        required
                        disabled={editingSchedule}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Instructor *
                    </label>
                    <select
                      name="instructor"
                      defaultValue={scheduleToEdit.instructor}
                      required
                      disabled={editingSchedule}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Instructor</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.name}>
                          {instructor.name} ({instructor.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                      Room *
                    </label>
                    <select
                      name="room"
                      defaultValue={scheduleToEdit.room}
                      required
                      disabled={editingSchedule}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '10px',
                        fontSize: '14px',
                      }}
                    >
                      <option value="">Select Room</option>
                      {rooms
                        .filter(room => room.status === 'available')
                        .map((room) => (
                          <option key={room._id} value={room.room}>
                            {formatRoomLabel(room.room)} ({room.area})
                          </option>
                        ))}
                    </select>
                    {rooms.filter(room => room.status === 'available').length === 0 && (
                      <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#ef4444' }}>
                        No available rooms. Please check room status in Room Management.
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditSchedulePopup(false);
                        setScheduleToEdit(null);
                      }}
                      disabled={editingSchedule}
                      style={{
                        padding: '12px 24px',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editingSchedule}
                      style={{
                        padding: '12px 24px',
                        background: editingSchedule ? '#9ca3af' : 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: '600',
                        cursor: editingSchedule ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {editingSchedule ? 'Updating...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Conflict Resolution Modal */}
          <ConflictResolutionModal
            show={conflictDetails !== null}
            conflicts={conflictDetails}
            scheduleData={pendingScheduleData}
            onProceed={handleConflictProceed}
            onCancel={handleConflictCancel}
            onModify={handleConflictModify}
          />

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

          {/* Schedule Template Manager */}
          {/* Templates and Import UI removed */}
        </div>
      </main>
    </div>
  );
};

export default ScheduleManagementDetails;
