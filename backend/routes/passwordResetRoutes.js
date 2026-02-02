import express from 'express';
import rateLimit from 'express-rate-limit';
import { forgotPassword, resetPassword, testEmail, verifyToken } from '../controllers/passwordResetController.js';

const router = express.Router();

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Too many password reset attempts. Please wait 15 minutes."
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts. Please wait 1 hour."
});

router.post('/forgot', resetLimiter, forgotPassword);
router.post('/reset', resetPasswordLimiter, resetPassword);
router.get('/test-email', testEmail);
router.get('/verify', verifyToken);

export default router;
