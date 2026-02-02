import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

console.log('🔍 Checking Email Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('  EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '❌ Missing');

if (process.env.EMAIL_PASS) {
  if (process.env.EMAIL_PASS.includes(' ')) {
    console.log('  ⚠️  WARNING: EMAIL_PASS contains spaces! Gmail App Passwords should NOT have spaces.');
    console.log('     Current:', process.env.EMAIL_PASS);
    console.log('     Should be:', process.env.EMAIL_PASS.replace(/\s/g, ''));
  }
  if (process.env.EMAIL_PASS.length !== 16) {
    console.log('  ⚠️  WARNING: EMAIL_PASS length is ' + process.env.EMAIL_PASS.length + ', expected 16 for Gmail App Password');
  }
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('\n❌ Email configuration is incomplete. Please set EMAIL_USER and EMAIL_PASS in .env file.');
  process.exit(1);
}

// Test SMTP connection
console.log('\n🔌 Testing SMTP Connection...');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS.replace(/\s/g, ''), // Remove spaces if any
  }
});

transporter.verify()
  .then(() => {
    console.log('✅ SMTP connection verified successfully!\n');
    
    // Get test email from command line argument
    const testEmail = process.argv[2];
    
    if (testEmail) {
      console.log('📧 Sending test email to:', testEmail);
      const mailOptions = {
        from: `"Class Scheduling System" <${process.env.EMAIL_USER}>`,
        to: testEmail,
        subject: 'Test Email - Class Scheduling System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f2c63;">Test Email</h2>
            <p>This is a test email from the Class Scheduling System.</p>
            <p>If you received this email, your email configuration is working correctly!</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `
      };
      
      return transporter.sendMail(mailOptions);
    } else {
      console.log('💡 To send a test email, run:');
      console.log('   node check-email-config.js your-email@example.com');
      return Promise.resolve();
    }
  })
  .then((info) => {
    if (info && info.messageId) {
      console.log('✅ Test email sent successfully!');
      console.log('   Message ID:', info.messageId);
      console.log('   Response:', info.response || 'N/A');
      console.log('\n📬 Please check your email (and spam folder) for the test message.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error('   Code:', error.code);
    console.error('   Response Code:', error.responseCode);
    console.error('   Command:', error.command);
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Make sure you are using a Gmail App Password, not your regular password');
      console.error('   2. Remove any spaces from the App Password in your .env file');
      console.error('   3. Make sure 2-Step Verification is enabled on your Google account');
      console.error('   4. Generate a new App Password if needed');
    } else if (error.code === 'ECONNECTION') {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check your internet connection');
      console.error('   2. Check if port 587 is blocked by firewall');
      console.error('   3. Try disabling VPN if you are using one');
    }
    
    process.exit(1);
  });

