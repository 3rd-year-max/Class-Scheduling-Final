import nodemailer from 'nodemailer';
import Instructor from '../models/Instructor.js';
import Schedule from '../models/Schedule.js';
import validator from 'validator';
import axios from 'axios';

/**
 * Send registration invitation emails to instructors
 * POST /api/registration/send-registration
 */
export const sendRegistration = async (req, res) => {
  let { email, department, recaptchaToken } = req.body;

  let emails = Array.isArray(email) ? email : [email];
  emails = emails.map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''));
  department = typeof department === 'string' ? department.trim() : '';

  if (!department || validator.isEmpty(department)) {
    return res.status(400).json({ error: 'Department is required' });
  }
  for (let e of emails) {
    if (!e || !validator.isEmail(e)) {
      return res.status(400).json({ error: `Invalid email: ${e}` });
    }
  }

  if (recaptchaToken) {
    try {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY || 'YOUR_SECRET_KEY_HERE';
      const verify = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
        params: { secret: secretKey, response: recaptchaToken },
      });
      if (!verify.data.success) {
        return res.status(400).json({ error: 'reCAPTCHA verification failed.' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Error during reCAPTCHA check.' });
    }
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ error: 'Email service not configured. Please contact administrator.' });
  }

  const emailPass = process.env.EMAIL_PASS.replace(/\s/g, '');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: emailPass },
  });

  try {
    await transporter.verify();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify email connection' });
  }

  let results = [];
  for (let emailAddr of emails) {
    try {
      let existingInstructor = await Instructor.findOne({
        email: emailAddr,
        status: { $ne: 'archived' }
      });

      if (existingInstructor && existingInstructor.status === 'active') {
        results.push({ email: emailAddr, status: 'failed', error: 'Already registered and active.' });
        continue;
      }

      const archivedInstructor = await Instructor.findOne({ email: emailAddr, status: 'archived' });
      if (archivedInstructor) {
        await Instructor.findByIdAndDelete(archivedInstructor._id);
        console.log(`Deleted archived instructor with email ${emailAddr} to allow new registration`);
      }

      if (!existingInstructor) {
        const newInstructor = new Instructor({ email: emailAddr, department, status: 'pending' });
        await newInstructor.save();
      } else {
        existingInstructor.department = department;
        existingInstructor.status = 'pending';
        await existingInstructor.save();
      }

      const registrationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/instructor/signup?email=${encodeURIComponent(emailAddr)}&department=${encodeURIComponent(department)}`;
      const mailOptions = {
        from: `"Class Scheduling System" <${process.env.EMAIL_USER}>`,
        to: emailAddr,
        subject: 'Complete Your Instructor Registration',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f2c63;">Complete Your Instructor Registration</h2>
          <p>You have been invited to join the Class Scheduling System as an instructor.</p>
          <p>Click the button below to complete your registration:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${registrationLink}" 
               style="background: linear-gradient(135deg, #0f2c63 0%, #f97316 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block;
                      font-weight: 600;">
              Complete Registration
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <a href="${registrationLink}" style="color: #0f2c63; word-break: break-all;">${registrationLink}</a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Please complete your registration to access the system. If you didn't expect this invitation, please ignore this email.
          </p>
        </div>
      `
      };
      await transporter.sendMail(mailOptions);

      let hasSchedule = false;
      try {
        const scheduleCount = await Schedule.countDocuments({ instructorEmail: emailAddr });
        if (scheduleCount > 0) {
          hasSchedule = true;
        } else if (existingInstructor?.firstname && existingInstructor?.lastname) {
          const instructorName = `${existingInstructor.firstname} ${existingInstructor.lastname}`;
          const scheduleCountByName = await Schedule.countDocuments({ instructor: instructorName });
          if (scheduleCountByName > 0) hasSchedule = true;
        }
      } catch (err) { /* ignore */ }
      results.push({ email: emailAddr, status: 'success', hasSchedule });
    } catch (err) {
      results.push({ email: emailAddr, status: 'failed', error: err.message });
    }
  }
  res.json({ results, total: results.length });
};
