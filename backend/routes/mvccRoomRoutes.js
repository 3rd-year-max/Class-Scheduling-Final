/**
 * MVCC-Enhanced Room Routes
 * Implements double-booking prevention and room status versioning
 */

import express from "express";
import Room from "../models/Room.js";
import Schedule from "../models/Schedule.js";
import { withRetry, MVCCTransaction } from "../middleware/mvccTransaction.js";
import { updateWithVersionControl } from "../utils/mvccManager.js";

const router = express.Router();

/**
 * GET /api/rooms/available
 * Return deduplicated list of rooms that are not archived and not under maintenance
 * This is intended for room suggestion lists when creating schedules
 * MUST BE BEFORE router.get('/:id/*') to avoid being caught as a route parameter
 */
router.get('/available', async (req, res) => {
  try {
    // Find rooms that are not archived and not under maintenance
    let rooms = await Room.find({ archived: false, status: { $ne: 'maintenance' } })
      .select('room area status archived createdAt updatedAt _id')
      .lean();

    // Deduplicate by normalized room name (case-insensitive, trimmed)
    const byName = new Map();
    for (const r of rooms) {
      const key = (r.room || '').toString().trim().toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, r);
        continue;
      }

      const existing = byName.get(key);
      // Prefer non-archived entries (all are non-archived here) — prefer most recently updated
      const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
      const rUpdated = r.updatedAt ? new Date(r.updatedAt) : new Date(0);
      if (rUpdated > existingUpdated) {
        byName.set(key, r);
      }
    }

    const deduped = Array.from(byName.values()).sort((a, b) => (a.room || '').localeCompare(b.room || ''));

    // Return an array (legacy-friendly) — frontend suggestion lists expect array
    res.json(deduped);
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    res.status(500).json({ success: false, message: 'Server error fetching available rooms', error: error.message });
  }
});

/**
 * GET /api/rooms/archived/list
 * Return archived rooms list
 * MUST BE BEFORE router.get('/:id/*') to avoid being caught as a route parameter
 */
router.get('/archived/list', async (req, res) => {
  try {
    const archivedRooms = await Room.find({ archived: true }).select('room area status archived createdAt updatedAt _id').lean();
    return res.json(archivedRooms || []);
  } catch (err) {
    console.error('Error fetching archived rooms (mvcc):', err);
    res.status(500).json({ success: false, message: 'Error fetching archived rooms', error: err.message });
  }
});

/**
 * GET /api/rooms
 * Return list of rooms (compatibility read endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const { showArchived } = req.query;
    const query = {};
    
    // Filter out archived rooms by default unless explicitly requested
    if (showArchived !== 'true') {
      query.archived = false;
    }
    
    let rooms = await Room.find(query).select('room area status archived createdAt updatedAt _id __v').lean();

    // Deduplicate rooms by normalized name (case-insensitive, trimmed)
    const byName = new Map();
    for (const r of rooms) {
      const key = (r.room || '').toString().trim().toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, r);
        continue;
      }

      const existing = byName.get(key);
      // Prefer non-archived entries
      if (existing.archived && !r.archived) {
        byName.set(key, r);
        continue;
      }

      // If both have same archived flag, prefer the most recently updated
      const existingUpdated = existing.updatedAt ? new Date(existing.updatedAt) : new Date(0);
      const rUpdated = r.updatedAt ? new Date(r.updatedAt) : new Date(0);
      if (rUpdated > existingUpdated) {
        byName.set(key, r);
      }
    }

    const deduped = Array.from(byName.values()).sort((a, b) => (a.room || '').localeCompare(b.room || ''));
    res.json(deduped);
  } catch (error) {
    console.error('Error fetching rooms list:', error);
    res.status(500).json({ success: false, message: 'Server error fetching rooms' });
  }
});

/**
 * POST create room with MVCC protection
 */
router.post("/create-mvcc", async (req, res) => {
  try {
    const { room, area } = req.body;
    let status = req.body.status;
    if (!room || !area) {
      return res.status(400).json({
        success: false,
        message: "Room name and area are required",
        code: "VALIDATION_ERROR"
      });
    }
    if (!status || !['available', 'occupied', 'maintenance'].includes(status)) {
      status = 'available';
    }
    const transaction = new MVCCTransaction(req.userId || 'system', 'room_creation');
    // Check for duplicate room name (case-insensitive)
    const existingRoom = await Room.findOne({ 
      room: { $regex: new RegExp(`^${room}$`, 'i') } 
    });
    if (existingRoom) {
      return res.status(409).json({
        success: false,
        message: `Room "${room}" already exists. Please choose a different name.`,
        code: "DUPLICATE_ROOM"
      });
    }
    const newRoom = new Room({
      room,
      area,
      status
    });
    await newRoom.save();
    transaction.addOperation(newRoom._id, 'create', newRoom.__v, newRoom);
    const txnRecord = transaction.commit();
    res.status(201).json({
      success: true,
      message: "Room created with MVCC protection",
      room: newRoom,
      transaction: txnRecord
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Room already exists",
        code: "DUPLICATE_ERROR"
      });
    }

    console.error("Room creation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating room",
      error: error.message
    });
  }
});

/**
 * PUT update room status with optimistic locking
 * Prevents concurrent status conflicts
 */
router.put("/:id/status-mvcc", async (req, res) => {
  try {
    const { id } = req.params;
    const { version, status, reason } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message: "Version field required for optimistic locking",
        code: "VERSION_REQUIRED"
      });
    }

    if (!['available', 'occupied', 'maintenance'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be: available, occupied, or maintenance",
        code: "INVALID_STATUS"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'room_status_update');

    const updatedRoom = await withRetry(async () => {
      // Check for conflicts if changing to maintenance
      if (status === 'maintenance') {
        const activeSchedules = await Schedule.countDocuments({
          room: (await Room.findById(id)).room,
          archived: false
        });

        if (activeSchedules > 0) {
          throw new Error(
            `Cannot set room to maintenance: ${activeSchedules} active schedules exist`
          );
        }
      }

      return await updateWithVersionControl(Room, id, version, { status });
    }, 3, 100);

    transaction.addOperation(id, 'status_update', updatedRoom.__v, updatedRoom);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: `Room status updated to ${status}`,
      room: updatedRoom,
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

    if (error.message?.includes('maintenance')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: "ACTIVE_SCHEDULES"
      });
    }

    console.error("Room status update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating room status",
      error: error.message
    });
  }
});

/**
 * PUT update room details with optimistic locking
 */
router.put("/:id/update-mvcc", async (req, res) => {
  try {
    const { id } = req.params;
    const { version, room, area, status } = req.body;

    if (version === undefined) {
      return res.status(400).json({
        success: false,
        message: "Version field required for optimistic locking",
        code: "VERSION_REQUIRED"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'room_update');

    const updatedRoom = await withRetry(async () => {
      // Check for name conflicts if changing room name
      if (room) {
        const existingRoom = await Room.findOne({
          room,
          _id: { $ne: id }
        });

        if (existingRoom) {
          throw new Error(`Room name ${room} already in use`);
        }
      }

      return await updateWithVersionControl(Room, id, version, { room, area, status });
    }, 3, 100);

    transaction.addOperation(id, 'update', updatedRoom.__v, updatedRoom);
    const txnRecord = transaction.commit();

    res.json({
      success: true,
      message: "Room updated with optimistic locking",
      room: updatedRoom,
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

    if (error.message?.includes('already in use')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: "DUPLICATE_NAME"
      });
    }

    console.error("Room update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating room",
      error: error.message
    });
  }
});

/**
 * GET room with version info and booking status
 */
router.get("/:id/version", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Get booking statistics
    const totalSchedules = await Schedule.countDocuments({
      room: room.room,
      archived: false
    });

    const upcomingSchedules = await Schedule.countDocuments({
      room: room.room,
      archived: false,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      room: {
        _id: room._id,
        __v: room.__v,
        room: room.room,
        area: room.area,
        status: room.status,
        archived: room.archived,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        bookingStats: {
          totalSchedules,
          upcomingSchedules,
          lastModified: room.updatedAt
        }
      }
    });

  } catch (error) {
    console.error("Error fetching room version:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching room"
    });
  }
});

/**
 * POST check room availability for time slot
 * Prevents double-booking before schedule creation
 */
router.post("/:id/check-availability", async (req, res) => {
  try {
    const { id } = req.params;
    const { day, timeStart, timeEnd } = req.body;

    if (!day || !timeStart || !timeEnd) {
      return res.status(400).json({
        success: false,
        message: "Day, timeStart, and timeEnd are required",
        code: "VALIDATION_ERROR"
      });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Check for conflicting schedules
    const conflicts = await Schedule.find({
      room: room.room,
      day,
      archived: false,
      $or: [
        { timeStart: { $lt: timeEnd }, timeEnd: { $gt: timeStart } }
      ]
    });

    res.json({
      success: true,
      room: room.room,
      day,
      available: conflicts.length === 0,
      conflicts: conflicts.length,
      conflictingSchedules: conflicts.map(s => ({
        _id: s._id,
        subject: s.subject,
        instructor: s.instructor,
        day: s.day,
        time: s.time
      }))
    });

  } catch (error) {
    console.error("Error checking room availability:", error);
    res.status(500).json({
      success: false,
      message: "Server error checking availability",
      error: error.message
    });
  }
});

/**
 * GET room booking conflicts
 * Lists all time slots with conflicts
 */
router.get("/:id/conflicts", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const schedules = await Schedule.find({
      room: room.room,
      archived: false
    }).sort({ day: 1, time: 1 });

    // Group by day
    const byDay = {};
    schedules.forEach(s => {
      if (!byDay[s.day]) byDay[s.day] = [];
      byDay[s.day].push({
        _id: s._id,
        subject: s.subject,
        instructor: s.instructor,
        time: s.time,
        course: s.course,
        section: s.section
      });
    });

    res.json({
      success: true,
      room: room.room,
      status: room.status,
      totalSchedules: schedules.length,
      schedulesByDay: byDay
    });

  } catch (error) {
    console.error("Error fetching room conflicts:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching conflicts",
      error: error.message
    });
  }
});

/**
 * POST bulk update room status with transaction support
 */
router.post("/bulk/status-mvcc", async (req, res) => {
  try {
    const { rooms } = req.body;

    if (!Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Rooms array required",
        code: "INVALID_INPUT"
      });
    }

    const transaction = new MVCCTransaction(req.userId || 'system', 'bulk_room_status_update');
    const updated = [];
    const failed = [];

    for (const roomData of rooms) {
      try {
        const result = await updateWithVersionControl(
          Room,
          roomData._id,
          roomData.__v,
          { status: roomData.status }
        );

        transaction.addOperation(roomData._id, 'status_update', result.__v, result);
        updated.push(result);

      } catch (error) {
        failed.push({
          roomId: roomData._id,
          error: error.message
        });
      }
    }

    transaction.status = failed.length > 0 ? 'partial_success' : 'success';
    const txnRecord = transaction.commit();

    res.json({
      success: failed.length === 0,
      message: `Updated ${updated.length} rooms${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      updated: updated.length,
      failed: failed.length,
      rooms: updated,
      failures: failed,
      transaction: txnRecord
    });

  } catch (error) {
    console.error("Bulk room status update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating rooms",
      error: error.message
    });
  }
});

/**
 * GET room concurrency statistics
 */
router.get("/stats/concurrency", async (req, res) => {
  try {
    const stats = await Room.aggregate([
      {
        $group: {
          _id: "$__v",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const totalRooms = await Room.countDocuments();
    const recentlyModified = await Room.countDocuments({
      updatedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    });

    const statusDistribution = await Room.aggregate([
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
        totalRooms,
        recentlyModified,
        versionDistribution: stats,
        statusDistribution
      }
    });

  } catch (error) {
    console.error("Error fetching room concurrency stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching statistics"
    });
  }
});

// ------------------ Compatibility routes (legacy paths for rooms) ------------------

// POST /create (legacy)
router.post('/create', async (req, res) => {
  try {
    const { room, area } = req.body;
    let status = req.body.status;
    if (!room || !area) return res.status(400).json({ success: false, message: 'Room name and area are required', code: 'VALIDATION_ERROR' });
    if (!status || !['available', 'occupied', 'maintenance'].includes(status)) {
      status = 'available';
    }
    const transaction = new MVCCTransaction(req.userId || 'system', 'room_creation');
    // Check for duplicate room name (case-insensitive)
    const existingRoom = await Room.findOne({ 
      room: { $regex: new RegExp(`^${room}$`, 'i') } 
    });
    if (existingRoom) {
      return res.status(409).json({ 
        success: false, 
        message: `Room "${room}" already exists. Please choose a different name.`, 
        code: 'DUPLICATE_ROOM' 
      });
    }
    const newRoom = new Room({ room, area, status });
    await newRoom.save();
    transaction.addOperation(newRoom._id, 'create', newRoom.__v, newRoom);
    const txnRecord = transaction.commit();
    res.status(201).json({ success: true, message: 'Room created', room: newRoom, transaction: txnRecord });
  } catch (error) {
    console.error('Compatibility create room error:', error);
    res.status(500).json({ success: false, message: 'Server error creating room', error: error.message });
  }
});

// PATCH /:id/archive (archive/restore compatibility handlers - MUST BE BEFORE PUT /:id)
router.patch('/:id/archive', async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, message: 'Room archived successfully.', room });
  } catch (error) {
    console.error('Error archiving room (mvcc):', error);
    res.status(500).json({ success: false, message: 'Server error while archiving room.' });
  }
});

router.patch('/:id/restore', async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { archived: false }, { new: true });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, message: 'Room restored successfully.', room });
  } catch (error) {
    console.error('Error restoring room (mvcc):', error);
    res.status(500).json({ success: false, message: 'Server error while restoring room.' });
  }
});

router.delete('/:id/permanent', async (req, res) => {
  try {
    const deletedRoom = await Room.findByIdAndDelete(req.params.id);
    if (!deletedRoom) return res.status(404).json({ success: false, message: 'Room not found.' });
    res.json({ success: true, message: 'Room permanently deleted.' });
  } catch (error) {
    console.error('Error permanently deleting room (mvcc):', error);
    res.status(500).json({ success: false, message: 'Server error while permanently deleting room.' });
  }
});

// PUT /:id (legacy) - general update
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, room, area, status } = req.body;

    if (version !== undefined) {
      const transaction = new MVCCTransaction(req.userId || 'system', 'room_update');
      const updatedRoom = await withRetry(async () => {
        if (room) {
          const existingRoom = await Room.findOne({ room, _id: { $ne: id } });
          if (existingRoom) throw new Error(`Room name ${room} already in use`);
        }
        return await updateWithVersionControl(Room, id, version, { room, area, status });
      }, 3, 100);

      transaction.addOperation(id, 'update', updatedRoom.__v, updatedRoom);
      const txnRecord = transaction.commit();
      res.json({ success: true, message: 'Room updated', room: updatedRoom, transaction: txnRecord });
      return;
    }

    // Legacy fallback
    const existing = await Room.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room !== undefined) existing.room = room;
    if (area !== undefined) existing.area = area;
    if (status !== undefined) existing.status = status;
    await existing.save();
    res.json({ success: true, message: 'Room updated (legacy)', room: existing });
  } catch (error) {
    if (error.message?.includes('Version conflict')) return res.status(409).json({ success: false, message: 'Concurrent update detected. Please refresh.', code: 'VERSION_CONFLICT' });
    if (error.message?.includes('already in use')) return res.status(409).json({ success: false, message: error.message, code: 'DUPLICATE_NAME' });
    console.error('Compatibility room update error:', error);
    res.status(500).json({ success: false, message: 'Server error updating room', error: error.message });
  }
});

/**
 * GET /api/rooms/:id
 * Fetch a single room by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID' });
    }

    const room = await Room.findById(id)
      .select('room area status archived createdAt updatedAt _id __v')
      .lean();
    
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    return res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ success: false, message: 'Server error fetching room' });
  }
});

// DELETE /:id (legacy)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.body || {};
    if (version !== undefined) {
      const deleted = await Room.findOneAndDelete({ _id: id, __v: version });
      if (!deleted) return res.status(409).json({ success: false, message: 'Version conflict or document not found', code: 'VERSION_CONFLICT' });
      return res.json({ success: true, message: 'Room deleted', room: deleted });
    }
    const deleted = await Room.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, message: 'Room deleted', room: deleted });
  } catch (error) {
    console.error('Compatibility room delete error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting room', error: error.message });
  }
});

export default router;
