# Setup Guide for Team Members

This guide will help you set up the Class Scheduling System on your local machine.

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/KendrickAmparado/Class-Scheduling-Systems.git
cd Class-Scheduling-Systems

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../react-frontend
npm install
```

### 2. Environment Configuration

#### Backend (.env file)

Create a file named `.env` in the `backend/` directory with the following:

```env
# MongoDB Connection (Required)
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (Required - Generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Email Configuration (Optional - for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-specific-password

# Google reCAPTCHA (Optional)
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key

# Sentry (Optional - for error tracking)
SENTRY_DSN=your-sentry-dsn-here

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Weather API (Optional)
WEATHER_API_KEY=your-weather-api-key
```

#### Frontend (.env file)

Create a file named `.env` in the `react-frontend/` directory with the following:

```env
# API Base URL (Required)
# For local development:
REACT_APP_API_BASE=http://localhost:5000

# For production, use your backend server URL:
# REACT_APP_API_BASE=https://your-backend-server.com

# Google reCAPTCHA Site Key (Optional)
REACT_APP_RECAPTCHA_SITE_KEY=your-recaptcha-site-key

# Sentry (Optional)
REACT_APP_SENTRY_DSN=your-sentry-dsn-here
```

### 3. MongoDB Setup

#### Option A: MongoDB Atlas (Cloud - Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Create a database user (Database Access)
4. Whitelist your IP address (Network Access) - use `0.0.0.0/0` for development
5. Get your connection string and replace `<password>` and `<database>` in MONGO_URI

#### Option B: Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/class-scheduling`

### 4. Generate JWT Secret

Generate a strong random string for JWT_SECRET:

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 5. Run the Application

**Terminal 1 - Start Backend:**
```bash
cd backend
npm start
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server + Socket.IO running on port 5000
📍 Local: http://localhost:5000
```

**Terminal 2 - Start Frontend:**
```bash
cd react-frontend
npm start
```

The app will automatically open at `http://localhost:3000`

## Troubleshooting

### "MONGO_URI not specified"
- Make sure you created `.env` file in the `backend/` directory
- Check that the file is named exactly `.env` (not `.env.txt`)
- Verify MONGO_URI is set correctly

### "Cannot connect to MongoDB"
1. Check your MongoDB Atlas IP whitelist
2. Verify username and password in connection string
3. Ensure cluster is not paused
4. Check network/firewall settings

### "Port 5000 already in use"
- Change PORT in backend/.env to a different port (e.g., 5001)
- Update REACT_APP_API_BASE in frontend/.env to match

### CORS Errors
- Ensure CORS_ORIGIN in backend/.env matches your frontend URL
- For development, you can temporarily use `origin: '*'` (not for production)

### Socket.io Connection Failed
- Ensure backend is running before starting frontend
- Check REACT_APP_API_BASE matches your backend URL
- Verify firewall isn't blocking WebSocket connections

## Important Notes

- **Never commit `.env` files** - They contain sensitive information
- **Use different JWT_SECRET** for each environment (dev, staging, production)
- **Keep MongoDB credentials secure** - Don't share them publicly
- **For production**, use secure environment variables and HTTPS

## Need Help?

1. Check the main [README.md](./README.md) for more details
2. Review error messages in browser console and server logs
3. Ensure all environment variables are correctly set
4. Verify all dependencies are installed (`npm install`)

---

**Happy Coding! 🎉**

