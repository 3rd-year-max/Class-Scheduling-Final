/**
 * MVCC-Enhanced Instructor Routes
 * Handles concurrent instructor updates with optimistic locking
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import { logActivity } from "../utils/activityLogger.js";
import Instructor from "../models/Instructor.js";
import Schedule from "../models/Schedule.js";
import { withRetry, MVCCTransaction } from "../middleware/mvccTransaction.js";
import { updateInstructorWithConflictResolution, updateWithVersionControl } from "../utils/mvccManager.js";
import { listCalendarEvents, isGoogleCalendarConfigured } from "../services/googleCalendarService.js";

const router = express.Router();

// Multer storage for profile images (compatibility with legacy route)
const uploadsRoot = path.join(process.cwd(), "uploads", "profiles");
if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsRoot);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const safeEmail = (req.userEmail || req.user?.email || "user").replace(/[^a-zA-Z0-9-_\.]/g, "_");
    cb(null, `${safeEmail}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Only image files are allowed"));
  },
});

// GET /api/instructors/calendar/status - Check Google Calendar configuration status (no auth required for diagnostics)
router.get('/calendar/status', async (req, res) => {
  try {
    const hasClientEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
    const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY;
    const hasProjectId = !!process.env.GOOGLE_PROJECT_ID;
    
    let privateKeyFormat = 'unknown';
    if (hasPrivateKey) {
      const key = process.env.GOOGLE_PRIVATE_KEY;
      const hasBegin = key.includes('BEGIN PRIVATE KEY');
      const hasEnd = key.includes('END PRIVATE KEY');
      privateKeyFormat = hasBegin && hasEnd ? 'valid' : 'invalid';
    }
    
    const configured = isGoogleCalendarConfigured();
    
    return res.json({
      configured,
      env_variables: {
        GOOGLE_CLIENT_EMAIL: hasClientEmail ? 'Set' : 'Missing',
        GOOGLE_PRIVATE_KEY: hasPrivateKey ? `Set (${privateKeyFormat} format)` : 'Missing',
        GOOGLE_PROJECT_ID: hasProjectId ? 'Set' : 'Missing'
      },
      service_account: hasClientEmail ? process.env.GOOGLE_CLIENT_EMAIL : null,
      instructions: configured 
        ? "✅ Google Calendar is configured. Make sure each instructor's calendar is shared with the service account."
        : "❌ Google Calendar is not configured. Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_PROJECT_ID in backend/.env and restart the server."
    });
  } catch (error) {
    console.error('Error checking Google Calendar status:', error);
    res.status(500).json({
      configured: false,
      error: error.message
    });
  }
});

// SELF: Get Google Calendar events for current instructor
router.get("/calendar/events", verifyToken, async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.userEmail })
      .select("email status");
    
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (instructor.status !== 'active') {
      return res.status(403).json({ message: "Instructor account is not active" });
    }

    // Check if Google Calendar is configured
    const isConfigured = isGoogleCalendarConfigured();
    if (!isConfigured) {
      // Provide detailed diagnostics
      const hasClientEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
      const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY;
      const hasProjectId = !!process.env.GOOGLE_PROJECT_ID;
      
      return res.status(503).json({ 
        message: "Google Calendar is not configured",
        configured: false,
        diagnostics: {
          GOOGLE_CLIENT_EMAIL: hasClientEmail ? 'Set' : 'Missing',
          GOOGLE_PRIVATE_KEY: hasPrivateKey ? 'Set' : 'Missing',
          GOOGLE_PROJECT_ID: hasProjectId ? 'Set' : 'Missing',
          instructions: "Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_PROJECT_ID in your backend .env file and restart the server."
        }
      });
    }

    // Get query parameters for filtering
    const timeMin = req.query.timeMin || new Date().toISOString();
    const timeMax = req.query.timeMax;
    const maxResults = parseInt(req.query.maxResults) || 50;

    // Fetch calendar events (gracefully handles errors - returns empty array if calendar not accessible)
    let events = [];
    try {
      events = await listCalendarEvents(instructor.email, {
        timeMin,
        timeMax,
        maxResults
      });
    } catch (error) {
      // Error already handled in listCalendarEvents, but catch here as extra safety
      console.warn(`⚠️ Calendar events fetch failed for ${instructor.email}:`, error.message);
      events = [];
    }

    // Also get schedules that are synced to calendar
    const schedules = await Schedule.find({ 
      instructorEmail: instructor.email,
      googleCalendarEventId: { $exists: true, $ne: null }
    }).select('_id subject course year section day time room googleCalendarEventId');

    res.json({
      configured: true,
      events: events || [],
      syncedSchedules: schedules || [],
      count: events?.length || 0
    });

  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    res.status(500).json({ 
      message: "Error fetching calendar events", 
      error: error.message,
      configured: isGoogleCalendarConfigured()
    });
  }
});

/**
 * GET /api/instructors
 * Compatibility endpoint - list instructors
 * Excludes archived instructors by default (unless showArchived=true)
 */
router.get('/', async (req, res) => {
  try {
    const { showArchived } = req.query;
    const query = {};
    // By default, exclude archived instructors unless explicitly requested
    if (showArchived !== 'true') {
      query.archived = { $ne: true };
    }
    
    // Return instructors in the legacy shape expected by the frontend
    const instructors = await Instructor.find(query)
      .select('instructorId firstname lastname email contact department status archived createdAt updatedAt _id __v')
      .sort({ status: 1, lastname: 1, firstname: 1 })
      .lean();

    // Do not mutate database here; just return the array (legacy route previously auto-assigned IDs server-side).
      return res.json(instructors);
  } catch (error) {
    console.error('Error fetching instructors list:', error);
    res.status(500).json({ success: false, message: 'Server error fetching instructors' });
  }
});

/**
 * GET instructor profile by email (compatibility)
 * Supports frontend calls to `/api/instructors/profile/by-email/:email`
 */
router.get('/profile/by-email/:email', async (req, res) => {
  try {
    const emailParam = req.params.email;
    const instructor = await Instructor.findOne({ email: { $regex: new RegExp(`^${emailParam}$`, 'i') } })
      .select('instructorId firstname lastname email contact department image status archived createdAt updatedAt _id __v')
      .lean();

    if (!instructor) return res.status(404).json({ success: false, message: 'Instructor not found' });
    return res.json(instructor);
  } catch (error) {
    console.error('Error fetching instructor by email:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching instructor by email', error: error.message });
  }
});

/**
 * GET /api/instructors/profile/me
 * Get current user profile (authenticated)
 */
router.get('/profile/me', async (req, res) => {
  try {
    // Get user ID from auth middleware or JWT
    const userId = req.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const instructor = await Instructor.findById(userId)
      .select('instructorId firstname lastname email contact department image status archived createdAt updatedAt _id __v')
      .lean();

    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor profile not found' });
    }

    return res.json(instructor);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// SELF: Upload/replace profile image (compatibility)
router.post('/profile/image', verifyToken, upload.single('image'), async (req, res) => {
  try {
    console.log('📥 POST /api/instructors/profile/image called by', req.userEmail || req.user?.email || 'unknown');
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    const relativePath = `/uploads/profiles/${req.file.filename}`;
    const updated = await Instructor.findOneAndUpdate(
      { email: req.userEmail || req.user?.email },
      { $set: { image: relativePath } },
      { new: true }
    ).select('instructorId firstname lastname email contact department image status');
    if (!updated) return res.status(404).json({ success: false, message: 'Instructor not found' });

    // Log image upload activity
    await logActivity({
      type: 'instructor-image-uploaded',
      message: `${updated.firstname} ${updated.lastname} uploaded profile image`,
      source: 'instructor',
      userEmail: req.userEmail || req.user?.email,
      link: '/instructor/settings',
      meta: { imagePath: relativePath },
      io: req.io
    });

    res.json({ success: true, instructor: updated, image: relativePath });
  } catch (err) {
    console.error('Error uploading profile image (mvcc):', err);
    res.status(500).json({ success: false, message: 'Error uploading image', error: err.message });
  }
});

/**
 * PUT update instructor with optimistic locking
 * Prevents concurrent profile update conflicts
 */
router.put("/:id/update-mvcc", async (req, res) => {
  try {
    const { id } = req.params;
    const { version, firstname, lastname, email, contact, department, status } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message: "Version field required for optimistic locking",
        code: "VERSION_REQUIRED"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'instructor_update');

    const updatedInstructor = await withRetry(async () => {
      return await updateInstructorWithConflictResolution(
        Instructor,
        id,
        version,
        { firstname, lastname, email: email?.toLowerCase(), contact, department, status },
        req.userId || 'system'
      );
    }, 3, 100);

    // If email changed, update all associated schedules
    if (email) {
      await Schedule.updateMany(
        { instructor: `${(await Instructor.findById(id)).firstname} ${(await Instructor.findById(id)).lastname}` },
        { instructorEmail: email.toLowerCase() }
      );
    }

    transaction.addOperation(id, 'update', updatedInstructor.__v, updatedInstructor);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: "Instructor updated with optimistic locking",
      instructor: updatedInstructor,
      transaction: txnRecord
    });

  } catch (error) {
    if (error.message?.includes('Version conflict')) {
      return res.status(409).json({
        success: false,
        message: "Concurrent update detected. Please refresh and try again.",
        code: "VERSION_CONFLICT"
      });
    }

    if (error.message?.includes('already in use') || error.message?.includes('Email')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: "EMAIL_CONFLICT"
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already in use by another instructor",
        code: "DUPLICATE_EMAIL"
      });
    }

    console.error("Instructor update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating instructor",
      error: error.message
    });
  }
});

/**
 * PATCH update instructor assignment (partial update)
 * Handles concurrent assignment changes
 */
router.patch("/:id/assign-mvcc", async (req, res) => {
  try {
    const { id } = req.params;
    const { version, departmentAssignment, courseLoad, status } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message: "Version field required for optimistic locking",
        code: "VERSION_REQUIRED"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'instructor_assignment');

    const updateData = {};
    if (departmentAssignment) updateData.department = departmentAssignment;
    if (status) updateData.status = status;

    const updatedInstructor = await withRetry(async () => {
      return await updateWithVersionControl(Instructor, id, version, updateData);
    }, 3, 100);

    transaction.addOperation(id, 'assignment', updatedInstructor.__v, updatedInstructor);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: "Instructor assignment updated",
      instructor: updatedInstructor,
      transaction: txnRecord
    });

  } catch (error) {
    if (error.message?.includes('Version conflict')) {
      return res.status(409).json({
        success: false,
        message: "Concurrent update detected. Please refresh and try again.",
        code: "VERSION_CONFLICT"
      });
    }

    console.error("Instructor assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating assignment",
      error: error.message
    });
  }
});

/**
 * GET instructor with version info and schedule details
 */
router.get("/:id/version", async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found"
      });
    }

    // Get schedule information
    const schedules = await Schedule.find({
      $or: [
        { instructor: `${instructor.firstname} ${instructor.lastname}` },
        { instructorEmail: instructor.email }
      ],
      archived: false
    });

    res.json({
      success: true,
      instructor: {
        _id: instructor._id,
        __v: instructor.__v,
        firstname: instructor.firstname,
        lastname: instructor.lastname,
        email: instructor.email,
        status: instructor.status,
        department: instructor.department,
        createdAt: instructor.createdAt,
        updatedAt: instructor.updatedAt,
        scheduleInfo: {
          totalSchedules: schedules.length,
          courseCount: new Set(schedules.map(s => s.course)).size,
          courses: Array.from(new Set(schedules.map(s => s.course)))
        }
      }
    });

  } catch (error) {
    console.error("Error fetching instructor version:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching instructor"
    });
  }
});

/**
 * POST bulk update instructor assignments with transaction support
 */
router.post("/bulk/assign-mvcc", async (req, res) => {
  try {
    const { instructors } = req.body;

    if (!Array.isArray(instructors) || instructors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Instructors array required",
        code: "INVALID_INPUT"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'bulk_instructor_assignment');
    const updated = [];
    const failed = [];

    for (const instructorData of instructors) {
      try {
        const updateData = {
          department: instructorData.department,
          status: instructorData.status
        };

        const result = await updateWithVersionControl(
          Instructor,
          instructorData._id,
          instructorData.__v,
          updateData
        );

        transaction.addOperation(instructorData._id, 'assignment', result.__v, result);
        updated.push(result);

      } catch (error) {
        failed.push({
          instructorId: instructorData._id,
          error: error.message
        });
      }
    }

    transaction.status = failed.length > 0 ? 'partial_success' : 'success';
    const txnRecord = transaction.commit();

    res.json({
      success: failed.length === 0,
      message: `Updated ${updated.length} instructors${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      updated: updated.length,
      failed: failed.length,
      instructors: updated,
      failures: failed,
      transaction: txnRecord
    });

  } catch (error) {
    console.error("Bulk instructor assignment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating instructors",
      error: error.message
    });
  }
});

/**
 * GET instructor schedule conflicts
 * Detects if instructor has overlapping schedules
 */
router.get("/:id/conflicts", async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);

    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found"
      });
    }

    const fullName = `${instructor.firstname} ${instructor.lastname}`;

    // Get instructor's schedules
    const schedules = await Schedule.find({
      $or: [
        { instructor: { $regex: new RegExp(`^${fullName}$`, 'i') } },
        { instructorEmail: instructor.email }
      ],
      archived: false
    });

    // Check for time conflicts
    const conflicts = [];
    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        if (schedules[i].day === schedules[j].day && schedules[i].time === schedules[j].time) {
          conflicts.push({
            schedule1: {
              _id: schedules[i]._id,
              subject: schedules[i].subject,
              room: schedules[i].room,
              time: schedules[i].time
            },
            schedule2: {
              _id: schedules[j]._id,
              subject: schedules[j].subject,
              room: schedules[j].room,
              time: schedules[j].time
            }
          });
        }
      }
    }

    res.json({
      success: true,
      instructor: {
        _id: instructor._id,
        name: fullName,
        email: instructor.email,
        totalSchedules: schedules.length,
        conflicts: conflicts.length,
        conflictDetails: conflicts
      }
    });

  } catch (error) {
    console.error("Error checking instructor conflicts:", error);
    res.status(500).json({
      success: false,
      message: "Server error checking conflicts",
      error: error.message
    });
  }
});

/**
 * GET workload summary for a specific instructor by ID
 * Returns weekly summary and daily breakdown
 */
router.get("/:id/workload", async (req, res) => {
  try {
    const instructorId = req.params.id;
    
    console.log('📊 Workload request for instructor ID:', instructorId);
    
    // Validate ObjectId format
    if (!/^[a-f\d]{24}$/i.test(instructorId)) {
      console.error('❌ Invalid instructor ID format:', instructorId);
      return res.status(400).json({ message: 'Invalid instructor ID format' });
    }
    
    const instructor = await Instructor.findById(instructorId);
    if (!instructor) {
      console.error('❌ Instructor not found with ID:', instructorId);
      return res.status(404).json({ message: 'Instructor not found' });
    }
    
    console.log('✅ Instructor found:', instructor.email || instructor.firstname);

    // Find all schedules for this instructor - try multiple matching strategies
    const instructorEmail = instructor.email?.toLowerCase().trim();
    const instructorFirstName = (instructor.firstname || instructor.firstName || '').trim();
    const instructorLastName = (instructor.lastname || instructor.lastName || '').trim();
    const instructorFullName = `${instructorFirstName} ${instructorLastName}`.trim();
    
    // Build search conditions - exclude archived schedules
    const searchConditions = [
      { instructorEmail: instructorEmail, archived: { $ne: true } },
      { instructor: { $regex: instructorFullName, $options: 'i' }, archived: { $ne: true } },
      { instructor: { $regex: instructorFirstName, $options: 'i' }, archived: { $ne: true } }
    ];
    
    // If email exists, also try matching instructor field with email
    if (instructorEmail) {
      searchConditions.push({ instructor: { $regex: instructorEmail, $options: 'i' }, archived: { $ne: true } });
    }
    
    // Try matching by email first, then by name
    let schedules = await Schedule.find({ 
      $or: searchConditions
    });
    
    console.log(`Found ${schedules.length} schedules for instructor ${instructorId} (${instructorEmail || instructorFullName})`);

    // Helper to parse time string like "08:00 AM - 09:30 AM" to hours
    function parseHours(timeStr) {
      if (!timeStr || typeof timeStr !== 'string') return 0;
      const parts = timeStr.split('-').map(p => p.trim());
      if (parts.length < 2) return 0;
      const parseTime = (t) => {
        let [time, modifier] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (modifier && modifier.toLowerCase() === 'pm' && h !== 12) h += 12;
        if (modifier && modifier.toLowerCase() === 'am' && h === 12) h = 0;
        return h * 60 + (m || 0);
      };
      try {
        const start = parseTime(parts[0]);
        const end = parseTime(parts[1]);
        return Math.max(0, (end - start) / 60);
      } catch {
        return 0;
      }
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyBreakdown = days.map(day => {
      const daySchedules = schedules.filter(s => (s.day || '').toLowerCase() === day.toLowerCase());
      const hours = daySchedules.reduce((sum, s) => sum + parseHours(s.time), 0);
      return { day, classes: daySchedules.length, hours: Math.round(hours * 100) / 100 };
    });

    const totalClasses = schedules.length;
    const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0);
    const busiestDay = dailyBreakdown.reduce((a, b) => (a.hours > b.hours ? a : b), { day: '', hours: 0 }).day;

    // Return data even if no schedules (empty workload)
    res.json({
      weeklySummary: {
        totalClasses,
        totalHours: Math.round(totalHours * 100) / 100,
        busiestDay: busiestDay || 'N/A'
      },
      dailyBreakdown,
      instructor: {
        id: instructor._id,
        name: instructor.firstname || instructor.firstName || instructor.name || 'Unknown',
        email: instructor.email || 'No email'
      }
    });
  } catch (err) {
    console.error('Error fetching workload:', err);
    res.status(500).json({ message: 'Failed to fetch workload data', error: err.message });
  }
});

/**
 * POST resolve instructor schedule conflicts
 * Reassigns conflicting schedules
 */
router.post("/:id/resolve-conflicts", async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduleIdToKeep, newInstructorForOther } = req.body;

    if (!scheduleIdToKeep || !newInstructorForOther) {
      return res.status(400).json({
        success: false,
        message: "scheduleIdToKeep and newInstructorForOther are required",
        code: "VALIDATION_ERROR"
      });
    }

    const instructor = await Instructor.findById(id);
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: "Instructor not found"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'resolve_instructor_conflicts');

    // Update the conflicting schedule
    const conflictingSchedule = await Schedule.findByIdAndUpdate(
      scheduleIdToKeep,
      {
        instructor: newInstructorForOther,
        $inc: { __v: 1 }
      },
      { new: true }
    );

    transaction.addOperation(scheduleIdToKeep, 'reassign', conflictingSchedule.__v, conflictingSchedule);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: "Schedule conflict resolved",
      schedule: conflictingSchedule,
      transaction: txnRecord
    });

  } catch (error) {
    console.error("Error resolving conflicts:", error);
    res.status(500).json({
      success: false,
      message: "Server error resolving conflicts",
      error: error.message
    });
  }
});

/**
 * GET instructor concurrency statistics
 */
router.get("/stats/concurrency", async (req, res) => {
  try {
    const stats = await Instructor.aggregate([
      {
        $group: {
          _id: "$__v",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalInstructors = await Instructor.countDocuments();
    const recentlyModified = await Instructor.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });

    const statusDistribution = await Instructor.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalInstructors,
        recentlyModified,
        versionDistribution: stats,
        statusDistribution
      }
    });

  } catch (error) {
    console.error("Error fetching instructor concurrency stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching statistics"
    });
  }
});

// ------------------ Compatibility routes (legacy paths for instructors) ------------------

// PUT /profile - update logged-in instructor's profile (convenience endpoint)
router.put('/profile', async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const { firstname, lastname, contact, department } = req.body;
    
    const instructor = await Instructor.findById(req.userId);
    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }
    
    if (firstname !== undefined) instructor.firstname = firstname;
    if (lastname !== undefined) instructor.lastname = lastname;
    if (contact !== undefined) instructor.contact = contact;
    if (department !== undefined) instructor.department = department;
    
    await instructor.save();
    
    return res.json({ success: true, message: 'Profile updated', instructor });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ success: false, message: 'Server error updating instructor' });
  }
});

// Archive instructor (soft) - used by frontend (PATCH)
// MUST be before PUT /:id route to avoid route conflict
router.patch('/:id/archive', async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedDate: new Date() },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }
    
    const instructorName = `${instructor.firstname || ''} ${instructor.lastname || ''}`.trim() || instructor.email;
    await logActivity({
      type: 'instructor-archived',
      message: `Instructor ${instructorName} archived by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    
    return res.json({ success: true, message: "Instructor archived", instructor });
  } catch (err) {
    console.error('Error archiving instructor:', err);
    return res.status(500).json({ success: false, message: 'Error archiving instructor', error: err.message });
  }
});

// Restore archived instructor (PATCH)
// MUST be before PUT /:id route to avoid route conflict
router.patch('/:id/restore', async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { status: "active", archivedDate: null },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ success: false, message: "Instructor not found" });
    }
    
    const instructorName = `${instructor.firstname || ''} ${instructor.lastname || ''}`.trim() || instructor.email;
    await logActivity({
      type: 'instructor-restored',
      message: `Instructor ${instructorName} restored by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    
    return res.json({ success: true, message: "Instructor restored", instructor });
  } catch (err) {
    console.error('Error restoring instructor:', err);
    return res.status(500).json({ success: false, message: 'Error restoring instructor', error: err.message });
  }
});

// PUT /:id (legacy) - update instructor profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, firstname, lastname, email, contact, department, status } = req.body;

    if (version !== undefined) {
      const transaction = new MVCCTransaction(req.userId || 'system', 'instructor_update');
      const updatedInstructor = await withRetry(async () => {
        return await updateInstructorWithConflictResolution(Instructor, id, version, { firstname, lastname, email: email?.toLowerCase(), contact, department, status }, req.userId || 'system');
      }, 3, 100);

      if (email) {
        const currInstructor = await Instructor.findById(id);
        if (currInstructor) {
          await Schedule.updateMany(
            { instructor: `${currInstructor.firstname} ${currInstructor.lastname}` },
            { instructorEmail: email.toLowerCase() }
          );
        }
      }

      transaction.addOperation(id, 'update', updatedInstructor.__v, updatedInstructor);
      const txnRecord = transaction.commit();
      return res.json({ success: true, message: 'Instructor updated', instructor: updatedInstructor, transaction: txnRecord });
    }

    // Legacy fallback
    const instructor = await Instructor.findById(id);
    if (!instructor) return res.status(404).json({ success: false, message: 'Instructor not found' });
    if (firstname !== undefined) instructor.firstname = firstname;
    if (lastname !== undefined) instructor.lastname = lastname;
    if (email !== undefined) instructor.email = email;
    if (contact !== undefined) instructor.contact = contact;
    if (department !== undefined) instructor.department = department;
    if (status !== undefined) instructor.status = status;
    await instructor.save();

    return res.json({ success: true, message: 'Instructor updated (legacy)', instructor });
  } catch (error) {
    if (error.message?.includes('Version conflict')) return res.status(409).json({ success: false, message: 'Concurrent update detected. Please refresh and try again.', code: 'VERSION_CONFLICT' });
    if (error.message?.includes('already in use') || error.message?.includes('Email')) return res.status(409).json({ success: false, message: error.message, code: 'EMAIL_CONFLICT' });
    console.error('Compatibility instructor update error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating instructor', error: error.message });
  }
});

export default router;