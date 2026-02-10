import AdminMessage from '../models/AdminMessage.js';
import InstructorNotification from '../models/InstructorNotification.js';
import Instructor from '../models/Instructor.js';

// Send a message from admin to instructor and create notification
export const sendMessage = async (req, res) => {
  const { instructorId, adminId, message } = req.body;
  try {
    if (!instructorId || !message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Instructor and message are required.' });
    }
    const instructor = await Instructor.findById(instructorId).select('email').lean();
    if (!instructor || !instructor.email) {
      return res.status(404).json({ success: false, error: 'Instructor not found.' });
    }
    const newMessage = await AdminMessage.create({
      instructor: instructorId,
      admin: adminId || null,
      message: message.trim()
    });
    // Create notification using schema fields: instructorEmail, title, message, link, read
    await InstructorNotification.create({
      instructorEmail: instructor.email.toLowerCase().trim(),
      title: 'Admin Message',
      message: 'You have a new message from admin.',
      link: null,
      read: false
    });
    return res.status(201).json(newMessage);
  } catch (error) {
    console.error('Admin sendMessage error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to send message.' });
  }
};

// Get messages for an instructor
export const getMessagesForInstructor = async (req, res) => {
  const { instructorId } = req.params;
  try {
    if (!instructorId) {
      return res.status(400).json({ success: false, error: 'Instructor ID is required.' });
    }
    const messages = await AdminMessage.find({ instructor: instructorId }).sort({ createdAt: -1 }).lean();
    return res.json(messages);
  } catch (error) {
    console.error('getMessagesForInstructor error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch messages.' });
  }
};

// Mark a message as read
export const markMessageRead = async (req, res) => {
  const { messageId } = req.params;
  try {
    if (!messageId) {
      return res.status(400).json({ success: false, error: 'Message ID is required.' });
    }
    const message = await AdminMessage.findByIdAndUpdate(messageId, { read: true }, { new: true });
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }
    return res.json(message);
  } catch (error) {
    console.error('markMessageRead error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update message.' });
  }
};
