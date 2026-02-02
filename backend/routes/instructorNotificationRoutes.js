import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  healthCheck,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/instructorNotificationController.js';

const router = express.Router();

router.get('/notifications/health', healthCheck);
router.get('/notifications', verifyToken, getNotifications);
router.patch('/notifications/:id/read', verifyToken, markNotificationRead);
router.patch('/notifications/read-all', verifyToken, markAllNotificationsRead);

export default router;
