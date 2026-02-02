import nodemailer from 'nodemailer';

// Remove spaces from EMAIL_PASS (Gmail App Passwords are often displayed with spaces)
const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s/g, '') : '';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: emailPass, // your email password or app password (spaces removed)
  },
});

/**
 * Send an email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 */
export const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `Class Scheduling System <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * Generate email templates for different notification types
 */
export const emailTemplates = {
  scheduleChange: (name, details) => `
    <div>
      <h2>Schedule Change Notification</h2>
      <p>Dear ${name},</p>
      <p>The following schedule has been updated:</p>
      <p>${details}</p>
    </div>
  `,

  roomStatus: (name, room, status) => `
    <div>
      <h2>Room Status Update</h2>
      <p>Dear ${name},</p>
      <p>The status of room ${room} has been updated to: ${status}.</p>
    </div>
  `,

  weatherAlert: (name, alert) => `
    <div>
      <h2>Weather Alert</h2>
      <p>Dear ${name},</p>
      <p>${alert}</p>
    </div>
  `,

  adminMessage: (name, message) => `
    <div>
      <h2>Message from Admin</h2>
      <p>Dear ${name},</p>
      <p>${message}</p>
    </div>
  `,
};