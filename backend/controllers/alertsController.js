import Alert from '../models/Alert.js';

/**
 * GET /api/admin/alerts
 * Return all alerts sorted by most recent
 */
export const getAllAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching alerts.' });
  }
};
