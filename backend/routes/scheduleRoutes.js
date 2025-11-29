import express from "express";
import Schedule from "../models/Schedule.js";
import ScheduleTemplate from "../models/ScheduleTemplate.js";
import InstructorNotification from "../models/InstructorNotification.js";
import Alert from '../models/Alert.js';
import validator from 'validator';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, isGoogleCalendarConfigured } from '../services/googleCalendarService.js';
import { logActivity } from '../utils/activityLogger.js';
import { detectAndEmitChange } from '../utils/dataChangeDetector.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { sendEmail, emailTemplates } from '../services/emailService.js';
import EmailNotification from '../models/EmailNotification.js';

const router = express.Router();

const DAY_START_MINUTES = 7 * 60;  // 7:00 AM
const DAY_END_MINUTES = 21 * 60;   // 9:00 PM

const timeStringToMinutes = (timeStr = '') => {
  if (!timeStr || typeof timeStr !== 'string') return -1;
  const [hhmm, ampm] = timeStr.trim().split(' ');
  if (!hhmm || !ampm) return -1;
  let [hours, minutes] = hhmm.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return -1;
  if (ampm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
  if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const minutesToTimeString = (totalMinutes) => {
  let minutes = Number(totalMinutes);
  if (Number.isNaN(minutes)) minutes = 0;
  const clamped = Math.max(DAY_START_MINUTES, Math.min(DAY_END_MINUTES, minutes));
  let hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${mins.toString().padStart(2, '0')} ${period}`;
};

const parseTimeRange = (timeRange = '') => {
  if (!timeRange || typeof timeRange !== 'string') return null;
  const [start, end] = timeRange.split('-').map(str => str.trim());
  if (!start || !end) return null;
  const startMinutes = timeStringToMinutes(start);
  const endMinutes = timeStringToMinutes(end);
  if (startMinutes === -1 || endMinutes === -1 || endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
};

const scheduleCoversDay = (scheduleDay = '', requestedDay = '') => {
  if (!scheduleDay || !requestedDay) return false;
  const normalize = (value) => value.toString().trim().toLowerCase();
  const normalizedRequested = normalize(requestedDay);
  return scheduleDay
    .toString()
    .split('/')
    .map(part => normalize(part))
    .includes(normalizedRequested);
};


// ============== GOOGLE CALENDAR SYNC HELPERS ==============

// Helper function to resolve instructor email from schedule
const resolveInstructorEmail = async (schedule) => {
  // If email already exists, use it
  if (schedule.instructorEmail) {
    return schedule.instructorEmail.trim().toLowerCase();
  }

  // Try to resolve from instructor name
  if (schedule.instructor) {
    const Instructor = (await import('../models/Instructor.js')).default;
    const instructorDoc = await Instructor.findOne({
      $or: [
        { email: { $regex: new RegExp('^' + validator.escape(schedule.instructor) + '$', 'i') } },
        { $expr: { $regexMatch: { input: { $concat: ['$firstname', ' ', '$lastname'] }, regex: schedule.instructor, options: 'i' } } }
      ],
      status: 'active'
    });
    
    if (instructorDoc && instructorDoc.email) {
      // Update the schedule with the resolved email
      schedule.instructorEmail = instructorDoc.email.toLowerCase();
      await schedule.save();
      return instructorDoc.email.toLowerCase();
    }
  }

  return null;
};

// Helper function to sync a single schedule to Google Calendar
const syncScheduleToCalendar = async (schedule) => {
  try {
    // Skip if already synced
    if (schedule.googleCalendarEventId) {
      return { success: true, message: 'Already synced', scheduleId: schedule._id };
    }

    // Resolve instructor email
    const instructorEmail = await resolveInstructorEmail(schedule);
    if (!instructorEmail) {
      return { success: false, message: 'Could not resolve instructor email', scheduleId: schedule._id };
    }

    // Verify instructor exists and is active
    const Instructor = (await import('../models/Instructor.js')).default;
    const instructorDoc = await Instructor.findOne({
      email: { $regex: new RegExp(`^${instructorEmail}$`, 'i') },
      status: 'active'
    });

    if (!instructorDoc) {
      return { success: false, message: 'Instructor not found or not active', scheduleId: schedule._id };
    }

    // Check if Google Calendar is configured
    if (!isGoogleCalendarConfigured()) {
      return { success: false, message: 'Google Calendar not configured', scheduleId: schedule._id };
    }

    // Create calendar event
    const eventId = await createCalendarEvent(schedule, instructorEmail);
    if (eventId) {
      schedule.googleCalendarEventId = eventId;
      await schedule.save();
      return { success: true, message: 'Synced successfully', scheduleId: schedule._id, eventId };
    }

    return { success: false, message: 'Failed to create calendar event', scheduleId: schedule._id };
  } catch (error) {
    console.error(`Error syncing schedule ${schedule._id}:`, error.message);
    return { success: false, message: error.message, scheduleId: schedule._id };
  }
};

// CREATE schedule
router.post("/create", async (req, res) => {
  try {
    const { course, year, section, subject, instructor, instructorEmail, day, time, room } = req.body;

    let instructorEmailFinal = instructorEmail ? String(instructorEmail).trim().toLowerCase() : undefined;
    let instructorNameFinal = instructor ? String(instructor).trim() : undefined;

    if (!course || !year || !section || !subject || !instructorNameFinal || !day || !time || !room) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Use email if available, else try to resolve from name
    if (!instructorEmailFinal && instructorNameFinal) {
      const Instructor = (await import('../models/Instructor.js')).default;
      const resolved = await Instructor.findOne({ 
        $or: [
          { email: { $regex: new RegExp('^'+validator.escape(instructorNameFinal)+'$', 'i') } },
          { $expr: { $regexMatch: { input: { $concat: ['$firstname', ' ', '$lastname'] }, regex: instructorNameFinal, options: 'i' } } }
        ],
        status: 'active'
      });
      instructorEmailFinal = resolved ? resolved.email.toLowerCase() : undefined;
    }

    // Conflict detection (room and instructor at same time/day)
    const [startStr, endStr] = String(time).split(' - ').map(s => s.trim());
    const toMinutes = (t) => {
      if (!t) return -1;
      const [hhmm, ampm] = t.split(' ');
      let [h, m] = hhmm.split(':').map(Number);
      let H = h;
      if (ampm?.toLowerCase() === 'pm' && h !== 12) H = h + 12;
      if (ampm?.toLowerCase() === 'am' && h === 12) H = 0;
      return (H * 60) + (m || 0);
    };
    const startMin = toMinutes(startStr);
    const endMin = toMinutes(endStr);
    if (startMin < 0 || endMin <= startMin) {
      return res.status(400).json({ success: false, message: 'Invalid time range' });
    }
    const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
    // Room conflicts
    const roomConflicts = await Schedule.find({ room, day }).lean();
    const hasRoomConflict = roomConflicts.some(s => {
      const [st, et] = String(s.time || '').split(' - ').map(x=>x.trim());
      const sMin = toMinutes(st), eMin = toMinutes(et);
      return overlaps(startMin, endMin, sMin, eMin);
    });
    if (hasRoomConflict) {
      return res.status(409).json({ success: false, message: `Room ${room} is occupied at ${day} ${time}` });
    }
    // Instructor conflicts
    const instructorConflicts = await Schedule.find({ instructor: instructorNameFinal, day }).lean();
    const hasInstructorConflict = instructorConflicts.some(s => {
      const [st, et] = String(s.time || '').split(' - ').map(x=>x.trim());
      const sMin = toMinutes(st), eMin = toMinutes(et);
      return overlaps(startMin, endMin, sMin, eMin);
    });
    if (hasInstructorConflict) {
      return res.status(409).json({ success: false, message: `${instructorNameFinal} already has a schedule at ${day} ${time}` });
    }

    const newSchedule = new Schedule({
      course, year, section, subject,
      instructor: instructorNameFinal,
      instructorEmail: instructorEmailFinal,
      day, time, room
    });

    await newSchedule.save();

    // Google Calendar integration - only for instructors
    // Use the sync helper function to ensure proper email resolution
    // Try sync even if email wasn't resolved initially, the helper will try to resolve it
    if (isGoogleCalendarConfigured()) {
      try {
        const syncResult = await syncScheduleToCalendar(newSchedule);
        if (syncResult.success) {
          console.log(`✅ Schedule ${newSchedule._id} synced to Google Calendar: ${syncResult.eventId}`);
        } else {
          console.warn(`⚠️ Failed to sync schedule ${newSchedule._id}: ${syncResult.message}`);
        }
      } catch (calendarError) {
        // Log error but don't fail the schedule creation
        console.error('⚠️ Failed to create Google Calendar event:', calendarError.message);
      }
    }

    // Create instructor-targeted notification if we can resolve an email
    try {
      let targetEmail = req.body.instructorEmail;
      if (!targetEmail) {
        // try to resolve by instructor name
        const Instructor = (await import('../models/Instructor.js')).default;
        const instructorDoc = await Instructor.findOne({
          $or: [
            { email: req.body.instructor },
            { $expr: { $regexMatch: { input: { $concat: ['$firstname', ' ', '$lastname'] }, regex: req.body.instructor, options: 'i' } } }
          ]
        });
        targetEmail = instructorDoc?.email;
      }
      if (targetEmail) {
        const notif = await InstructorNotification.create({
          instructorEmail: targetEmail,
          title: 'Schedule Update',
          message: `A new schedule was created for ${course} ${year} - ${section} (${subject})`,
          link: null
        });
        if (req.io) {
          // emit to all for simplicity; can be room-specific if you track rooms by email
          req.io.emit('instructor-notification', { email: targetEmail, notification: notif });
        }
      }
    } catch (e) {
      console.error('Failed to create instructor notification:', e);
    }

    // Send email notification if preferences allow
    if (instructorEmailFinal) {
      const preferences = await EmailNotification.findOne({ instructorEmail: instructorEmailFinal });
      if (preferences?.preferencesEnabled && preferences?.scheduleChanges) {
        const emailContent = emailTemplates.scheduleChange(instructorNameFinal, `${course} ${year} - ${section} (${subject}) on ${day} at ${time}`);
        await sendEmail(instructorEmailFinal, "New Schedule Created", emailContent);
      }
    }

    // Create and emit alert
    await logActivity({
      type: 'schedule-created',
      message: `New schedule created: ${subject} - ${course} ${year} Section ${section} (${instructorNameFinal}, ${day} ${time}, ${room})`,
      source: 'admin',
      link: `/admin/schedule/${course}/${year}`,
      meta: { course, year, section, subject, instructor: instructorNameFinal, day, time, room },
      io: req.io
    });

    res.json({ success: true, message: "Schedule created successfully!" });
  } catch (err) {
    console.error("Schedule creation error:", err);
    res.status(500).json({ success: false, message: "Server error while saving schedule." });
  }
});

// GET schedules filtered by course and year
router.get('/', async (req, res) => {
  try {
    const { course, year } = req.query;
    const schedules = await Schedule.find({ course, year });
    
    // Emit data change event if schedules have changed
    detectAndEmitChange('schedules', schedules, req.io, 'data-updated:schedules');
    
    res.json(schedules);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ message: 'Server error fetching schedules' });
  }
});

// GET all schedules (admin use) - returns all schedule documents
router.get('/all', async (req, res) => {
  try {
    const schedules = await Schedule.find({});
    
    // Emit data change event if schedules have changed
    detectAndEmitChange('schedules', schedules, req.io, 'data-updated:schedules');
    
    res.json(schedules);
  } catch (err) {
    console.error('Error fetching all schedules:', err);
    res.status(500).json({ message: 'Server error fetching schedules' });
  }
});

// SECURITY FIX: GET schedules filtered by authenticated instructor's email
// Only returns schedules for the logged-in instructor (from JWT token)
router.get('/instructor/:instructorEmail', verifyToken, async (req, res) => {
  try {
    // SECURITY: Use email from JWT token, not URL parameter
    const authenticatedEmail = req.userEmail?.toLowerCase().trim();
    const requestedEmail = req.params.instructorEmail?.toLowerCase().trim();
    
    // Verify that the requested email matches the authenticated user's email
    if (authenticatedEmail !== requestedEmail) {
      console.log('🚫 Security: Unauthorized schedule access attempt');
      console.log('   Authenticated:', authenticatedEmail);
      console.log('   Requested:', requestedEmail);
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized: You can only access your own schedules' 
      });
    }
    
    console.log('🔍 Backend: Fetching schedules for authenticated instructor:', authenticatedEmail);
    
    // Import Instructor model
    const Instructor = (await import('../models/Instructor.js')).default;
    
    // Step 1: Verify instructor exists (case-insensitive email)
    const instructor = await Instructor.findOne({ email: { $regex: new RegExp(`^${authenticatedEmail}$`, 'i') } });
    console.log('🔍 Backend: Instructor profile found:', instructor ? 'Yes' : 'No');
    
    const instructorName = instructor ? `${instructor.firstname} ${instructor.lastname}` : null;
    if (instructorName) {
      console.log('🔍 Backend: Instructor full name:', instructorName);
      console.log('🔍 Backend: Instructor status:', instructor.status);
    }
    
    // Step 2: Search strategies with detailed logging - CASE INSENSITIVE
    let schedules = [];
    let searchMethod = '';
    
    // Strategy 1: Search by email (case-insensitive)
    schedules = await Schedule.find({ instructorEmail: { $regex: new RegExp(`^${authenticatedEmail}$`, 'i') }, archived: { $ne: true } });
    console.log('🔍 Backend: Strategy 1 (case-insensitive email):', schedules.length, 'schedules');
    
    if (schedules.length > 0) {
      searchMethod = 'case-insensitive-email';
    } else if (instructorName) {
      // Strategy 2: Search by instructor name (case-insensitive)
      schedules = await Schedule.find({ instructor: { $regex: new RegExp(`^${instructorName}$`, 'i') }, archived: { $ne: true } });
      console.log('🔍 Backend: Strategy 2 (case-insensitive name):', schedules.length, 'schedules');
      
      if (schedules.length > 0) {
        searchMethod = 'case-insensitive-name';
      } else {
        // Strategy 3: Search by partial name matches
        schedules = await Schedule.find({ 
          instructor: { $regex: new RegExp(instructorName, 'i') },
          archived: { $ne: true }
        });
        console.log('🔍 Backend: Strategy 3 (partial name):', schedules.length, 'schedules');
        
        if (schedules.length > 0) {
          searchMethod = 'partial-name';
        }
      }
    }
    
    // Step 3: Debug information if no schedules found
    if (schedules.length === 0) {
      console.log('❌ Backend: No schedules found for instructor');
      
      // Return empty result (removed debug info for security)
      return res.json({
        schedules: []
      });
    }
    
    // Step 4: Success response with method used
    console.log('✅ Backend: Found', schedules.length, 'schedules using method:', searchMethod);
    
    res.json({
      schedules,
      debug: {
        searchMethod: searchMethod,
        instructorName: instructorName,
        schedulesFound: schedules.length
      }
    });
    
  } catch (err) {
    console.error('Error fetching schedules for instructor:', err);
    res.status(500).json({ 
      message: 'Server error fetching schedules for instructor',
      error: err.message 
    });
  }
});

// SECURITY FIX: GET schedules by instructor name - only for authenticated instructor
router.get('/instructor/by-name/:name', verifyToken, async (req, res) => {
  try {
    // SECURITY: Verify the requested name matches the authenticated instructor
    const authenticatedEmail = req.userEmail?.toLowerCase().trim();
    const requestedName = req.params.name?.trim();
    
    if (!requestedName) {
      return res.json({ schedules: [] });
    }
    
    // Import Instructor model to verify name matches authenticated user
    const Instructor = (await import('../models/Instructor.js')).default;
    const instructor = await Instructor.findOne({ 
      email: { $regex: new RegExp(`^${authenticatedEmail}$`, 'i') } 
    });
    
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }
    
    // Build full name from instructor record
    const instructorFullName = `${instructor.firstname} ${instructor.lastname}`.trim();
    
    // Verify requested name matches authenticated instructor's name
    if (!instructorFullName.toLowerCase().includes(requestedName.toLowerCase()) && 
        !requestedName.toLowerCase().includes(instructorFullName.toLowerCase())) {
      console.log('🚫 Security: Unauthorized schedule access by name');
      console.log('   Authenticated:', instructorFullName, `(${authenticatedEmail})`);
      console.log('   Requested:', requestedName);
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized: You can only access your own schedules' 
      });
    }
    
    // Search schedules by instructor name (case-insensitive)
    const regex = new RegExp(requestedName, 'i');
    const schedules = await Schedule.find({ instructor: regex, archived: { $ne: true } });
    
    // Additional security: Filter to ensure all schedules belong to authenticated instructor
    const filteredSchedules = schedules.filter(schedule => {
      const scheduleEmail = schedule.instructorEmail?.toLowerCase().trim();
      return scheduleEmail === authenticatedEmail || 
             schedule.instructor?.toLowerCase().includes(instructorFullName.toLowerCase());
    });
    
    res.json({ schedules: filteredSchedules });
  } catch (err) {
    console.error('Error fetching schedules by instructor name:', err);
    res.status(500).json({ message: 'Server error fetching schedules by name' });
  }
});

// UPDATE schedule
router.put('/:id', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { course, year, section, subject, instructor, instructorEmail, day, time, room, version } = req.body;

    // Find the existing schedule
    const existingSchedule = await Schedule.findById(scheduleId);
    if (!existingSchedule) {
      return res.status(404).json({ success: false, message: "Schedule not found." });
    }

    // MVCC Version check - if version is provided, validate it matches
    if (version !== undefined && version !== null) {
      if (existingSchedule.__v !== version) {
        return res.status(409).json({ 
          success: false, 
          message: "Schedule was modified by another user. Please refresh and try again.",
          currentVersion: existingSchedule.__v
        });
      }
    }

    let instructorEmailFinal = instructorEmail ? String(instructorEmail).trim().toLowerCase() : undefined;
    let instructorNameFinal = instructor ? String(instructor).trim() : undefined;

    if (!course || !year || !section || !subject || !instructorNameFinal || !day || !time || !room) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Resolve instructor email if not provided
    if (!instructorEmailFinal && instructorNameFinal) {
      const Instructor = (await import('../models/Instructor.js')).default;
      const resolved = await Instructor.findOne({ $or: [
        { email: { $regex: new RegExp('^'+validator.escape(instructorNameFinal)+'$', 'i') } },
        { $expr: { $regexMatch: { input: { $concat: ['$firstname', ' ', '$lastname'] }, regex: instructorNameFinal, options: 'i' } } }
      ]});
      instructorEmailFinal = resolved ? resolved.email.toLowerCase() : undefined;
    }

    // Conflict detection - EXCLUDE current schedule being edited
    const [startStr, endStr] = String(time).split(' - ').map(s => s.trim());
    const toMinutes = (t) => {
      if (!t) return -1;
      const [hhmm, ampm] = t.split(' ');
      let [h, m] = hhmm.split(':').map(Number);
      let H = h;
      if (ampm?.toLowerCase() === 'pm' && h !== 12) H = h + 12;
      if (ampm?.toLowerCase() === 'am' && h === 12) H = 0;
      return (H * 60) + (m || 0);
    };
    const startMin = toMinutes(startStr);
    const endMin = toMinutes(endStr);
    if (startMin < 0 || endMin <= startMin) {
      return res.status(400).json({ success: false, message: 'Invalid time range' });
    }
    const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
    
    // Room conflicts - exclude current schedule
    const roomConflicts = await Schedule.find({ 
      room, 
      day,
      _id: { $ne: scheduleId } // Exclude the schedule being edited
    }).lean();
    const hasRoomConflict = roomConflicts.some(s => {
      const [st, et] = String(s.time || '').split(' - ').map(x=>x.trim());
      const sMin = toMinutes(st), eMin = toMinutes(et);
      return overlaps(startMin, endMin, sMin, eMin);
    });
    if (hasRoomConflict) {
      return res.status(409).json({ success: false, message: `Room ${room} is occupied at ${day} ${time}` });
    }
    
    // Instructor conflicts - exclude current schedule
    const instructorConflicts = await Schedule.find({ 
      instructor: instructorNameFinal, 
      day,
      _id: { $ne: scheduleId } // Exclude the schedule being edited
    }).lean();
    const hasInstructorConflict = instructorConflicts.some(s => {
      const [st, et] = String(s.time || '').split(' - ').map(x=>x.trim());
      const sMin = toMinutes(st), eMin = toMinutes(et);
      return overlaps(startMin, endMin, sMin, eMin);
    });
    if (hasInstructorConflict) {
      return res.status(409).json({ success: false, message: `${instructorNameFinal} already has a schedule at ${day} ${time}` });
    }

    // Store old values for notification comparison
    const oldInstructor = existingSchedule.instructor;
    const oldInstructorEmail = existingSchedule.instructorEmail;
    const oldEventId = existingSchedule.googleCalendarEventId;

    // Update the schedule
    existingSchedule.course = course;
    existingSchedule.year = year;
    existingSchedule.section = section;
    existingSchedule.subject = subject;
    existingSchedule.instructor = instructorNameFinal;
    existingSchedule.instructorEmail = instructorEmailFinal;
    existingSchedule.day = day;
    existingSchedule.time = time;
    existingSchedule.room = room;

    await existingSchedule.save();

    // Google Calendar integration - only for instructors
    if (isGoogleCalendarConfigured()) {
      try {
        // If instructor changed, delete old event
        if (oldInstructorEmail !== instructorEmailFinal && oldEventId && oldInstructorEmail) {
          try {
            await deleteCalendarEvent(oldEventId, oldInstructorEmail);
            existingSchedule.googleCalendarEventId = undefined;
          } catch (deleteError) {
            console.error('⚠️ Failed to delete old Google Calendar event:', deleteError.message);
          }
        }
        
        // Use sync helper to handle email resolution and event creation/update
        if (existingSchedule.googleCalendarEventId && oldInstructorEmail === instructorEmailFinal) {
          // Try to update existing event if instructor hasn't changed
          try {
            const instructorEmail = await resolveInstructorEmail(existingSchedule);
            if (instructorEmail) {
              await updateCalendarEvent(existingSchedule.googleCalendarEventId, existingSchedule, instructorEmail);
              console.log(`✅ Updated Google Calendar event for schedule ${existingSchedule._id}`);
            }
          } catch (updateError) {
            console.error('⚠️ Failed to update Google Calendar event, will re-sync:', updateError.message);
            // If update fails, clear the event ID and let sync recreate it
            existingSchedule.googleCalendarEventId = undefined;
            const syncResult = await syncScheduleToCalendar(existingSchedule);
            if (syncResult.success) {
              console.log(`✅ Re-synced schedule ${existingSchedule._id} to Google Calendar`);
            }
          }
        } else {
          // Create new event or re-sync
          const syncResult = await syncScheduleToCalendar(existingSchedule);
          if (syncResult.success) {
            console.log(`✅ Schedule ${existingSchedule._id} synced to Google Calendar: ${syncResult.eventId}`);
          } else {
            console.warn(`⚠️ Failed to sync schedule ${existingSchedule._id}: ${syncResult.message}`);
          }
        }
      } catch (calendarError) {
        // Log error but don't fail the schedule update
        console.error('⚠️ Failed to sync Google Calendar event:', calendarError.message);
      }
    } else if (oldEventId && oldInstructorEmail) {
      // If Google Calendar was enabled before but is now disabled, delete old event
      try {
        await deleteCalendarEvent(oldEventId, oldInstructorEmail);
        existingSchedule.googleCalendarEventId = undefined;
        await existingSchedule.save();
      } catch (deleteError) {
        console.error('⚠️ Failed to delete Google Calendar event:', deleteError.message);
      }
    }

    // Send notification to instructor (new or changed)
    try {
      let targetEmail = instructorEmailFinal;
      if (!targetEmail) {
        const Instructor = (await import('../models/Instructor.js')).default;
        const instructorDoc = await Instructor.findOne({
          $or: [
            { email: instructorNameFinal },
            { $expr: { $regexMatch: { input: { $concat: ['$firstname', ' ', '$lastname'] }, regex: instructorNameFinal, options: 'i' } } }
          ]
        });
        targetEmail = instructorDoc?.email;
      }
      
      if (targetEmail) {
        const notif = await InstructorNotification.create({
          instructorEmail: targetEmail,
          title: 'Schedule Updated',
          message: `Your schedule for ${course} ${year} - ${section} (${subject}) has been updated`,
          link: null
        });
        if (req.io) {
          req.io.emit('instructor-notification', { email: targetEmail, notification: notif });
        }
      }

      // If instructor changed, notify the old instructor too
      if (oldInstructor !== instructorNameFinal && oldInstructorEmail) {
        const oldNotif = await InstructorNotification.create({
          instructorEmail: oldInstructorEmail,
          title: 'Schedule Removed',
          message: `You have been removed from ${course} ${year} - ${section} (${subject})`,
          link: null
        });
        if (req.io) {
          req.io.emit('instructor-notification', { email: oldInstructorEmail, notification: oldNotif });
        }
      }
    } catch (e) {
      console.error('Failed to create instructor notification:', e);
    }

    // Send email notification if preferences allow
    if (instructorEmailFinal) {
      const preferences = await EmailNotification.findOne({ instructorEmail: instructorEmailFinal });
      if (preferences?.preferencesEnabled && preferences?.scheduleChanges) {
        const emailContent = emailTemplates.scheduleChange(instructorNameFinal, `${course} ${year} - ${section} (${subject}) on ${day} at ${time}`);
        await sendEmail(instructorEmailFinal, "Schedule Updated", emailContent);
      }
    }

    // Create activity log
    const changes = [];
    if (existingSchedule.course !== course) changes.push(`course: ${existingSchedule.course} → ${course}`);
    if (existingSchedule.year !== year) changes.push(`year: ${existingSchedule.year} → ${year}`);
    if (existingSchedule.section !== section) changes.push(`section: ${existingSchedule.section} → ${section}`);
    if (existingSchedule.subject !== subject) changes.push(`subject: ${existingSchedule.subject} → ${subject}`);
    if (existingSchedule.instructor !== instructorNameFinal) changes.push(`instructor: ${existingSchedule.instructor} → ${instructorNameFinal}`);
    if (existingSchedule.day !== day) changes.push(`day: ${existingSchedule.day} → ${day}`);
    if (existingSchedule.time !== time) changes.push(`time: ${existingSchedule.time} → ${time}`);
    if (existingSchedule.room !== room) changes.push(`room: ${existingSchedule.room} → ${room}`);
    
    await logActivity({
      type: 'schedule-updated',
      message: `Schedule updated: ${subject} - ${course} ${year} Section ${section}${changes.length > 0 ? ` (${changes.join(', ')})` : ''}`,
      source: 'admin',
      link: `/admin/schedule/${course}/${year}`,
      meta: { scheduleId: scheduleId, changes, course, year, section, subject },
      io: req.io
    });

    res.json({ success: true, message: "Schedule updated successfully!" });
  } catch (err) {
    console.error("Schedule update error:", err);
    res.status(500).json({ success: false, message: "Server error while updating schedule." });
  }
});

// DELETE schedule
router.delete('/:id', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const scheduleToDelete = await Schedule.findById(scheduleId);
    
    if (!scheduleToDelete) {
      return res.status(404).json({ success: false, message: "Schedule not found." });
    }
    
    // Google Calendar integration - delete event if it exists
    if (scheduleToDelete.googleCalendarEventId && scheduleToDelete.instructorEmail && isGoogleCalendarConfigured()) {
      try {
        // Verify that the email belongs to an instructor before deleting
        const Instructor = (await import('../models/Instructor.js')).default;
        const instructorDoc = await Instructor.findOne({ 
          email: { $regex: new RegExp(`^${scheduleToDelete.instructorEmail}$`, 'i') },
          status: 'active'
        });
        
        if (instructorDoc) {
          await deleteCalendarEvent(scheduleToDelete.googleCalendarEventId, scheduleToDelete.instructorEmail);
        }
      } catch (calendarError) {
        // Log error but continue with schedule deletion
        console.error('⚠️ Failed to delete Google Calendar event:', calendarError.message);
      }
    }
    
    // Delete the schedule
    await Schedule.findByIdAndDelete(scheduleId);
    
    await logActivity({
      type: 'schedule-deleted',
      message: `Schedule deleted: ${scheduleToDelete.subject} - ${scheduleToDelete.course} ${scheduleToDelete.year} Section ${scheduleToDelete.section} (${scheduleToDelete.instructor}, ${scheduleToDelete.day} ${scheduleToDelete.time}, ${scheduleToDelete.room})`,
      source: 'admin',
      link: `/admin/schedule/${scheduleToDelete.course || ''}/${scheduleToDelete.year || ''}`,
      meta: { 
        course: scheduleToDelete.course, 
        year: scheduleToDelete.year, 
        section: scheduleToDelete.section, 
        subject: scheduleToDelete.subject,
        instructor: scheduleToDelete.instructor,
        day: scheduleToDelete.day,
        time: scheduleToDelete.time,
        room: scheduleToDelete.room
      },
      io: req.io
    });
    res.json({ success: true, message: "Schedule deleted successfully." });
  } catch (err) {
    console.error("Error deleting schedule:", err);
    res.status(500).json({ success: false, message: "Server error deleting schedule." });
  }
});

// ARCHIVE schedule (mark archived=true but keep record)
router.post('/:id/archive', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    // If there's a Google Calendar event, try to delete it
    if (schedule.googleCalendarEventId && schedule.instructorEmail && isGoogleCalendarConfigured()) {
      try {
        const Instructor = (await import('../models/Instructor.js')).default;
        const instructorDoc = await Instructor.findOne({ email: { $regex: new RegExp(`^${schedule.instructorEmail}$`, 'i') }, status: 'active' });
        if (instructorDoc) {
          await deleteCalendarEvent(schedule.googleCalendarEventId, schedule.instructorEmail);
          schedule.googleCalendarEventId = undefined;
        }
      } catch (err) {
        console.error('Warning: failed to delete linked Google Calendar event during archive:', err.message);
      }
    }

    schedule.archived = true;
    await schedule.save();

    await logActivity({
      type: 'schedule-archived',
      message: `Schedule archived: ${schedule.subject} - ${schedule.course} ${schedule.year} Section ${schedule.section} (${schedule.instructor}, ${schedule.day} ${schedule.time}, ${schedule.room})`,
      source: 'admin',
      link: `/admin/schedule/${schedule.course || ''}/${schedule.year || ''}`,
      meta: { scheduleId: schedule._id, course: schedule.course, year: schedule.year, section: schedule.section, subject: schedule.subject },
      io: req.io
    });

    res.json({ success: true, message: 'Schedule archived successfully.' });
  } catch (err) {
    console.error('Error archiving schedule:', err);
    res.status(500).json({ success: false, message: 'Server error archiving schedule.' });
  }
});

// Get available time slots for adding schedules
router.get('/availability', async (req, res) => {
  try {
    const { day, course, year, section, instructor, room } = req.query;
    if (!day) {
      return res.status(400).json({ success: false, message: 'Day parameter is required.' });
    }

    const dayRegex = new RegExp(day, 'i');
    const daySchedules = await Schedule.find({
      day: { $regex: dayRegex },
      archived: { $ne: true },
    }).lean();

    const hasSectionFilter = Boolean(course && year && section);
    const hasInstructorFilter = Boolean(instructor);
    const hasRoomFilter = Boolean(room);
    const normalize = (value) => value?.toString().trim().toLowerCase();

    const relevantSchedules = daySchedules.filter((sched) => {
      if (!scheduleCoversDay(sched.day, day)) return false;
      const matchesSection =
        hasSectionFilter &&
        normalize(sched.course) === normalize(course) &&
        normalize(sched.year) === normalize(year) &&
        normalize(sched.section) === normalize(section);
      const matchesInstructor =
        hasInstructorFilter && normalize(sched.instructor) === normalize(instructor);
      const matchesRoom = hasRoomFilter && normalize(sched.room) === normalize(room);

      if (hasSectionFilter || hasInstructorFilter || hasRoomFilter) {
        return matchesSection || matchesInstructor || matchesRoom;
      }
      return true;
    });

    const busyIntervals = relevantSchedules
      .map((schedule) => parseTimeRange(schedule.time))
      .filter(Boolean)
      .map(({ startMinutes, endMinutes }) => ({
        start: Math.max(DAY_START_MINUTES, startMinutes),
        end: Math.min(DAY_END_MINUTES, endMinutes),
      }))
      .filter((interval) => interval.end > interval.start)
      .sort((a, b) => a.start - b.start);

    const merged = [];
    for (const interval of busyIntervals) {
      if (!merged.length || interval.start > merged[merged.length - 1].end) {
        merged.push({ ...interval });
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, interval.end);
      }
    }

    const availability = [];
    let cursor = DAY_START_MINUTES;
    merged.forEach((interval) => {
      if (interval.start > cursor) {
        availability.push({ start: cursor, end: interval.start });
      }
      cursor = Math.max(cursor, interval.end);
    });
    if (cursor < DAY_END_MINUTES) {
      availability.push({ start: cursor, end: DAY_END_MINUTES });
    }

    res.json({
      success: true,
      day,
      filters: { course, year, section, instructor, room },
      availability: availability.map((slot) => ({
        start: minutesToTimeString(slot.start),
        end: minutesToTimeString(slot.end),
      })),
      busy: merged.map((slot) => ({
        start: minutesToTimeString(slot.start),
        end: minutesToTimeString(slot.end),
      })),
    });
  } catch (error) {
    console.error('Error fetching available time slots:', error);
    res.status(500).json({ success: false, message: 'Failed to load available time slots.' });
  }
});

// GET archived schedules (admin)
router.get('/archived', async (req, res) => {
  try {
    const archived = await Schedule.find({ archived: true });
    res.json({ success: true, schedules: archived });
  } catch (err) {
    console.error('Error fetching archived schedules:', err);
    res.status(500).json({ success: false, message: 'Server error fetching archived schedules.' });
  }
});

// RESTORE schedule (mark archived=false)
router.post('/:id/restore', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    schedule.archived = false;
    await schedule.save();

    // Optionally re-sync to Google Calendar if configured
    if (isGoogleCalendarConfigured()) {
      try {
        const syncResult = await syncScheduleToCalendar(schedule);
        if (!syncResult.success) {
          console.warn('Warn: failed to re-sync schedule on restore:', syncResult.message);
        }
      } catch (syncErr) {
        console.error('Error re-syncing schedule after restore:', syncErr.message);
      }
    }

    await logActivity({
      type: 'schedule-restored',
      message: `Schedule restored: ${schedule.subject} - ${schedule.course} ${schedule.year} Section ${schedule.section} (${schedule.instructor}, ${schedule.day} ${schedule.time}, ${schedule.room})`,
      source: 'admin',
      link: `/admin/schedule/${schedule.course || ''}/${schedule.year || ''}`,
      meta: { scheduleId: schedule._id },
      io: req.io
    });

    res.json({ success: true, message: 'Schedule restored successfully.' });
  } catch (err) {
    console.error('Error restoring schedule:', err);
    res.status(500).json({ success: false, message: 'Server error restoring schedule.' });
  }
});

// DEBUG: Admin endpoint to check and fix schedule data
router.get('/debug/instructor-matching', async (req, res) => {
  try {
    const Instructor = (await import('../models/Instructor.js')).default;
    
    // Get all schedules and instructors
    const [allSchedules, allInstructors] = await Promise.all([
      Schedule.find({}).select('instructor instructorEmail course year section subject'),
      Instructor.find({ status: 'active' }).select('firstname lastname email')
    ]);
    
    // Analysis
    const analysis = {
      totalSchedules: allSchedules.length,
      totalInstructors: allInstructors.length,
      schedulesWithEmail: allSchedules.filter(s => s.instructorEmail).length,
      schedulesWithoutEmail: allSchedules.filter(s => !s.instructorEmail).length,
      uniqueInstructorNames: [...new Set(allSchedules.map(s => s.instructor))],
      instructorEmailMapping: {},
      matchingIssues: [],
      fixableSchedules: []
    };
    
    // Create instructor name to email mapping
    allInstructors.forEach(instructor => {
      const fullName = `${instructor.firstname} ${instructor.lastname}`;
      analysis.instructorEmailMapping[fullName] = instructor.email;
    });
    
    // Check for matching issues
    allSchedules.forEach(schedule => {
      const expectedEmail = analysis.instructorEmailMapping[schedule.instructor];
      
      if (!schedule.instructorEmail && expectedEmail) {
        // Schedule missing email but we can fix it
        analysis.fixableSchedules.push({
          scheduleId: schedule._id,
          instructor: schedule.instructor,
          missingEmail: expectedEmail,
          course: `${schedule.course} ${schedule.year} - ${schedule.section}`,
          subject: schedule.subject
        });
      } else if (!expectedEmail) {
        // Instructor name in schedule doesn't match any active instructor
        analysis.matchingIssues.push({
          scheduleInstructor: schedule.instructor,
          issue: 'No matching active instructor found',
          course: `${schedule.course} ${schedule.year} - ${schedule.section}`,
          subject: schedule.subject
        });
      }
    });
    
    res.json(analysis);
  } catch (err) {
    console.error('Debug endpoint error:', err);
    res.status(500).json({ message: 'Error analyzing schedule data', error: err.message });
  }
});

// ADMIN: Fix missing instructor emails in schedules
router.post('/admin/fix-instructor-emails', async (req, res) => {
  try {
    const Instructor = (await import('../models/Instructor.js')).default;
    
    // Get all schedules missing email data
    const schedulesToFix = await Schedule.find({ 
      $or: [
        { instructorEmail: { $exists: false } },
        { instructorEmail: null },
        { instructorEmail: '' }
      ]
    });
    
    // Get all active instructors
    const activeInstructors = await Instructor.find({ status: 'active' })
      .select('firstname lastname email');
    
    // Create name to email mapping
    const nameToEmailMap = {};
    activeInstructors.forEach(instructor => {
      const fullName = `${instructor.firstname} ${instructor.lastname}`;
      nameToEmailMap[fullName] = instructor.email;
    });
    
    const results = {
      totalSchedulesToCheck: schedulesToFix.length,
      fixed: 0,
      skipped: 0,
      fixedSchedules: []
    };
    
    // Fix schedules
    for (const schedule of schedulesToFix) {
      const expectedEmail = nameToEmailMap[schedule.instructor];
      
      if (expectedEmail) {
        await Schedule.findByIdAndUpdate(schedule._id, {
          instructorEmail: expectedEmail
        });
        
        results.fixed++;
        results.fixedSchedules.push({
          scheduleId: schedule._id,
          instructor: schedule.instructor,
          addedEmail: expectedEmail,
          course: `${schedule.course} ${schedule.year} - ${schedule.section}`
        });
      } else {
        results.skipped++;
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${results.fixed} schedules, skipped ${results.skipped}`,
      details: results
    });
    
  } catch (err) {
    console.error('Fix endpoint error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error fixing schedule data', 
      error: err.message 
    });
  }
});

// ============== SCHEDULE TEMPLATES ==============

// GET all templates for a course/year
router.get('/templates', async (req, res) => {
  try {
    const { course, year } = req.query;
    const query = {};
    if (course) query.course = course;
    if (year) query.year = year;
    
    const templates = await ScheduleTemplate.find(query).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ success: false, message: 'Error fetching templates' });
  }
});

// GET single template by ID
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ success: false, message: 'Error fetching template' });
  }
});

// POST create new template
router.post('/templates', async (req, res) => {
  try {
    const { name, description, course, year, schedules } = req.body;
    
    if (!name || !course || !year || !schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const template = new ScheduleTemplate({
      name,
      description: description || '',
      course,
      year,
      schedules,
      createdBy: 'admin'
    });
    
    await template.save();
    res.json({ success: true, template, message: 'Template saved successfully' });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ success: false, message: 'Error creating template' });
  }
});

// DELETE template
router.delete('/templates/:id', async (req, res) => {
  try {
    const template = await ScheduleTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ success: false, message: 'Error deleting template' });
  }
});

// POST apply template to section (creates schedules from template)
router.post('/templates/:id/apply', async (req, res) => {
  try {
    const { section } = req.body;
    const template = await ScheduleTemplate.findById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    
    if (!section) {
      return res.status(400).json({ success: false, message: 'Section is required' });
    }
    
    const createdSchedules = [];
    const errors = [];
    
    // Create schedules from template
    for (const scheduleData of template.schedules) {
      try {
        const schedule = new Schedule({
          course: template.course,
          year: template.year,
          section,
          subject: scheduleData.subject,
          instructor: scheduleData.instructor,
          instructorEmail: scheduleData.instructorEmail,
          day: scheduleData.day,
          time: scheduleData.time,
          room: scheduleData.room,
        });
        await schedule.save();
        createdSchedules.push(schedule);
      } catch (err) {
        errors.push({ schedule: scheduleData, error: err.message });
      }
    }
    
    res.json({
      success: true,
      message: `Applied template: ${createdSchedules.length} schedules created`,
      created: createdSchedules.length,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (err) {
    console.error('Error applying template:', err);
    res.status(500).json({ success: false, message: 'Error applying template' });
  }
});

// ============== GOOGLE CALENDAR SYNC ENDPOINTS ==============

// POST /api/schedule/sync-all - Sync all existing schedules to Google Calendar
router.post('/sync-all', async (req, res) => {
  try {
    if (!isGoogleCalendarConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Google Calendar is not configured. Please configure Google Calendar first.'
      });
    }

    // Get all schedules that don't have googleCalendarEventId
    const unsyncedSchedules = await Schedule.find({
      $or: [
        { googleCalendarEventId: { $exists: false } },
        { googleCalendarEventId: null },
        { googleCalendarEventId: '' }
      ]
    });

    if (unsyncedSchedules.length === 0) {
      return res.json({
        success: true,
        message: 'All schedules are already synced',
        total: 0,
        synced: 0,
        failed: 0,
        results: []
      });
    }

    const results = [];
    let syncedCount = 0;
    let failedCount = 0;

    // Sync schedules one by one (with a small delay to avoid rate limiting)
    for (const schedule of unsyncedSchedules) {
      const result = await syncScheduleToCalendar(schedule);
      results.push(result);
      
      if (result.success) {
        syncedCount++;
      } else {
        failedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      message: `Sync completed. ${syncedCount} synced, ${failedCount} failed.`,
      total: unsyncedSchedules.length,
      synced: syncedCount,
      failed: failedCount,
      results: results
    });

  } catch (error) {
    console.error('Error syncing all schedules:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing schedules',
      error: error.message
    });
  }
});

// POST /api/schedule/:id/sync - Sync a single schedule to Google Calendar
router.post('/:id/sync', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedule = await Schedule.findById(scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found'
      });
    }

    if (!isGoogleCalendarConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Google Calendar is not configured'
      });
    }

    const result = await syncScheduleToCalendar(schedule);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        scheduleId: result.scheduleId,
        eventId: result.eventId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        scheduleId: result.scheduleId
      });
    }

  } catch (error) {
    console.error('Error syncing schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing schedule',
      error: error.message
    });
  }
});

export default router;
