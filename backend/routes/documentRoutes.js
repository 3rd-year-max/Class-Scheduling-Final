import express from 'express';
import { testDocumentRoutes, generateDocumentId } from '../controllers/documentController.js';

const router = express.Router();

router.get('/test', testDocumentRoutes);
router.post('/generate-id', generateDocumentId);

export default router;
