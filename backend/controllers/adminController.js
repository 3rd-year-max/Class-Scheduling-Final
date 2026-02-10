import mongoose from 'mongoose';
import Admin from "../models/Admin.js";
import Room from '../models/Room.js';
import Alert from '../models/Alert.js';
import InstructorNotification from '../models/InstructorNotification.js';
import bcrypt from 'bcryptjs';
import archiver from 'archiver';
import Schedule from '../models/Schedule.js';
import Instructor from '../models/Instructor.js';
import ScheduleTemplate from '../models/ScheduleTemplate.js';
import Section from '../models/Section.js';
import YearLevelModel from '../models/YearLevelModel.js';
import { logActivity } from '../utils/activityLogger.js';

// Helper function to create regex that handles plural/singular forms
const createPluralSingularRegex = (query) => {
  const words = query.trim().split(/\s+/);
  const getWordPatterns = (word) => {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [escapedWord];
    if (/y$/i.test(word) && word.length > 1) {
      patterns.push(escapedWord.slice(0, -1) + 'ies');
    } else if (/ies$/i.test(word)) {
      patterns.push(escapedWord.slice(0, -3) + 'y');
    }
    if (/[sxz]|[cs]h$/i.test(word) && !word.endsWith('es')) {
      patterns.push(escapedWord + 'es');
    } else if (/es$/i.test(word) && /[sxz]|[cs]h$/i.test(word.slice(0, -2))) {
      patterns.push(escapedWord.slice(0, -2));
    }
    if (!word.endsWith('s') && !word.endsWith('es') && !word.endsWith('ies')) {
      patterns.push(escapedWord + 's');
    } else if (word.endsWith('s') && !word.endsWith('es') && !word.endsWith('ies') && word.length > 1) {
      patterns.push(escapedWord.slice(0, -1));
    }
    return [...new Set(patterns)];
  };
  if (words.length === 1) {
    const patterns = getWordPatterns(words[0]);
    const regexPattern = patterns.map(p => `(${p})`).join('|');
    return new RegExp(regexPattern, 'i');
  } else {
    const wordPatternArrays = words.map(word => getWordPatterns(word));
    const combinedPattern = words.map((word, idx) => {
      const patterns = wordPatternArrays[idx];
      return `(${patterns.join('|')})`;
    }).join('\\s+');
    return new RegExp(combinedPattern, 'i');
  }
};

/** GET /api/admin/rooms - Get all rooms with status */
export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({});
    res.json({ rooms });
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ message: 'Server error fetching rooms' });
  }
};

/** POST /api/admin/login - Admin login */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required."
      });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });

    if (!admin) {
      await logActivity({
        type: 'admin-login-failed',
        message: 'Failed admin login attempt - username not found',
        source: 'admin',
        io: req.io
      });
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    let isValid;
    if (admin.password.length < 20) {
      isValid = (password.trim() === admin.password.trim());
      if (isValid) {
        const hash = await bcrypt.hash(password, 10);
        admin.password = hash;
        await admin.save();
      }
    } else {
      isValid = await bcrypt.compare(password, admin.password);
    }

    if (isValid) {
      await logActivity({
        type: 'admin-login',
        message: 'Admin logged in',
        source: 'admin',
        link: '/admin/dashboard',
        io: req.io
      });
      return res.json({ success: true, message: "Login successful!" });
    } else {
      await logActivity({
        type: 'admin-login-failed',
        message: 'Failed admin login attempt - wrong password',
        source: 'admin',
        io: req.io
      });
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};

/** GET /api/admin/alerts - Get all alerts/activity logs */
export const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    return res.json({ success: true, alerts });
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching alerts.'
    });
  }
};

/** GET /api/admin/activity - Get all activities with pagination */
export const getActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const alerts = await Alert.find({}).sort({ createdAt: -1 }).lean();
    const normalized = alerts.map((a) => ({
      id: String(a._id),
      source: a.source || 'admin',
      type: a.type || 'alert',
      message: a.message,
      link: a.link || null,
      createdAt: a.createdAt || a.updatedAt,
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = normalized.length;
    const paginated = normalized.slice(skip, skip + limit);

    return res.json({
      success: true,
      activities: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Failed to fetch activity:', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching activity' });
  }
};

/** GET /api/admin/search - Unified search (rooms, instructors, schedules) with pagination */
export const search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ rooms: [], instructors: [], schedules: [], pagination: { rooms: {}, instructors: {}, schedules: {} } });

    await logActivity({
      type: 'search-performed',
      message: `Search performed: "${q}"`,
      source: 'admin',
      link: `/admin/search?q=${encodeURIComponent(q)}`,
      meta: { query: q },
      io: req.io
    });

    const regex = createPluralSingularRegex(q);
    const roomsPage = parseInt(req.query.roomsPage) || 1;
    const instructorsPage = parseInt(req.query.instructorsPage) || 1;
    const schedulesPage = parseInt(req.query.schedulesPage) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const roomsSkip = (roomsPage - 1) * limit;
    const instructorsSkip = (instructorsPage - 1) * limit;
    const schedulesSkip = (schedulesPage - 1) * limit;

    const roomSearch = { $or: [{ room: regex }, { area: regex }, { status: regex }] };
    const instructorSearch = {
      $or: [
        { firstname: regex },
        { lastname: regex },
        { email: regex },
        { department: regex },
        { instructorId: regex },
        { contact: regex }
      ]
    };
    const scheduleSearch = {
      $or: [
        { subject: regex },
        { course: regex },
        { section: regex },
        { room: regex },
        { day: regex },
        { instructor: regex },
        { year: regex }
      ]
    };

    const [roomsCount, instructorsCount, schedulesCount, rooms, instructors, schedules] = await Promise.all([
      Room.countDocuments(roomSearch),
      Instructor.countDocuments(instructorSearch),
      Schedule.countDocuments(scheduleSearch),
      Room.find(roomSearch).skip(roomsSkip).limit(limit).lean(),
      Instructor.find(instructorSearch).skip(instructorsSkip).limit(limit).lean(),
      Schedule.find(scheduleSearch).skip(schedulesSkip).limit(limit).lean(),
    ]);

    return res.json({
      rooms,
      instructors,
      schedules,
      pagination: {
        rooms: {
          page: roomsPage,
          limit,
          total: roomsCount,
          totalPages: Math.ceil(roomsCount / limit),
          hasNext: roomsPage < Math.ceil(roomsCount / limit),
          hasPrev: roomsPage > 1
        },
        instructors: {
          page: instructorsPage,
          limit,
          total: instructorsCount,
          totalPages: Math.ceil(instructorsCount / limit),
          hasNext: instructorsPage < Math.ceil(instructorsCount / limit),
          hasPrev: instructorsPage > 1
        },
        schedules: {
          page: schedulesPage,
          limit,
          total: schedulesCount,
          totalPages: Math.ceil(schedulesCount / limit),
          hasNext: schedulesPage < Math.ceil(schedulesCount / limit),
          hasPrev: schedulesPage > 1
        }
      }
    });
  } catch (err) {
    console.error('Search failed:', err);
    return res.status(500).json({ rooms: [], instructors: [], schedules: [], pagination: { rooms: {}, instructors: {}, schedules: {} } });
  }
};

/** DELETE /api/admin/alerts/cleanup - Clean up undefined/invalid alerts */
export const cleanupAlerts = async (req, res) => {
  try {
    const result = await Alert.deleteMany({ message: /undefined/i });
    console.log(`✅ Cleaned up ${result.deletedCount} invalid alerts`);
    return res.json({ success: true, message: `Cleaned up ${result.deletedCount} invalid alerts` });
  } catch (error) {
    console.error('❌ Error cleaning alerts:', error);
    return res.status(500).json({ success: false, message: 'Error cleaning alerts' });
  }
};

/** DELETE /api/admin/alerts/:id - Delete a specific alert */
export const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
    }
    const result = await Alert.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    return res.json({ success: true, message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return res.status(500).json({ success: false, message: 'Error deleting alert' });
  }
};

/** PUT /api/admin/alerts/:id/read - Mark alert as read */
export const markAlertRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid alert ID.' });
    }
    const alert = await Alert.findByIdAndUpdate(id, { read: true }, { new: true });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    return res.json({ success: true, message: 'Alert marked as read', alert });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    return res.status(500).json({ success: false, message: 'Error updating alert' });
  }
};

/** DELETE /api/admin/alerts - Delete all alerts */
export const deleteAllAlerts = async (req, res) => {
  try {
    const result = await Alert.deleteMany({});
    console.log(`✅ Deleted all ${result.deletedCount} alerts`);
    return res.json({ success: true, message: `Deleted all ${result.deletedCount} alerts` });
  } catch (error) {
    console.error('❌ Error deleting all alerts:', error);
    return res.status(500).json({ success: false, message: 'Error deleting alerts' });
  }
};

/** GET /api/admin/backup - Download system data as ZIP */
export const createBackup = async (req, res) => {
  try {
    const adminKey = process.env.ADMIN_BACKUP_KEY;
    if (adminKey) {
      const providedKey = req.headers['x-admin-backup-key'] || req.query.key;
      if (!providedKey || String(providedKey) !== String(adminKey)) {
        return res.status(403).json({ success: false, message: 'Forbidden: invalid backup key' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Backup endpoint disabled. Configure ADMIN_BACKUP_KEY to enable.' });
    }

    const [schedules, instructors, rooms, sections, templates, yearLevels, alerts, notifications] = await Promise.all([
      Schedule.find({}).lean(),
      Instructor.find({}).lean(),
      Room.find({}).lean(),
      Section.find({}).lean(),
      ScheduleTemplate.find({}).lean(),
      YearLevelModel.find({}).lean(),
      Alert.find({}).lean(),
      InstructorNotification.find({}).lean(),
    ]);

    const backupData = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        collections: {
          schedules: schedules.length,
          instructors: instructors.length,
          rooms: rooms.length,
          sections: sections.length,
          templates: templates.length,
          yearLevels: yearLevels.length,
          alerts: alerts.length,
          notifications: notifications.length,
        },
      },
      data: { schedules, instructors, rooms, sections, templates, yearLevels, alerts, notifications },
    };

    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="class-scheduling-backup-${timestamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Error creating backup' });
    });
    archive.pipe(res);

    archive.append(JSON.stringify(backupData, null, 2), { name: `backup-${timestamp}/data.json` });
    const readme = `# Class Scheduling System Backup\n\n## Export Date: ${new Date().toLocaleString()}\n## Version: 1.0\n\n### Collections Included:\n- Schedules: ${schedules.length}\n- Instructors: ${instructors.length}\n- Rooms: ${rooms.length}\n- Sections: ${sections.length}\n- Templates: ${templates.length}\n- Year Levels: ${yearLevels.length}\n- Alerts: ${alerts.length}\n- Notifications: ${notifications.length}\n\n### How to Use:\n1. Extract this ZIP file\n2. The 'data.json' file contains all system data\n3. Keep this backup in a safe location\n4. For restoration, contact your system administrator\n\n### Backup Information:\n- Format: JSON\n- Compression: ZIP\n- Total Items: ${schedules.length + instructors.length + rooms.length + sections.length + templates.length + yearLevels.length + alerts.length + notifications.length}\n`;
    archive.append(readme, { name: `backup-${timestamp}/README.md` });

    await archive.finalize();

    await logActivity({
      type: 'BACKUP',
      message: `System backup created with ${schedules.length + instructors.length + rooms.length} items`,
      source: 'admin',
      meta: { action: 'DATA_EXPORT' },
      io: req.io
    });
  } catch (error) {
    console.error('❌ Error creating backup:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error creating backup' });
  }
};
