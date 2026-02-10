import express from 'express';
import { getAllYearLevels, createYearLevel } from '../controllers/yearLevelController.js';

const router = express.Router();

router.get('/', getAllYearLevels);
router.post('/', createYearLevel);

export default router;
