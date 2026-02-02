import InstructorNotification from '../models/InstructorNotification.js';

/** Health check endpoint */
export const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Notifications endpoint is accessible',
    timestamp: new Date().toISOString()
  });
};

/** GET current instructor's notifications (with pagination) */
export const getNotifications = async (req, res) => {
  try {
    const email = req.userEmail;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await InstructorNotification.countDocuments({ instructorEmail: email });
    const unreadCount = await InstructorNotification.countDocuments({ instructorEmail: email, read: false });
    const notifications = await InstructorNotification
      .find({ instructorEmail: email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      unreadCount
    });
  } catch (err) {
    console.error('Fetch instructor notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

/** PATCH mark single notification as read */
export const markNotificationRead = async (req, res) => {
  try {
    const email = req.userEmail;
    const { id } = req.params;
    const updated = await InstructorNotification.findOneAndUpdate(
      { _id: id, instructorEmail: email },
      { $set: { read: true } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification: updated });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ success: false, message: 'Server error updating notification' });
  }
};

/** PATCH mark all as read */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const email = req.userEmail;
    await InstructorNotification.updateMany({ instructorEmail: email, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ success: false, message: 'Server error updating notifications' });
  }
};
