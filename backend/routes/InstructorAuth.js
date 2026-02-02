import express from 'express';
import bcrypt from 'bcryptjs';
import Instructor from '../models/Instructor.js';
import Schedule from '../models/Schedule.js';
import Alert from '../models/Alert.js';
import axios from 'axios';
import { verifyRecaptcha } from '../utils/recaptcha.js';
import validator from 'validator';
import rateLimit from 'express-rate-limit';
import { logActivity, getUserEmailFromRequest } from '../utils/activityLogger.js';
import jwt from 'jsonwebtoken';
import { createCalendarEvent, updateCalendarEvent, isGoogleCalendarConfigured } from '../services/googleCalendarService.js';

// Rate limiter for login attempts. Skip during development to avoid blocking local testing.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait.",
  skip: () => process.env.NODE_ENV === 'development'
});

const router = express.Router();

/**
 * Auto-sync unsynced schedules to Google Calendar for an instructor
 * This function runs asynchronously and doesn't block the login response
 */
const syncUnsyncedSchedulesToCalendar = async (instructorEmail) => {
  try {
    // Validate email
    if (!instructorEmail || typeof instructorEmail !== 'string') {
      console.log('⚠️ Invalid instructor email, skipping auto-sync');
      return;
    }

    const normalizedEmail = instructorEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      console.log('⚠️ Empty instructor email, skipping auto-sync');
      return;
    }

    // Check if Google Calendar is configured
    if (!isGoogleCalendarConfigured()) {
      console.log('⚠️ Google Calendar not configured, skipping auto-sync');
      return;
    }

    // Find instructor to get their full name for matching
    const instructor = await Instructor.findOne({ email: normalizedEmail });
    if (!instructor) {
      console.log(`⚠️ Instructor not found for ${normalizedEmail}, skipping auto-sync`);
      return;
    }

    const instructorFullName = `${instructor.firstname} ${instructor.lastname}`.trim();

    // Find ALL schedules for this instructor (including already synced ones)
    // Match by instructorEmail OR by instructor name (for schedules created before email was added)
    const allSchedules = await Schedule.find({
      $and: [
        { archived: false },
        {
          $or: [
            { instructorEmail: normalizedEmail },
            // Also match by instructor name if email is missing (for backward compatibility)
            { instructor: instructorFullName, instructorEmail: { $exists: false } },
            { instructor: instructorFullName, instructorEmail: null },
            { instructor: instructorFullName, instructorEmail: '' }
          ]
        }
      ]
    });

    if (allSchedules.length === 0) {
      console.log(`ℹ️ No schedules found for ${normalizedEmail}`);
      return;
    }

    console.log(`🔄 Found ${allSchedules.length} schedule(s) for ${normalizedEmail}. Syncing all to Google Calendar...`);

    let syncedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Sync each schedule (create new or update existing)
    for (const schedule of allSchedules) {
      try {
        // Ensure instructorEmail is set before syncing
        if (!schedule.instructorEmail || schedule.instructorEmail.toLowerCase() !== normalizedEmail) {
          schedule.instructorEmail = normalizedEmail;
          await schedule.save();
          console.log(`📝 Updated instructorEmail for schedule ${schedule._id} (${schedule.subject})`);
        }

        // If schedule already has a googleCalendarEventId, update the existing event
        // Otherwise, create a new event
        if (schedule.googleCalendarEventId) {
          const updatedEventId = await updateCalendarEvent(schedule.googleCalendarEventId, schedule, normalizedEmail);
          if (updatedEventId) {
            updatedCount++;
            console.log(`🔄 Updated existing Google Calendar event for schedule ${schedule._id} (${schedule.subject}) - ${schedule.day} ${schedule.time}: ${updatedEventId}`);
          } else {
            // Event might have been deleted, create a new one
            console.log(`⚠️ Existing event not found, creating new event for schedule ${schedule._id} (${schedule.subject})`);
            const newEventId = await createCalendarEvent(schedule, normalizedEmail);
            if (newEventId) {
              schedule.googleCalendarEventId = newEventId;
              await schedule.save();
              syncedCount++;
              console.log(`✅ Created new Google Calendar event for schedule ${schedule._id} (${schedule.subject}): ${newEventId}`);
            } else {
              failedCount++;
              console.warn(`⚠️ Failed to create new event for schedule ${schedule._id} (${schedule.subject}) - calendar may not be shared`);
            }
          }
        } else {
          // Create new event
          const eventId = await createCalendarEvent(schedule, normalizedEmail);
          if (eventId) {
            schedule.googleCalendarEventId = eventId;
            await schedule.save();
            syncedCount++;
            console.log(`✅ Created Google Calendar event for schedule ${schedule._id} (${schedule.subject}) - ${schedule.day} ${schedule.time}: ${eventId}`);
          } else {
            failedCount++;
            console.warn(`⚠️ Failed to sync schedule ${schedule._id} (${schedule.subject}) - calendar may not be shared`);
          }
        }
      } catch (error) {
        failedCount++;
        console.error(`❌ Error syncing schedule ${schedule._id} (${schedule.subject}):`, error.message);
      }
    }

    console.log(`✅ Auto-sync completed for ${normalizedEmail}: ${syncedCount} created, ${updatedCount} updated, ${failedCount} failed`);
  } catch (error) {
    console.error(`❌ Error during auto-sync for ${instructorEmail}:`, error.message);
  }
};

// Instructor Signup - Complete Registration
router.post('/signup', async (req, res) => {
  const { email, firstname, lastname, password, contact, department } = req.body;

  // Log what we received
  console.log('📝 Signup request received:', {
    email,
    firstname,
    lastname,
    contact,
    department,
    hasPassword: !!password
  });

  // Validation
  if (!email || !firstname || !lastname || !password || !contact || !department) {
    console.log('❌ Validation failed - missing fields');
    return res.status(400).json({ 
      message: 'All fields are required' 
    });
  }

  if (password.length < 6) {
    console.log('❌ Password too short');
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long' 
    });
  }

  try {
    // Find instructor by email
    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
      console.log('❌ No instructor found with email:', email);
      return res.status(404).json({ 
        message: 'No invitation found for this email address. Please contact the administrator.' 
      });
    }

    console.log('✅ Found instructor:', {
      id: instructor._id,
      email: instructor.email,
      currentStatus: instructor.status
    });

    if (instructor.status === 'active') {
      console.log('❌ Account already active');
      return res.status(400).json({ 
        message: 'This account has already been activated. Please login instead.' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update instructor with registration details
    instructor.firstname = firstname;
    instructor.lastname = lastname;
    instructor.password = hashedPassword;
    instructor.contact = contact;
    instructor.department = department;
    instructor.status = 'active';
    
    // Generate instructor ID if not exists
    if (!instructor.instructorId) {
      const count = await Instructor.countDocuments({ instructorId: { $exists: true, $ne: null } });
      instructor.instructorId = `BUKSU-INST-${String(count + 1).padStart(4, '0')}`;
    }

    await instructor.save();

    // Log what was saved
    console.log('✅ Instructor saved successfully:', {
      instructorId: instructor.instructorId,
      name: `${instructor.firstname} ${instructor.lastname}`,
      email: instructor.email,
      contact: instructor.contact,
      department: instructor.department,
      status: instructor.status
    });

    // ✅ CREATE ACTIVITY LOG for signup
    await logActivity({
      type: 'instructor-signup',
      message: `${firstname} ${lastname} (${department}) completed registration`,
      source: 'instructor',
      userEmail: email,
      link: '/admin/faculty-management',
      io: req.io
    });

    // Emit real-time notification to admin (optional)
    if (req.io) {
      req.io.emit('instructor-registered', {
        instructorId: instructor.instructorId,
        name: `${instructor.firstname} ${instructor.lastname}`,
        email: instructor.email,
        department: instructor.department,
        contact: instructor.contact,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true, 
      message: 'Registration completed successfully! You can now login with your credentials.' 
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({ 
      message: 'Registration failed. Please try again later.',
      error: error.message 
    });
  }
});

// Instructor Login
router.post('/login', loginLimiter, async (req, res) => {
  let { email, password, recaptchaToken } = req.body;
  // Validate input
  email = typeof email === 'string' ? email.trim().toLowerCase() : '';
  password = typeof password === 'string' ? password : '';
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  // Check reCAPTCHA
  if (!recaptchaToken) {
    return res.status(400).json({ message: 'Please complete the reCAPTCHA' });
  }
  try {
    const vr = await verifyRecaptcha(recaptchaToken);
    if (vr.skipped) {
      console.warn('⚠️ reCAPTCHA verification skipped (no secret configured)');
    } else if (!vr.success) {
      console.error('❌ reCAPTCHA verification failed for login:', vr);
      return res.status(400).json({ message: 'reCAPTCHA verification failed', details: vr.errorCodes || vr });
    }
  } catch (err) {
    console.error('Error during reCAPTCHA validation:', err);
    return res.status(500).json({ message: 'Error during reCAPTCHA validation' });
  }

  console.log('🔐 Login attempt for:', email);

  try {
    // Find instructor by email
    const instructor = await Instructor.findOne({ email });

    if (!instructor) {
      console.log('❌ No instructor found with email:', email);
      return res.status(404).json({ 
        message: 'Invalid email or password' 
      });
    }

    console.log('✅ Found instructor:', {
      id: instructor._id,
      instructorId: instructor.instructorId,
      email: instructor.email,
      status: instructor.status,
      hasPassword: !!instructor.password,
      hasContact: !!instructor.contact,
      hasDepartment: !!instructor.department
    });

    if (instructor.status !== 'active') {
      console.log('❌ Account not active, status:', instructor.status);
      return res.status(403).json({ 
        message: 'Your account is not active. Please complete registration or contact administrator.' 
      });
    }

    if (!instructor.password) {
      console.log('❌ No password set');
      return res.status(400).json({ 
        message: 'Please complete your registration first.' 
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, instructor.password);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      // Log failed login attempt
      await logActivity({
        type: 'instructor-login-failed',
        message: `Failed login attempt for ${email}`,
        source: 'instructor',
        userEmail: email,
        io: req.io
      });
      
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }

    console.log('✅ Login successful for:', instructor.email);

    // ✅ CREATE ACTIVITY LOG for login
    await logActivity({
      type: 'instructor-login',
      message: `${instructor.firstname} ${instructor.lastname} (${instructor.department}) logged in`,
      source: 'instructor',
      userEmail: instructor.email,
      link: '/instructor/dashboard',
      io: req.io
    });

    // ✅ AUTO-SYNC UNSYNCED SCHEDULES TO GOOGLE CALENDAR (non-blocking)
    // Run this asynchronously so it doesn't delay the login response
    syncUnsyncedSchedulesToCalendar(instructor.email).catch(err => {
      console.error('Error in background schedule sync:', err);
    });
  
    // Issue JWT token for the instructor
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables!');
      return res.status(500).json({ message: 'Server configuration error.' });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '1d'; // 1 day limit for account login
    const token = jwt.sign({ id: instructor._id, email: instructor.email }, process.env.JWT_SECRET, {
      expiresIn
    });

    // Return instructor data (without password) and token
    res.json({
      success: true,
      message: 'Login successful',
      token,
      instructor: {
        id: instructor._id,
        instructorId: instructor.instructorId,
        firstname: instructor.firstname,
        lastname: instructor.lastname,
        email: instructor.email,
        contact: instructor.contact,
        department: instructor.department,
        status: instructor.status
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      message: 'Login failed. Please try again later.',
      error: error.message 
    });
  }
});

// Check if email has pending invitation (optional - for validation)
router.get('/check-email/:email', async (req, res) => {
  try {
    const instructor = await Instructor.findOne({ email: req.params.email });
    
    if (!instructor) {
      return res.json({ exists: false, status: null });
    }

    res.json({ 
      exists: true, 
      status: instructor.status,
      hasPassword: !!instructor.password,
      department: instructor.department || null,
      contact: instructor.contact || null
    });

  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ 
      message: 'Error checking email',
      error: error.message 
    });
  }
});

// Instructor Logout
router.post('/logout', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find instructor to get their details
    const instructor = await Instructor.findOne({ email });
    
    if (!instructor) {
      return res.status(404).json({ message: 'Instructor not found' });
    }

    // ✅ LOG LOGOUT ACTIVITY
    await logActivity({
      type: 'instructor-logout',
      message: `${instructor.firstname} ${instructor.lastname} (${instructor.department}) logged out`,
      source: 'instructor',
      userEmail: email,
      link: '/instructor/login',
      io: req.io
    });

    res.json({ 
      success: true, 
      message: 'Logout successful' 
    });

  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ 
      message: 'Logout failed. Please try again later.',
      error: error.message 
    });
  }
});

export default router;
