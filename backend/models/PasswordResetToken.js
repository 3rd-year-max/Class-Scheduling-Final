import mongoose from 'mongoose';
import crypto from 'crypto';

const passwordResetTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 3600 // Auto-delete after 1 hour (3600 seconds)
  },
  used: {
    type: Boolean,
    default: false
  },
  userType: {
    type: String,
    enum: ['instructor', 'admin'],
    required: true,
    default: 'instructor'
  }
}, { timestamps: true });

// Create index for faster lookups
passwordResetTokenSchema.index({ email: 1, token: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PasswordResetToken', passwordResetTokenSchema);

