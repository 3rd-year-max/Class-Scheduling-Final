import Instructor from "../models/Instructor.js";
import Counter from "../models/Counter.js";
import Schedule from "../models/Schedule.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { listCalendarEvents, isGoogleCalendarConfigured } from "../services/googleCalendarService.js";
import { detectAndEmitChange } from "../utils/dataChangeDetector.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logActivity, getUserEmailFromRequest } from '../utils/activityLogger.js';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import express from "express";

const router = express.Router();


// GET workload summary for a specific instructor by ID
router.get('/:id/workload', async (req, res) => {
  try {
    const instructor = await Instructor.findById(req.params.id);
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    // Find all schedules for this instructor
    const schedules = await Schedule.find({ instructorEmail: instructor.email });

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

    res.json({
      weeklySummary: {
        totalClasses,
        totalHours: Math.round(totalHours * 100) / 100,
        busiestDay: busiestDay || 'N/A'
      },
      dailyBreakdown
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch workload data', error: err.message });
  }
});

// Multer storage for profile images
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
    const safeEmail = (req.userEmail || "user").replace(/[^a-zA-Z0-9-_\.]/g, "_");
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

// SELF: Get current instructor profile (by JWT email)
router.get("/profile/me", verifyToken, async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.userEmail })
      .select("instructorId firstname lastname email contact department image status");
    if (!instructor) return res.status(404).json({ message: "Instructor not found" });
    res.json(instructor);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile", error: err.message });
  }
});

// GET /api/instructors/calendar/status - Check Google Calendar configuration status (no auth required for diagnostics)
router.get("/calendar/status", async (req, res) => {
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

// SELF: Update current instructor profile (no password here)
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { firstname, lastname, contact, department } = req.body;
    const oldInstructor = await Instructor.findOne({ email: req.userEmail });
    const updated = await Instructor.findOneAndUpdate(
      { email: req.userEmail },
      { $set: { firstname, lastname, contact, department } },
      { new: true }
    ).select("instructorId firstname lastname email contact department image status");
    if (!updated) return res.status(404).json({ message: "Instructor not found" });
    
    // Log profile update activity
    const changes = [];
    if (oldInstructor && oldInstructor.firstname !== firstname) changes.push(`firstname: ${oldInstructor.firstname} → ${firstname}`);
    if (oldInstructor && oldInstructor.lastname !== lastname) changes.push(`lastname: ${oldInstructor.lastname} → ${lastname}`);
    if (oldInstructor && oldInstructor.contact !== contact) changes.push(`contact: ${oldInstructor.contact} → ${contact}`);
    
    await logActivity({
      type: 'instructor-profile-updated',
      message: `${updated.firstname} ${updated.lastname} updated profile${changes.length > 0 ? ` (${changes.join(', ')})` : ''}`,
      source: 'instructor',
      userEmail: req.userEmail,
      link: '/instructor/settings',
      meta: { changes },
      io: req.io
    });
    
    res.json({ success: true, instructor: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error updating profile", error: err.message });
  }
});

// SELF: Upload/replace profile image
router.post("/profile/image", verifyToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No image uploaded" });
    const relativePath = `/uploads/profiles/${req.file.filename}`;
    const updated = await Instructor.findOneAndUpdate(
      { email: req.userEmail },
      { $set: { image: relativePath } },
      { new: true }
    ).select("instructorId firstname lastname email contact department image status");
    if (!updated) return res.status(404).json({ success: false, message: "Instructor not found" });
    
    // Log image upload activity
    await logActivity({
      type: 'instructor-image-uploaded',
      message: `${updated.firstname} ${updated.lastname} uploaded profile image`,
      source: 'instructor',
      userEmail: req.userEmail,
      link: '/instructor/settings',
      meta: { imagePath: relativePath },
      io: req.io
    });
    
    res.json({ success: true, instructor: updated, image: relativePath });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error uploading image", error: err.message });
  }
});

const registeredStatuses = ["active", "archived"];

// Increment and get next sequence value
async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

// GET all instructors
router.get("/", async (req, res) => {
  try {
    const instructors = await Instructor.find({})
      .select("instructorId firstname lastname email contact department status")
      .sort({ status: 1, lastname: 1, firstname: 1 });

    // Automatically assign instructorIDs to any instructors missing them
    const instructorsNeedingIds = instructors.filter(inst => 
      !inst.instructorId || inst.instructorId.trim() === ""
    );

    if (instructorsNeedingIds.length > 0) {
      for (const instructor of instructorsNeedingIds) {
        instructor.instructorId = await getNextSequence("instructorId");
        await instructor.save();
      }
      
      // Refetch instructors after assigning IDs
      const updatedInstructors = await Instructor.find({})
        .select("instructorId firstname lastname email contact department status")
        .sort({ status: 1, lastname: 1, firstname: 1 });
      
      // Emit data change event if instructors have changed
      detectAndEmitChange('instructors', updatedInstructors, req.io, 'data-updated:instructors');
      
      return res.json(updatedInstructors);
    }

    // Emit data change event if instructors have changed
    detectAndEmitChange('instructors', instructors, req.io, 'data-updated:instructors');

    res.json(instructors);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching instructors",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// GET instructor profile by email
router.get("/profile/by-email/:email", async (req, res) => {
  try {
    const emailParam = req.params.email;
    const instructor = await Instructor.findOne({ email: { $regex: new RegExp(`^${emailParam}$`, 'i') } })
      .select("instructorId firstname lastname email contact department image status");
    
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }
    
    res.json(instructor);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching instructor profile",
      error: error.message,
    });
  }
});

// Signup route
router.post("/signup", async (req, res) => {
  try {
    const { firstname, lastname, email, contact, department, password } = req.body;
    if (!firstname || !lastname || !email || !contact || !department || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check existing instructor with email
    const existingInstructor = await Instructor.findOne({ email });

    if (existingInstructor) {
      if (registeredStatuses.includes(existingInstructor.status)) {
        // Already active or archived, disallow signup
        return res.status(400).json({ message: "Email already registered" });
      }
      if (existingInstructor.status === "pending") {
        // Pending instructor found, update details and activate
        // Ensure they have an instructorID
        if (!existingInstructor.instructorId || existingInstructor.instructorId.trim() === "") {
          existingInstructor.instructorId = await getNextSequence("instructorId");
        }
        existingInstructor.firstname = firstname;
        existingInstructor.lastname = lastname;
        existingInstructor.contact = contact;
        existingInstructor.department = department;
        existingInstructor.password = await bcrypt.hash(password, 10);
        existingInstructor.status = "active";
        existingInstructor.dateJoined = new Date();
        await existingInstructor.save();

        return res.status(200).json({
          success: true,
          instructor: existingInstructor,
        });
      }
      return res.status(400).json({ message: "Invalid instructor status." });
    }

    // Create new instructor with status 'pending'
    const instructorId = await getNextSequence("instructorId");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newInstructor = new Instructor({
      instructorId,
      firstname,
      lastname,
      email,
      contact,
      department,
      password: hashedPassword,
      status: "pending",  // <-- set to pending on first signup
      dateJoined: new Date(),
    });

    await newInstructor.save();

    res.status(201).json({
      success: true,
      instructor: newInstructor,
      message: "Account created but pending activation. Please wait for approval.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Send registration link for pending instructor
router.post("/registration/send-registration", async (req, res) => {
  try {
    const { email, department } = req.body;
    if (!email || !department) {
      return res.status(400).json({ message: "Email and department are required" });
    }

    const existing = await Instructor.findOne({ email });
    if (existing) {
      if (["active", "archived"].includes(existing.status)) {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (existing.status === "pending") {
        return res.status(200).json({ message: "Registration link already sent to this email" });
      }
    }

    let instructorId = existing ? existing.instructorId : await getNextSequence("instructorId");

    const instructor = await Instructor.findOneAndUpdate(
      { email },
      {
        instructorId,
        email,
        department,
        status: "pending",
        dateJoined: new Date(),
      },
      { upsert: true, new: true }
    );

    // Log registration link sent activity
    await logActivity({
      type: 'instructor-registration-link-sent',
      message: `Registration link sent to ${email} (${department})`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { email, department, instructorId: instructor.instructorId },
      io: req.io
    });

    res.status(200).json({ 
      message: "Registration link sent successfully",
      instructorId: instructor.instructorId
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login route (JWT)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const instructor = await Instructor.findOne({ email });
    if (!instructor) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!instructor.password) {
      return res.status(400).json({ message: "Please complete your registration first before login." });
    }

    const isMatch = await bcrypt.compare(password, instructor.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set in environment variables!");
      return res.status(500).json({ message: "Server configuration error." });
    }

    const token = jwt.sign({ email: instructor.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      success: true,
      token,
      instructor: {
        firstname: instructor.firstname,
        lastname: instructor.lastname,
        email: instructor.email,
      },
    });
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).json({ message: "Internal server error", error: err.message });
  }
});

// Complete registration
router.post("/complete-registration", async (req, res) => {
  try {
    const { email, firstname, lastname, contact, department, password } = req.body;
    if (!email || !firstname || !lastname || !contact || !department || !password) {
      return res.status(400).json({ message: "All registration fields are required." });
    }

    // Find instructor by email who is currently pending
    const instructor = await Instructor.findOne({ email: email.trim().toLowerCase(), status: 'pending' });

    if (!instructor) {
      return res.status(404).json({ message: "No pending registration found for this email." });
    }

    // Update instructor's details and mark as active
    // Ensure they have an instructorID
    if (!instructor.instructorId || instructor.instructorId.trim() === "") {
      instructor.instructorId = await getNextSequence("instructorId");
    }
    instructor.firstname = firstname;
    instructor.lastname = lastname;
    instructor.contact = contact;
    instructor.department = department;
    instructor.password = await bcrypt.hash(password, 10);
    instructor.status = "active";  // Automatically activate here
    await instructor.save();

    // Optional: Notify via alert system that instructor completed registration
    await logActivity({
      type: 'instructor-registration-completed',
      message: `Instructor ${firstname} ${lastname} completed registration`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorEmail: email },
      io: req.io
    });

    res.json({
      success: true,
      message: "Registration completed successfully and account activated.",
      instructor: {
        id: instructor._id,
        firstname: instructor.firstname,
        lastname: instructor.lastname,
        email: instructor.email,
        contact: instructor.contact,
        department: instructor.department,
        status: instructor.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error during registration completion." });
  }
});


// Update instructor
router.put("/:id", async (req, res) => {
  try {
    const { email, contact } = req.body;
    const existing = await Instructor.findOne({
      email,
      status: { $in: registeredStatuses },
      _id: { $ne: req.params.id },
    });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const updated = await Instructor.findByIdAndUpdate(
      req.params.id,
      { email, contact },
      { new: true }
    );
    await logActivity({
      type: 'instructor-updated',
      message: `Instructor ${updated.firstname} ${updated.lastname} details updated by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: updated.instructorId, email: updated.email },
      io: req.io
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Archive instructor
router.put("/:id/archive", async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedDate: new Date() },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ success: false, error: "Instructor not found" });
    }
    const instructorName = `${instructor.firstname} ${instructor.lastname}`;
    await logActivity({
      type: 'instructor-archived',
      message: `Instructor ${instructorName} archived by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    res.json({ success: true, message: "Instructor archived", instructor });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Restore instructor
router.put("/:id/restore", async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { status: "active", archivedDate: null },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ success: false, error: "Instructor not found" });
    }
    const instructorName = `${instructor.firstname} ${instructor.lastname}`;
    await logActivity({
      type: 'instructor-restored',
      message: `Instructor ${instructorName} restored by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    res.json({ success: true, message: "Instructor restored", instructor });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Move to archive (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndUpdate(
      req.params.id,
      { status: "archived", archivedDate: new Date() },
      { new: true }
    );
    if (!instructor) {
      return res.status(404).json({ error: "Instructor not found" });
    }
    const instructorName = `${instructor.firstname} ${instructor.lastname}`;
    await logActivity({
      type: 'instructor-archived',
      message: `Instructor ${instructorName} moved to archive by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    res.json({ success: true, message: "Instructor moved to archive", instructor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete instructor
router.delete("/:id/permanent", async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndDelete(req.params.id);
    if (!instructor) {
      return res.status(404).json({ success: false, error: "Instructor not found" });
    }
    const instructorName = `${instructor.firstname} ${instructor.lastname}`;
    await logActivity({
      type: 'instructor-deleted',
      message: `Instructor ${instructorName} permanently deleted by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });
    res.json({ success: true, message: "Instructor permanently deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/activate', async (req, res) => {
  const { email, firstname, lastname, contact, department, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Find instructor by email only if status is pending
    const instructor = await Instructor.findOne({ email, status: 'pending' });

    if (!instructor) {
      return res.status(404).json({ error: 'Pending instructor not found or already activated.' });
    }

    // Update instructor details and set status active
    if (firstname) instructor.firstname = firstname;
    if (lastname) instructor.lastname = lastname;
    if (contact) instructor.contact = contact;
    if (department) instructor.department = department;
    if (password) {
      const bcrypt = await import('bcryptjs'); // dynamic import if needed
      instructor.password = await bcrypt.hash(password, 10);
    }
    instructor.status = 'active';

    await instructor.save();

    // Log activation activity
    await logActivity({
      type: 'instructor-activated',
      message: `Instructor ${instructor.firstname} ${instructor.lastname} account activated by admin`,
      source: 'admin',
      link: '/admin/faculty-management',
      meta: { instructorId: instructor.instructorId, email: instructor.email },
      io: req.io
    });

    res.json({ success: true, message: 'Instructor account activated successfully.', instructor });
  } catch (err) {
    console.error('Error activating instructor:', err);
    res.status(500).json({ error: 'Failed to activate instructor account.' });
  }
});

// Log instructor activity (reports downloaded, etc.)
router.post('/log-activity', async (req, res) => {
  try {
    const { type, message, reportType, email } = req.body;
    
    if (!email || !type) {
      return res.status(400).json({ message: 'Email and type are required' });
    }

    const messageText = message || `${type.replace(/-/g, ' ').toUpperCase()} - ${reportType || ''}`.trim();
    
    // Log the activity
    await logActivity({
      type: type,
      message: messageText,
      source: 'instructor',
      userEmail: email,
      link: '/instructor/reports',
      meta: { reportType },
      io: req.io
    });

    res.json({ success: true, message: 'Activity logged' });
  } catch (error) {
    console.error('Error logging instructor activity:', error);
    res.status(500).json({ message: 'Failed to log activity', error: error.message });
  }
});

export default router;

