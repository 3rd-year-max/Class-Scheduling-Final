import express from 'express';
import {
  createSection,
  getSections,
  getArchivedSections,
  archiveSection,
  restoreSection,
  permanentDeleteSection,
} from '../controllers/sectionController.js';

const router = express.Router();

router.post('/create', createSection);
router.get('/', getSections);
router.get('/archived/list', getArchivedSections);
router.patch('/:id/archive', archiveSection);
router.patch('/:id/restore', restoreSection);
router.delete('/:id/permanent', permanentDeleteSection);

export default router;
