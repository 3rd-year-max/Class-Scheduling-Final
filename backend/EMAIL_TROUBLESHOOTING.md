# Email Troubleshooting Guide

## Problem: Password Reset Emails Not Being Received

If the system says the email was sent but you're not receiving it, follow these steps:

### Step 1: Check Backend Console Logs

When you request a password reset, check your backend console for:
- ✅ `SMTP connection verified successfully` - Connection is working
- ✅ `Password reset email sent successfully` - Email was sent
- ❌ Any error messages - These will tell you what's wrong

### Step 2: Test Email Configuration

Visit this URL in your browser or use a tool like Postman:
```
GET http://localhost:5000/api/password-reset/test-email
```

Or test with a specific email:
```
GET http://localhost:5000/api/password-reset/test-email?email=your-email@example.com
```

This will tell you:
- If email service is configured
- If SMTP connection works
- If emails can be sent

### Step 3: Check Your .env File

Make sure these are set in your `backend/.env` file:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password-here
```

**Important for Gmail:**
- You CANNOT use your regular Gmail password
- You MUST use an App Password
- See "Gmail App Password Setup" below

### Step 4: Common Issues and Solutions

#### Issue 1: "EAUTH" or "535" Error
**Problem:** Authentication failed

**Solution:**
1. For Gmail, you need an App Password:
   - Go to Google Account → Security
   - Enable 2-Step Verification
   - Go to App Passwords
   - Generate a new app password for "Mail"
   - Use this 16-character password in EMAIL_PASS

2. Make sure EMAIL_USER is your full email address
3. Make sure EMAIL_PASS has no spaces or extra characters

#### Issue 2: "ECONNECTION" Error
**Problem:** Cannot connect to email server

**Solution:**
1. Check your internet connection
2. Check firewall settings (port 587 should be open)
3. If using VPN, try disconnecting
4. Try using port 465 with secure: true (see below)

#### Issue 3: Email Goes to Spam
**Problem:** Email is sent but goes to spam folder

**Solution:**
1. Check your spam/junk folder
2. Add the sender email to your contacts
3. Mark as "Not Spam" if found in spam
4. Check email filters

#### Issue 4: No Error, But No Email
**Problem:** System says email sent, but nothing received

**Solution:**
1. Check spam folder
2. Verify the email address is correct
3. Check if email provider is blocking the email
4. Try a different email address
5. Check backend logs for actual send confirmation

### Step 5: Alternative Email Configuration

If Gmail doesn't work, you can use other email providers:

#### For Outlook/Hotmail:
```javascript
host: 'smtp-mail.outlook.com',
port: 587,
secure: false
```

#### For Yahoo:
```javascript
host: 'smtp.mail.yahoo.com',
port: 587,
secure: false
```

#### For Gmail with SSL:
```javascript
host: 'smtp.gmail.com',
port: 465,
secure: true  // Change this to true
```

### Gmail App Password Setup (Step-by-Step)

1. **Go to Google Account**
   - Visit: https://myaccount.google.com/
   - Click on "Security" in the left sidebar

2. **Enable 2-Step Verification**
   - Under "Signing in to Google", click "2-Step Verification"
   - Follow the steps to enable it (if not already enabled)

3. **Create App Password**
   - Go back to Security page
   - Under "Signing in to Google", click "App passwords"
   - Select "Mail" as the app
   - Select "Other (Custom name)" as device
   - Enter "Class Scheduling System" as the name
   - Click "Generate"

4. **Copy the 16-character password**
   - You'll see a 16-character password (no spaces)
   - Copy this entire password
   - Paste it into your `.env` file as `EMAIL_PASS`

5. **Update .env file**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=abcd efgh ijkl mnop  # Remove spaces: abcdefghijklmnop
   ```

6. **Restart your server**
   - Stop the server (Ctrl+C)
   - Start it again (npm start or nodemon server.js)

### Testing Email Configuration

After setting up, test it:

1. **Test SMTP Connection:**
   ```bash
   curl http://localhost:5000/api/password-reset/test-email
   ```

2. **Send Test Email:**
   ```bash
   curl "http://localhost:5000/api/password-reset/test-email?email=your-email@example.com"
   ```

3. **Check Console Logs:**
   - Look for ✅ success messages
   - Check for ❌ error messages

### Debug Mode

To see more detailed error information, check your backend console. The system logs:
- SMTP connection status
- Email sending status
- Error codes and messages
- Message IDs (if email was sent)

### Still Not Working?

1. **Check Backend Logs:** Look for error messages in your terminal/console
2. **Verify .env File:** Make sure variables are set correctly (no quotes, no spaces)
3. **Test with Different Email:** Try sending to a different email address
4. **Check Email Provider:** Some email providers block automated emails
5. **Try Different Port:** Try port 465 with secure: true for Gmail

### Quick Checklist

- [ ] EMAIL_USER is set in .env file
- [ ] EMAIL_PASS is set in .env file (App Password for Gmail)
- [ ] 2-Step Verification enabled (for Gmail)
- [ ] App Password generated (for Gmail)
- [ ] Server restarted after changing .env
- [ ] Test endpoint shows success
- [ ] Checked spam folder
- [ ] Verified email address is correct
- [ ] Checked backend console for errors

