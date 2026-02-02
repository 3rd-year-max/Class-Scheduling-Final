import express from 'express';
import { getAllAlerts } from '../controllers/alertsController.js';

const router = express.Router();

router.get('/alerts', getAllAlerts);

export default router;
