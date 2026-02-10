import express from 'express';
import {
  testNotifyStatusChange,
  getRooms,
  getArchivedRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  archiveRoom,
  restoreRoom,
  permanentDeleteRoom,
} from '../controllers/roomController.js';

const router = express.Router();

router.get('/test/notify-status-change', testNotifyStatusChange);
router.get('/', getRooms);
router.get('/archived/list', getArchivedRooms);
router.post('/', addRoom);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);
router.patch('/:id/archive', archiveRoom);
router.patch('/:id/restore', restoreRoom);
router.delete('/:id/permanent', permanentDeleteRoom);

export default router;
