import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import validator from 'validator';
import axios from 'axios';
import PasswordResetToken from '../models/PasswordResetToken.js';
import Instructor from '../models/Instructor.js';

/** POST /api/password-reset/forgot - Request password reset */
export const forgotPassword = async (req, res) => {
  try {
    const { email, userType, recaptchaToken } = req.body;

    if (!email || !userType) {
      return res.status(400).json({ success: false, message: 'Email and user type are required.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (userType !== 'instructor' && userType !== 'admin') {
      return res.status(400).json({ success: false, message: 'Invalid user type. Password reset is only available for instructors and admins.' });
    }

    if (recaptchaToken) {
      try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey || secretKey === 'YOUR_SECRET_KEY_HERE') {
          if (process.env.NODE_ENV === 'production') {
            return res.status(500).json({ success: false, message: 'reCAPTCHA is not properly configured. Please contact the system administrator.' });
          }
          console.log('⚠️ Skipping reCAPTCHA verification in development mode');
        } else {
          const verify = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: { secret: secretKey, response: recaptchaToken }
          });
          if (!verify.data.success) {
            const errorCodes = verify.data['error-codes'] || [];
            let errorMessage = 'reCAPTCHA verification failed.';
            if (errorCodes.includes('missing-input-secret') || errorCodes.includes('invalid-input-secret')) {
              errorMessage = 'reCAPTCHA configuration error. Please contact the system administrator.';
            } else if (errorCodes.includes('missing-input-response') || errorCodes.includes('invalid-input-response')) {
              errorMessage = 'reCAPTCHA token is invalid. Please try again.';
            } else if (errorCodes.includes('timeout-or-duplicate')) {
              errorMessage = 'reCAPTCHA token has expired. Please try again.';
            }
            return res.status(400).json({ success: false, message: errorMessage });
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development' && !process.env.RECAPTCHA_SECRET_KEY) {
          console.warn('⚠️ Allowing request to proceed in development mode without reCAPTCHA');
        } else {
          return res.status(500).json({ success: false, message: 'Error during reCAPTCHA verification. Please try again.' });
        }
      }
    } else if (process.env.RECAPTCHA_SECRET_KEY && process.env.RECAPTCHA_SECRET_KEY !== 'YOUR_SECRET_KEY_HERE') {
      return res.status(400).json({ success: false, message: 'Please complete the reCAPTCHA verification.' });
    }

    if (userType === 'admin') {
      const Admin = (await import('../models/Admin.js')).default;
      const admin = await Admin.findOne();
      if (!admin) {
        return res.json({ success: true, message: 'If the email exists, a password reset link has been sent.' });
      }
      admin.email = email.toLowerCase().trim();
      await admin.save();
    } else {
      const instructor = await Instructor.findOne({ email: email.toLowerCase().trim() });
      if (!instructor) {
        return res.json({ success: true, message: 'If the email exists, a password reset link has been sent.' });
      }
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await PasswordResetToken.create({
      email: email.toLowerCase().trim(),
      token: resetToken,
      expiresAt,
      userType
    });

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ success: false, message: 'Email service is not configured. Please contact the system administrator.' });
    }

    const emailPass = process.env.EMAIL_PASS.replace(/\s/g, '');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: emailPass }
    });

    try {
      await transporter.verify();
    } catch (verifyError) {
      return res.status(500).json({ success: false, message: 'Email service configuration error. Please contact the system administrator.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/password-reset?token=${resetToken}&email=${encodeURIComponent(email)}&type=${userType}`;
    const mailOptions = {
      from: `"Class Scheduling System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f2c63;">Password Reset Request</h2>
          <p>You have requested to reset your password for the Class Scheduling System.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: linear-gradient(135deg, #0f2c63 0%, #f97316 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; 
                      border-radius: 8px; display: inline-block; font-weight: 600;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link: <a href="${resetLink}" style="color: #0f2c63; word-break: break-all;">${resetLink}</a>
          </p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'If the email exists, a password reset link has been sent.' });
    } catch (sendError) {
      let errorMessage = 'Failed to send reset email. Please try again.';
      if (sendError.code === 'EAUTH') errorMessage = 'Email authentication failed. For Gmail, use an App Password.';
      else if (sendError.code === 'ECONNECTION') errorMessage = 'Could not connect to email server.';
      else if (sendError.responseCode === 535) errorMessage = 'Email authentication failed. For Gmail, use an App Password.';
      return res.status(500).json({
        success: false,
        message: errorMessage,
        debug: process.env.NODE_ENV === 'development' ? { code: sendError.code, responseCode: sendError.responseCode } : undefined
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ success: false, message: 'Error processing password reset request. Please try again later.' });
  }
};

/** POST /api/password-reset/reset - Reset password with token */
export const resetPassword = async (req, res) => {
  try {
    const { token, email, userType, newPassword } = req.body;

    if (!token || !email || !userType || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const resetTokenDoc = await PasswordResetToken.findOne({
      token,
      email: email.toLowerCase().trim(),
      userType,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetTokenDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (userType === 'admin') {
      const Admin = (await import('../models/Admin.js')).default;
      const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
      if (!admin) {
        const anyAdmin = await Admin.findOne();
        if (!anyAdmin) return res.status(404).json({ success: false, message: 'Admin not found.' });
        anyAdmin.email = email.toLowerCase().trim();
        anyAdmin.password = hashedPassword;
        await anyAdmin.save();
      } else {
        admin.password = hashedPassword;
        await admin.save();
      }
    } else {
      const instructor = await Instructor.findOne({ email: email.toLowerCase().trim() });
      if (!instructor) return res.status(404).json({ success: false, message: 'Instructor not found.' });
      instructor.password = hashedPassword;
      await instructor.save();
    }

    resetTokenDoc.used = true;
    await resetTokenDoc.save();

    res.json({ success: true, message: 'Password has been reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
};

/** GET /api/password-reset/test-email - Test email configuration */
export const testEmail = async (req, res) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        configured: false,
        message: 'Email service not configured',
        details: { EMAIL_USER: !!process.env.EMAIL_USER, EMAIL_PASS: !!process.env.EMAIL_PASS }
      });
    }

    const emailPass = process.env.EMAIL_PASS.replace(/\s/g, '');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: emailPass }
    });

    await transporter.verify();
    const testEmailAddr = req.query.email;
    if (testEmailAddr && testEmailAddr !== process.env.EMAIL_USER) {
      const info = await transporter.sendMail({
        from: `"Class Scheduling System" <${process.env.EMAIL_USER}>`,
        to: testEmailAddr,
        subject: 'Test Email - Class Scheduling System',
        html: `<div><h2>Test Email</h2><p>Email configuration is working!</p><p>Sent at: ${new Date().toLocaleString()}</p></div>`
      });
      return res.json({ success: true, configured: true, message: 'Test email sent', email: process.env.EMAIL_USER, messageId: info.messageId });
    }
    return res.json({ success: true, configured: true, message: 'Email service configured and connection verified', email: process.env.EMAIL_USER, note: 'Add ?email=your@email.com to send a test email' });
  } catch (verifyError) {
    return res.status(500).json({
      success: false,
      configured: !!process.env.EMAIL_USER,
      message: 'Email configuration failed',
      error: verifyError.message,
      troubleshooting: { gmail: 'Use App Password for Gmail', credentials: 'Check EMAIL_USER and EMAIL_PASS' }
    });
  }
};

/** GET /api/password-reset/verify - Verify reset token validity */
export const verifyToken = async (req, res) => {
  try {
    const { token, email, userType } = req.query;
    if (!token || !email || !userType) {
      return res.status(400).json({ success: false, valid: false, message: 'Token, email, and user type are required.' });
    }

    const resetTokenDoc = await PasswordResetToken.findOne({
      token,
      email: email.toLowerCase().trim(),
      userType,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    res.json({
      success: true,
      valid: !!resetTokenDoc,
      message: resetTokenDoc ? 'Token is valid.' : 'Invalid or expired reset token.'
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ success: false, valid: false, message: 'Error verifying token.' });
  }
};
