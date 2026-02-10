import Room from '../models/Room.js';
import Alert from '../models/Alert.js';
import InstructorNotification from '../models/InstructorNotification.js';
import Instructor from '../models/Instructor.js';
import { logActivity } from '../utils/activityLogger.js';
import { detectAndEmitChange } from '../utils/dataChangeDetector.js';

export const testNotifyStatusChange = async (req, res) => {
  try {
    const testData = {
      roomId: 'test-id',
      roomName: 'Lab A (TEST)',
      area: 'Building A',
      newStatus: 'maintenance',
      oldStatus: 'available',
      message: 'The room Lab A (TEST) is currently on maintenance.',
      timestamp: new Date()
    };
    req.io?.emit('room-status-changed', testData);
    res.json({ success: true, message: 'Test notification sent', data: testData });
  } catch (err) {
    console.error('Test notification error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ archived: { $ne: true } });
    detectAndEmitChange('rooms', rooms, req.io, 'data-updated:rooms');
    res.json({ rooms });
  } catch (err) {
    console.error('Error fetching rooms:', err);
    res.status(500).json({ message: 'Server error fetching rooms' });
  }
};

export const getArchivedRooms = async (req, res) => {
  try {
    const archivedRooms = await Room.find({ archived: true });
    res.json(archivedRooms);
  } catch (err) {
    console.error('Error fetching archived rooms:', err);
    res.status(500).json({ success: false, message: 'Error fetching archived rooms', error: err.message });
  }
};

export const addRoom = async (req, res) => {
  try {
    const { room: roomName, area, status } = req.body;

    if (!roomName || !area) {
      return res.status(400).json({ success: false, message: 'Room name and area are required.' });
    }

    const newRoom = new Room({
      room: roomName,
      area,
      status: status || 'available'
    });

    await newRoom.save();

    await logActivity({
      type: 'room-added',
      message: `Room ${newRoom.room} (${newRoom.area}) added`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: newRoom.room, area: newRoom.area, status: newRoom.status },
      io: req.io
    });

    res.status(201).json({ success: true, message: 'Room added successfully', room: newRoom });
  } catch (err) {
    console.error('Error adding room:', err);
    res.status(500).json({ success: false, message: 'Server error while adding room' });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const originalRoom = await Room.findById(req.params.id);
    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedRoom) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await logActivity({
      type: 'room-updated',
      message: `Room ${updatedRoom.room} updated`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: updatedRoom.room, area: updatedRoom.area, status: updatedRoom.status },
      io: req.io
    });

    if (originalRoom && originalRoom.status !== updatedRoom.status) {
      const statusMessages = {
        maintenance: `The room ${updatedRoom.room} is currently on maintenance.`,
        available: `The room ${updatedRoom.room} is now available.`,
        occupied: `The room ${updatedRoom.room} is now occupied.`
      };

      const notificationData = {
        roomId: updatedRoom._id,
        roomName: updatedRoom.room,
        area: updatedRoom.area,
        newStatus: updatedRoom.status,
        oldStatus: originalRoom.status,
        message: statusMessages[updatedRoom.status] || `Room ${updatedRoom.room} status has been updated.`,
        timestamp: new Date()
      };

      req.io?.emit('room-status-changed', notificationData);

      try {
        const allInstructors = await Instructor.find({ status: 'active' });
        const instructorEmails = allInstructors.map(inst => inst.email);

        if (instructorEmails.length > 0) {
          await InstructorNotification.insertMany(
            instructorEmails.map(email => ({
              instructorEmail: email,
              title: `Room Status Updated: ${updatedRoom.room}`,
              message: notificationData.message,
              link: '/instructor/rooms',
              read: false,
              createdAt: new Date()
            }))
          );
        }
      } catch (err) {
        console.error('Error saving room notification:', err);
      }
    }

    res.json({ success: true, room: updatedRoom });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ success: false, message: 'Server error while updating room.' });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const deletedRoom = await Room.findByIdAndDelete(req.params.id);
    if (!deletedRoom) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await logActivity({
      type: 'room-deleted',
      message: `Room ${deletedRoom.room} (${deletedRoom.area}) deleted`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: deletedRoom.room, area: deletedRoom.area },
      io: req.io
    });

    res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting room.' });
  }
};

export const archiveRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { archived: true }, { new: true });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await logActivity({
      type: 'room-archived',
      message: `Room ${room.room} (${room.area}) archived`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: room.room, area: room.area },
      io: req.io
    });

    res.json({ success: true, message: 'Room archived successfully.', room });
  } catch (error) {
    console.error('Error archiving room:', error);
    res.status(500).json({ success: false, message: 'Server error while archiving room.' });
  }
};

export const restoreRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, { archived: false }, { new: true });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await logActivity({
      type: 'room-restored',
      message: `Room ${room.room} (${room.area}) restored`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: room.room, area: room.area },
      io: req.io
    });

    res.json({ success: true, message: 'Room restored successfully.', room });
  } catch (error) {
    console.error('Error restoring room:', error);
    res.status(500).json({ success: false, message: 'Server error while restoring room.' });
  }
};

export const permanentDeleteRoom = async (req, res) => {
  try {
    const deletedRoom = await Room.findByIdAndDelete(req.params.id);
    if (!deletedRoom) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    await logActivity({
      type: 'room-deleted-permanent',
      message: `Room ${deletedRoom.room} (${deletedRoom.area}) permanently deleted`,
      source: 'admin',
      link: '/admin/room-management',
      meta: { room: deletedRoom.room, area: deletedRoom.area },
      io: req.io
    });

    res.json({ success: true, message: 'Room permanently deleted.' });
  } catch (error) {
    console.error('Error permanently deleting room:', error);
    res.status(500).json({ success: false, message: 'Server error while permanently deleting room.' });
  }
};
