import express from 'express';
import rateLimit from "express-rate-limit";
import { sendRegistration } from '../controllers/registrationController.js';

const router = express.Router();

const registerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts. Please wait a bit."
});

router.post('/send-registration', registerLimiter, sendRegistration);

export default router;
