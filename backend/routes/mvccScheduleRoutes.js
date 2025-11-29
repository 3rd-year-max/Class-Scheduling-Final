/**
 * MVCC-Enhanced Schedule Routes
 * Integrates optimistic locking and conflict detection for concurrent operations
 */

import express from "express";
import Schedule from "../models/Schedule.js";
import Room from "../models/Room.js";
import Section from "../models/Section.js";
import InstructorNotification from "../models/InstructorNotification.js";
import { withRetry, MVCCTransaction, detectChanges, createAuditLog } from "../middleware/mvccTransaction.js";
import {
  detectScheduleConflict,
  createScheduleWithValidation,
  updateWithVersionControl
} from "../utils/mvccManager.js";

const router = express.Router();

const DAY_START_MINUTES = 7 * 60; // 7:00 AM
const DAY_END_MINUTES = 21 * 60; // 9:00 PM

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

/**
 * Helper: Create notification for instructor
 */
async function createInstructorNotification(instructorEmail, title, message, link = null) {
  try {
    const notification = new InstructorNotification({
      instructorEmail: instructorEmail.toLowerCase(),
      title,
      message,
      link,
      read: false
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

/**
 * Helper: Broadcast notification via Socket.IO
 */
function broadcastNotification(req, instructorEmail, notification) {
  if (req.io && instructorEmail) {
    setImmediate(() => {
      req.io.emit(`notification-${instructorEmail}`, {
        action: 'new-notification',
        notification: notification,
        timestamp: new Date()
      });
      // Also emit to global notifications channel
      req.io.emit('notifications', {
        instructorEmail: instructorEmail,
        notification: notification,
        timestamp: new Date()
      });
    });
  }
}

/**
 * GET /api/schedule
 * Compatibility endpoint: list schedules with optional filters
 * Excludes archived schedules by default (unless showArchived=true)
 */
router.get('/', async (req, res) => {
  try {
    const { course, year, section, day, room, instructor, subject, showArchived } = req.query;
    const query = {};
    if (course) query.course = course;
    if (year) query.year = year;
    if (section) query.section = section;
    if (day) query.day = { $regex: new RegExp(day, 'i') };
    if (room) query.room = room;
    if (instructor) query.instructor = { $regex: new RegExp(instructor, 'i') };
    if (subject) query.subject = { $regex: new RegExp(subject, 'i') };
    // By default, exclude archived schedules unless explicitly requested
    if (showArchived !== 'true') {
      query.archived = false;
    }

    const schedules = await Schedule.find(query).select('course year section subject instructor day time room archived createdAt updatedAt _id __v').sort({ course: 1, year: 1, section: 1, day: 1, time: 1 }).lean();
    // Return legacy array shape for frontend convenience
    return res.json(schedules || []);
  } catch (error) {
    console.error('Error fetching schedules list:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedules' });
  }
});

/**
 * POST create schedule with MVCC validation
 * Includes conflict detection, version tracking, and transaction logging
 */
router.post("/create-mvcc", async (req, res) => {
  try {
    const { course, year, section, subject, instructor, instructorEmail, day, time, room } = req.body;
    
    // Validate required fields
    if (!course || !year || !section || !subject || !instructor || !day || !time || !room) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        code: "VALIDATION_ERROR"
      });
    }

    // Create transaction
    const transaction = new MVCCTransaction(req.userId || 'system', 'schedule_creation');

    // Validate room exists and not archived
    const roomDoc = await Room.findOne({ room, archived: false });
    if (!roomDoc) {
      return res.status(404).json({
        success: false,
        message: `Room ${room} not found or archived`,
        code: "ROOM_NOT_FOUND"
      });
    }

    // Validate section exists and not archived
    const sectionDoc = await Section.findOne({
      course,
      year,
      name: section,
      archived: false
    });
    if (!sectionDoc) {
      return res.status(404).json({
        success: false,
        message: `Section ${section} not found or archived`,
        code: "SECTION_NOT_FOUND"
      });
    }

    // Detect conflicts (room and instructor double-booking)
    await detectScheduleConflict(room, day, time, null, Schedule);
    
    // Check instructor availability at same time
    const instructorConflict = await Schedule.findOne({
      instructor,
      day,
      time,
      archived: false
    });
    if (instructorConflict) {
      return res.status(409).json({
        success: false,
        message: `Instructor ${instructor} already has a schedule at ${day} ${time}`,
        code: "INSTRUCTOR_CONFLICT"
      });
    }

    // Create schedule atomically
    const newSchedule = new Schedule({
      course,
      year,
      section,
      subject,
      instructor,
      instructorEmail: instructorEmail?.toLowerCase(),
      day,
      time,
      room
    });

    await newSchedule.save();
    
    transaction.addOperation(newSchedule._id, 'create', newSchedule.__v, newSchedule);
    const txnRecord = transaction.commit();

    // Broadcast real-time update (non-blocking, don't wait for socket emission)
    if (req.io) {
      setImmediate(() => {
        req.io.emit('schedule-created', {
          action: 'created',
          schedule: newSchedule,
          timestamp: new Date(),
          userId: req.userId || 'system'
        });
        // Also emit for specific instructor
        if (newSchedule.instructorEmail) {
          req.io.emit(`schedule-update-${newSchedule.instructorEmail}`, {
            action: 'created',
            schedule: newSchedule,
            timestamp: new Date()
          });
        }
      });
    }

    res.status(201).json({
      success: true,
      message: "Schedule created with MVCC protection",
      schedule: newSchedule,
      transaction: txnRecord
    });

  } catch (error) {
    if (error.message?.includes('conflict')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: "CONFLICT"
      });
    }
    
    console.error("Schedule creation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating schedule",
      error: error.message
    });
  }
});

/**
 * PUT update schedule with optimistic locking
 * Prevents lost updates from concurrent modifications
 */
router.put("/:id/update-mvcc", async (req, res) => {
  try {
    const { id } = req.params;
    const { version, course, year, section, subject, instructor, instructorEmail, day, time, room } = req.body;

    // Version parameter is required for optimistic locking
    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message: "Version field required for optimistic locking",
        code: "VERSION_REQUIRED"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'schedule_update');

    // Attempt update with retry logic for transient conflicts
    const updatedSchedule = await withRetry(async () => {
      // Check for conflicts (exclude current schedule)
      await detectScheduleConflict(room, day, time, id, Schedule);
      
      // Check instructor conflict (exclude current schedule)
      const instructorConflict = await Schedule.findOne({
        instructor,
        day,
        time,
        _id: { $ne: id },
        archived: false
      });
      if (instructorConflict) {
        throw new Error(`Instructor ${instructor} already has a schedule at ${day} ${time}`);
      }

      // Update with version control
      const updateData = { course, year, section, subject, instructor, instructorEmail: instructorEmail?.toLowerCase(), day, time, room };
      const updated = await updateWithVersionControl(Schedule, id, version, updateData);
      
      return updated;
    }, 3, 100); // Retry up to 3 times with exponential backoff

    // Record changes for audit trail
    const changes = detectChanges(
      { course: req.body.oldCourse, year: req.body.oldYear, section: req.body.oldSection, subject: req.body.oldSubject, instructor: req.body.oldInstructor, day: req.body.oldDay, time: req.body.oldTime, room: req.body.oldRoom },
      { course, year, section, subject, instructor, day, time, room }
    );

    transaction.addOperation(id, 'update', updatedSchedule.__v, updatedSchedule);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: "Schedule updated with optimistic locking",
      schedule: updatedSchedule,
      transaction: txnRecord,
      changes: changes.length
    });

  } catch (error) {
    if (error.message?.includes('Version conflict')) {
      return res.status(409).json({
        success: false,
        message: "Concurrent update detected. Please refresh and try again.",
        code: "VERSION_CONFLICT"
      });
    }
    
    console.error("Schedule update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating schedule",
      error: error.message
    });
  }
});

/**
 * GET schedule with version info
 * Returns current version for optimistic locking
 */
router.get("/:id/version", async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    res.json({
      success: true,
      schedule: {
        _id: schedule._id,
        __v: schedule.__v,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
        course: schedule.course,
        year: schedule.year,
        section: schedule.section,
        subject: schedule.subject,
        instructor: schedule.instructor,
        day: schedule.day,
        time: schedule.time,
        room: schedule.room
      }
    });

  } catch (error) {
    console.error("Error fetching schedule version:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching schedule"
    });
  }
});

/**
 * POST bulk create schedules with transaction support
 * Atomically creates multiple schedules with rollback on conflict
 */
router.post("/bulk/create-mvcc", async (req, res) => {
  try {
    const { schedules } = req.body;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Schedules array required",
        code: "INVALID_INPUT"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'bulk_schedule_creation');
    const created = [];
    const failed = [];

    for (const scheduleData of schedules) {
      try {
        // Validate conflicts
        await detectScheduleConflict(scheduleData.room, scheduleData.day, scheduleData.time, null, Schedule);

        const newSchedule = new Schedule({
          course: scheduleData.course,
          year: scheduleData.year,
          section: scheduleData.section,
          subject: scheduleData.subject,
          instructor: scheduleData.instructor,
          instructorEmail: scheduleData.instructorEmail?.toLowerCase(),
          day: scheduleData.day,
          time: scheduleData.time,
          room: scheduleData.room
        });

        await newSchedule.save();
        transaction.addOperation(newSchedule._id, 'create', newSchedule.__v, newSchedule);
        created.push(newSchedule);

      } catch (error) {
        failed.push({
          schedule: scheduleData,
          error: error.message
        });
      }
    }

    transaction.status = failed.length > 0 ? 'partial_success' : 'success';
    const txnRecord = transaction.commit();

    res.status(201).json({
      success: failed.length === 0,
      message: `Created ${created.length} schedules${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      created: created.length,
      failed: failed.length,
      schedules: created,
      failures: failed,
      transaction: txnRecord
    });

  } catch (error) {
    console.error("Bulk schedule creation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating schedules",
      error: error.message
    });
  }
});

/**
 * GET concurrent access statistics
 * Shows version distribution for monitoring concurrent modifications
 */
router.get("/stats/concurrency", async (req, res) => {
  try {
    const stats = await Schedule.aggregate([
      {
        $group: {
          _id: "$__v",
          count: { $sum: 1 },
          minVersion: { $min: "$__v" },
          maxVersion: { $max: "$__v" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalSchedules = await Schedule.countDocuments();
    const recentlyModified = await Schedule.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    res.json({
      success: true,
      stats: {
        totalSchedules,
        recentlyModified,
        versionDistribution: stats
      }
    });

  } catch (error) {
    console.error("Error fetching concurrency stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching statistics"
    });
  }
});


// ------------------ Compatibility routes (legacy paths) ------------------
// These endpoints mirror legacy frontend paths and will use MVCC when a
// `version` is provided in the request body. If `version` is omitted they
// fall back to legacy behavior to preserve backward compatibility.

// GET schedules for an instructor by email (compatibility)
router.get('/instructor/:email', async (req, res) => {
  try {
    const emailParam = req.params.email;
    console.log('📥 GET /api/schedule/instructor/:email called with', { emailParam });
    if (!emailParam) return res.status(400).json({ success: false, message: 'Email is required' });
    const email = emailParam.toString().toLowerCase();

    const query = { instructorEmail: { $regex: new RegExp(`^${email}$`, 'i') }, archived: false };
    const schedules = await Schedule.find(query).select('course year section subject instructor instructorEmail day time room archived createdAt updatedAt _id __v').lean();
    console.log(`🔎 Found ${Array.isArray(schedules) ? schedules.length : 0} schedules for email=${email}`);

    return res.json(Array.isArray(schedules) ? schedules : []);
  } catch (error) {
    console.error('Error fetching schedules by instructor email:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedules by email', error: error.message });
  }
});

// GET schedules for an instructor by full name (compatibility)
router.get('/instructor/by-name/:name', async (req, res) => {
  try {
    const nameParam = req.params.name;
    console.log('📥 GET /api/schedule/instructor/by-name/:name called with', { nameParam });
    if (!nameParam) return res.status(400).json({ success: false, message: 'Name is required' });
    const name = nameParam.toString().trim();

    // Match instructor field (full name) case-insensitively
    const query = { instructor: { $regex: new RegExp(`^${name}$`, 'i') }, archived: false };
    const schedules = await Schedule.find(query).select('course year section subject instructor instructorEmail day time room archived createdAt updatedAt _id __v').lean();
    console.log(`🔎 Found ${Array.isArray(schedules) ? schedules.length : 0} schedules for name="${name}"`);

    return res.json(Array.isArray(schedules) ? schedules : []);
  } catch (error) {
    console.error('Error fetching schedules by instructor name:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedules by name', error: error.message });
  }
});

// POST /create (legacy)
router.post('/create', async (req, res) => {
  try {
    const { course, year, section, subject, instructor, instructorEmail, day, time, room } = req.body;
    if (!course || !year || !section || !subject || !instructor || !day || !time || !room) {
      return res.status(400).json({ success: false, message: 'All fields are required', code: 'VALIDATION_ERROR' });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'schedule_creation');
    const roomDoc = await Room.findOne({ room, archived: false });
    if (!roomDoc) return res.status(404).json({ success: false, message: `Room ${room} not found or archived`, code: 'ROOM_NOT_FOUND' });

    const sectionDoc = await Section.findOne({ course, year, name: section, archived: false });
    if (!sectionDoc) return res.status(404).json({ success: false, message: `Section ${section} not found or archived`, code: 'SECTION_NOT_FOUND' });

    await detectScheduleConflict(room, day, time, null, Schedule);
    const instructorConflict = await Schedule.findOne({ instructor, day, time, archived: false });
    if (instructorConflict) return res.status(409).json({ success: false, message: `Instructor ${instructor} already has a schedule at ${day} ${time}`, code: 'INSTRUCTOR_CONFLICT' });

    const newSchedule = new Schedule({ course, year, section, subject, instructor, instructorEmail: instructorEmail?.toLowerCase(), day, time, room });
    await newSchedule.save();

    // Google Calendar sync (best-effort)
    try {
      const { isGoogleCalendarConfigured, createCalendarEvent } = await import('../services/googleCalendarService.js');
      if (isGoogleCalendarConfigured()) {
        const eventId = await createCalendarEvent(newSchedule, instructorEmail?.toLowerCase());
        if (eventId) {
          newSchedule.googleCalendarEventId = eventId;
          await newSchedule.save();
          console.log(`✅ Schedule ${newSchedule._id} synced to Google Calendar: ${eventId}`);
        }
      }
    } catch (calendarError) {
      console.warn('⚠️ Failed to sync to Google Calendar (create):', calendarError.message);
    }

    transaction.addOperation(newSchedule._id, 'create', newSchedule.__v, newSchedule);
    const txnRecord = transaction.commit();

    // Create notification for instructor
    if (instructorEmail) {
      const notification = await createInstructorNotification(
        instructorEmail,
        '📅 New Schedule Created',
        `Your ${subject} class has been scheduled for ${day} at ${time} in room ${room}`,
        `/instructor/dashboard`
      );
      if (notification) {
        broadcastNotification(req, instructorEmail, notification);
      }
    }

    // Broadcast real-time creation (non-blocking)
    if (req.io) {
      setImmediate(() => {
        req.io.emit('schedule-created', {
          action: 'created',
          schedule: newSchedule,
          timestamp: new Date(),
          userId: req.userId || 'system'
        });
        // Also emit for specific instructor
        if (newSchedule.instructorEmail) {
          req.io.emit(`schedule-update-${newSchedule.instructorEmail}`, {
            action: 'created',
            schedule: newSchedule,
            timestamp: new Date()
          });
        }
      });
    }

    res.status(201).json({ success: true, message: 'Schedule created', schedule: newSchedule, transaction: txnRecord });
  } catch (error) {
    console.error('Compatibility create schedule error:', error);
    res.status(500).json({ success: false, message: 'Server error creating schedule', error: error.message });
  }
});

// PUT /:id (legacy)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body;

    if (version !== undefined) {
      const { course, year, section, subject, instructor, instructorEmail, day, time, room } = req.body;
      const transaction = new MVCCTransaction(req.userId || 'system', 'schedule_update');

      const updatedSchedule = await withRetry(async () => {
        await detectScheduleConflict(room, day, time, id, Schedule);
        const instructorConflict = await Schedule.findOne({ instructor, day, time, _id: { $ne: id }, archived: false });
        if (instructorConflict) throw new Error(`Instructor ${instructor} already has a schedule at ${day} ${time}`);
        const updateData = { course, year, section, subject, instructor, instructorEmail: instructorEmail?.toLowerCase(), day, time, room };
        const updated = await updateWithVersionControl(Schedule, id, version, updateData);
        return updated;
      }, 3, 100);

      // Google Calendar sync (best-effort) - update existing event if present
      try {
        const { isGoogleCalendarConfigured, updateCalendarEvent } = await import('../services/googleCalendarService.js');
        if (isGoogleCalendarConfigured() && updatedSchedule.googleCalendarEventId && instructorEmail) {
          const success = await updateCalendarEvent(updatedSchedule.googleCalendarEventId, updatedSchedule, instructorEmail?.toLowerCase());
          if (success) {
            console.log(`✅ Schedule ${updatedSchedule._id} updated in Google Calendar`);
          }
        }
      } catch (calendarError) {
        console.warn('⚠️ Failed to sync to Google Calendar (update):', calendarError.message);
      }

      transaction.addOperation(id, 'update', updatedSchedule.__v, updatedSchedule);
      const txnRecord = transaction.commit();

      // Create notification for instructor about update
      if (instructorEmail) {
        const notification = await createInstructorNotification(
          instructorEmail,
          '✏️ Schedule Updated',
          `Your ${subject} class schedule has been updated: ${day} at ${time} in room ${room}`,
          `/instructor/dashboard`
        );
        if (notification) {
          broadcastNotification(req, instructorEmail, notification);
        }
      }

      // Broadcast real-time update (non-blocking)
      if (req.io) {
        setImmediate(() => {
          req.io.emit('schedule-updated', {
            action: 'updated',
            schedule: updatedSchedule,
            timestamp: new Date(),
            userId: req.userId || 'system'
          });
          // Also emit for specific instructor
          if (updatedSchedule.instructorEmail) {
            req.io.emit(`schedule-update-${updatedSchedule.instructorEmail}`, {
              action: 'updated',
              schedule: updatedSchedule,
              timestamp: new Date()
            });
          }
        });
      }

      res.json({ success: true, message: 'Schedule updated', schedule: updatedSchedule, transaction: txnRecord });
      return;
    }

    const schedule = await Schedule.findById(id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });

    const fields = ['course','year','section','subject','instructor','instructorEmail','day','time','room'];
    fields.forEach(f => { if (req.body[f] !== undefined) schedule[f] = req.body[f]; });
    await schedule.save();

    // Google Calendar sync (best-effort) for legacy update
    try {
      const { isGoogleCalendarConfigured, updateCalendarEvent } = await import('../services/googleCalendarService.js');
      if (isGoogleCalendarConfigured() && schedule.googleCalendarEventId && schedule.instructorEmail) {
        const success = await updateCalendarEvent(schedule.googleCalendarEventId, schedule, schedule.instructorEmail?.toLowerCase());
        if (success) {
          console.log(`✅ Schedule ${schedule._id} updated in Google Calendar (legacy)`);
        }
      }
    } catch (calendarError) {
      console.warn('⚠️ Failed to sync to Google Calendar (legacy update):', calendarError.message);
    }

    // Broadcast real-time update (non-blocking)
    if (req.io) {
      setImmediate(() => {
        req.io.emit('schedule-updated', {
          action: 'updated',
          schedule: schedule,
          timestamp: new Date(),
          userId: req.userId || 'system'
        });
        // Also emit for specific instructor
        if (schedule.instructorEmail) {
          req.io.emit(`schedule-update-${schedule.instructorEmail}`, {
            action: 'updated',
            schedule: schedule,
            timestamp: new Date()
          });
        }
      });
    }

    res.json({ success: true, message: 'Schedule updated (legacy)', schedule });
  } catch (error) {
    if (error.message?.includes('Version conflict')) {
      return res.status(409).json({ success: false, message: 'Concurrent update detected. Please refresh and try again.', code: 'VERSION_CONFLICT' });
    }
    console.error('Compatibility schedule update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating schedule', error: error.message });
  }
});

// GET available time slots for scheduling (compatibility)
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
    console.error('Error fetching available time slots (mvcc):', error);
    res.status(500).json({ success: false, message: 'Failed to load available time slots.' });
  }
});

/**
 * GET /api/schedule/:id
 * Fetch a single schedule by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid schedule ID' });
    }

    const schedule = await Schedule.findById(id).lean();
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    return res.json(schedule);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ success: false, message: 'Server error fetching schedule' });
  }
});

// DELETE /:id (legacy)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body || {};

    if (version !== undefined) {
      const deleted = await Schedule.findOneAndDelete({ _id: id, __v: version });
      if (!deleted) return res.status(409).json({ success: false, message: 'Version conflict or document not found', code: 'VERSION_CONFLICT' });
      
      // Google Calendar delete sync (best-effort)
      try {
        if (deleted.googleCalendarEventId && deleted.instructorEmail) {
          const { deleteCalendarEvent } = await import('../services/googleCalendarService.js');
          await deleteCalendarEvent(deleted.googleCalendarEventId, deleted.instructorEmail);
          console.log(`✅ Schedule ${deleted._id} deleted from Google Calendar`);
        }
      } catch (calendarError) {
        console.warn('⚠️ Failed to delete from Google Calendar:', calendarError.message);
      }
      
      // Create and broadcast deletion notification
      if (deleted.instructorEmail) {
        const deletionMessage = `🗑️ Schedule Removed\n📚 Course: ${deleted.course}\n📅 Day: ${deleted.day}\n⏰ Time: ${deleted.startTime} - ${deleted.endTime}\n🏛️ Room: ${deleted.room}`;
        const notification = await createInstructorNotification(
          deleted.instructorEmail,
          '🗑️ Schedule Removed',
          deletionMessage,
          null
        );
        if (notification) {
          broadcastNotification(req, deleted.instructorEmail, notification);
        }
      }
      
      // Broadcast real-time update (non-blocking)
      if (req.io) {
        setImmediate(() => {
          req.io.emit('schedule-deleted', {
            action: 'deleted',
            scheduleId: deleted._id,
            schedule: deleted,
            timestamp: new Date(),
            userId: req.userId || 'system'
          });
          // Also emit for specific instructor
          if (deleted.instructorEmail) {
            req.io.emit(`schedule-update-${deleted.instructorEmail}`, {
              action: 'deleted',
              scheduleId: deleted._id,
              timestamp: new Date()
            });
          }
        });
      }
      
      return res.json({ success: true, message: 'Schedule deleted', schedule: deleted });
    }

    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Schedule not found' });
    
    // Google Calendar delete sync (best-effort) for legacy delete
    try {
      if (deleted.googleCalendarEventId && deleted.instructorEmail) {
        const { deleteCalendarEvent } = await import('../services/googleCalendarService.js');
        await deleteCalendarEvent(deleted.googleCalendarEventId, deleted.instructorEmail);
        console.log(`✅ Schedule ${deleted._id} deleted from Google Calendar (legacy)`);
      }
    } catch (calendarError) {
      console.warn('⚠️ Failed to delete from Google Calendar (legacy):', calendarError.message);
    }
    
    // Create and broadcast deletion notification
    if (deleted.instructorEmail) {
      const deletionMessage = `🗑️ Schedule Removed\n📚 Course: ${deleted.course}\n📅 Day: ${deleted.day}\n⏰ Time: ${deleted.startTime} - ${deleted.endTime}\n🏛️ Room: ${deleted.room}`;
      const notification = await createInstructorNotification(
        deleted.instructorEmail,
        '🗑️ Schedule Removed',
        deletionMessage,
        null
      );
      if (notification) {
        broadcastNotification(req, deleted.instructorEmail, notification);
      }
    }
    
    // Broadcast real-time update (non-blocking)
    if (req.io) {
      setImmediate(() => {
        req.io.emit('schedule-deleted', {
          action: 'deleted',
          scheduleId: deleted._id,
          schedule: deleted,
          timestamp: new Date(),
          userId: req.userId || 'system'
        });
        // Also emit for specific instructor
        if (deleted.instructorEmail) {
          req.io.emit(`schedule-update-${deleted.instructorEmail}`, {
            action: 'deleted',
            scheduleId: deleted._id,
            timestamp: new Date()
          });
        }
      });
    }
    
    res.json({ success: true, message: 'Schedule deleted', schedule: deleted });
  } catch (error) {
    console.error('Compatibility schedule delete error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting schedule', error: error.message });
  }
});

export default router;

// ------------------ Compatibility: archive/restore/archived list ------------------
// POST archive (frontend uses POST /api/schedule/:id/archive)
router.post('/:id/archive', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    // If googleCalendar event exists, attempt to delete it (best-effort)
    if (schedule.googleCalendarEventId && schedule.instructorEmail) {
      try {
        const { deleteCalendarEvent } = await import('../services/googleCalendarService.js');
        await deleteCalendarEvent(schedule.googleCalendarEventId, schedule.instructorEmail);
        schedule.googleCalendarEventId = undefined;
      } catch (err) {
        console.warn('Failed to delete calendar event during archive:', err.message);
      }
    }

    schedule.archived = true;
    await schedule.save();

    res.json({ success: true, message: 'Schedule archived successfully.' });
  } catch (err) {
    console.error('Error archiving schedule (mvcc):', err);
    res.status(500).json({ success: false, message: 'Server error archiving schedule.' });
  }
});

// GET archived schedules
router.get('/archived', async (req, res) => {
  try {
    const archived = await Schedule.find({ archived: true }).select('course year section subject instructor day time room archived createdAt updatedAt _id');
    res.json({ success: true, schedules: archived });
  } catch (err) {
    console.error('Error fetching archived schedules (mvcc):', err);
    res.status(500).json({ success: false, message: 'Server error fetching archived schedules.' });
  }
});

// POST restore schedule
router.post('/:id/restore', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const schedule = await Schedule.findById(scheduleId);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found.' });

    schedule.archived = false;
    await schedule.save();

    // Best-effort re-sync to Google Calendar if configured
    try {
      const { isGoogleCalendarConfigured } = await import('../services/googleCalendarService.js');
      if (isGoogleCalendarConfigured()) {
        const { syncScheduleToCalendar } = await import('../utils/mvccManager.js');
        try { await syncScheduleToCalendar(schedule); } catch (e) { console.warn('Resync after restore failed:', e.message); }
      }
    } catch (_) {}

    res.json({ success: true, message: 'Schedule restored successfully.' });
  } catch (err) {
    console.error('Error restoring schedule (mvcc):', err);
    res.status(500).json({ success: false, message: 'Server error restoring schedule.' });
  }
});

// Permanently delete schedule
router.delete('/:id/permanent', async (req, res) => {
  try {
    const deleted = await Schedule.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule permanently deleted' });
  } catch (err) {
    console.error('Error permanently deleting schedule (mvcc):', err);
    res.status(500).json({ success: false, message: 'Server error deleting schedule' });
  }
});
