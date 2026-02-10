import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import * as weatherController from '../controllers/weatherController.js';

const router = express.Router();

/** GET /api/weather/current - Query: city (required), countryCode */
router.get('/current', weatherController.getCurrent);

/** GET /api/weather/forecast - Query: city (required), countryCode */
router.get('/forecast', weatherController.getForecast);

/** GET /api/weather/coordinates - Query: lat, lon (required) */
router.get('/coordinates', weatherController.getByCoordinates);

/** POST /api/weather/check-and-alert - Body: { city, countryCode, autoCreateAlert } - Admin */
router.post('/check-and-alert', verifyToken, weatherController.checkAndAlert);

/** GET /api/weather/scheduler/status */
router.get('/scheduler/status', weatherController.getSchedulerStatusHandler);

/** POST /api/weather/scheduler/trigger - Admin */
router.post('/scheduler/trigger', verifyToken, weatherController.triggerScheduler);

/** GET /api/weather/status */
router.get('/status', weatherController.getStatus);

export default router;
