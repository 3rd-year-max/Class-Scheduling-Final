import express from "express";
import {
  getRooms,
  login,
  getAlerts,
  getActivity,
  search,
  cleanupAlerts,
  deleteAlert,
  markAlertRead,
  deleteAllAlerts,
  createBackup,
} from "../controllers/adminController.js";

const router = express.Router();

// ===== ROOM ROUTES =====
router.get('/rooms', getRooms);

// ===== ADMIN AUTHENTICATION =====
router.post("/login", login);

// ===== ALERT/ACTIVITY LOG ROUTES =====
router.get('/alerts', getAlerts);
router.get('/activity', getActivity);

// ===== SEARCH =====
router.get('/search', search);

// ===== ALERT MANAGEMENT =====
router.delete('/alerts/cleanup', cleanupAlerts);
router.delete('/alerts/:id', deleteAlert);
router.put('/alerts/:id/read', markAlertRead);
router.delete('/alerts', deleteAllAlerts);

// ===== BACKUP =====
router.get('/backup', createBackup);

export default router;
