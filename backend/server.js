import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Initialize Sentry BEFORE anything else
import * as Sentry from '@sentry/node';
import { initSentry, isSentryReady, flushSentry } from './utils/sentry.js';

// Initialize Sentry
const sentryInitialized = initSentry();

// Import your route files here
import adminRoutes from './routes/adminRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import instructorAuthRoutes from './routes/InstructorAuth.js';
import roomRoutes from './routes/roomRoutes.js';
import yearLevelRoutes from './routes/yearLevelRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import alertsRoutes from './routes/alertsRoutes.js';
import instructorNotificationRoutes from './routes/instructorNotificationRoutes.js';
import scheduleTemplateRoutes from './routes/scheduleTemplateRoutes.js';
import passwordResetRoutes from './routes/passwordResetRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import adminMessageRoutes from './routes/adminMessageRoutes.js';
import mvccScheduleRoutes from './routes/mvccScheduleRoutes.js';
import mvccSectionRoutes from './routes/mvccSectionRoutes.js';
import mvccRoomRoutes from './routes/mvccRoomRoutes.js';
import mvccInstructorRoutes from './routes/mvccInstructorRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import { versionConflictHandler } from './middleware/mvccTransaction.js';
import { startWeatherScheduler } from './services/weatherScheduler.js';
import Instructor from './models/Instructor.js'; // Import the model for index management
import Admin from './models/Admin.js'; // Import Admin model for initialization
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { sanitizeInput } from './middleware/sanitizeInput.js';

dotenv.config();

const app = express();

// Middleware
// CORS Configuration - Security: Only allow configured origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : (process.env.NODE_ENV === 'production' 
          ? [] // Production: must specify CORS_ORIGIN
          : ['http://localhost:3000']); // Development default
    
    // Check if origin is in allowed list
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

app.use(cors(corsOptions));

// ============== RATE LIMITING ==============
// General API rate limiter - applies to all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and internal routes
    return req.path === '/health' || req.path.startsWith('/api/public');
  }
});

// Stricter rate limiter for write operations (create, update, delete)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // Stricter limits for write operations
  message: {
    success: false,
    message: 'Too many write requests, please try again later.',
    code: 'WRITE_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to write operations (POST, PUT, DELETE, PATCH)
    return !['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
  }
});

// File upload rate limiter (stricter due to resource usage)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'production' ? 10 : 50,
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general API rate limiting to all routes
app.use('/api/', apiLimiter);

// Apply stricter rate limiting to write operations
app.use('/api/schedule', writeLimiter);
app.use('/api/sections', writeLimiter);
app.use('/api/rooms', writeLimiter);
app.use('/api/instructors', writeLimiter);
app.use('/api/admin', writeLimiter);
app.use('/api/schedule-templates', writeLimiter);

// Apply upload rate limiting to file upload endpoints
app.use('/api/instructors/profile/image', uploadLimiter);

// Sentry request handler (must be before express.json)
// Only use if Sentry is properly initialized
if (isSentryReady()) {
  app.use(Sentry.Handlers.requestHandler());
}

app.use(express.json());

// Input sanitization middleware - protect against XSS and injection attacks
app.use(sanitizeInput);

// Populate req.userId (and req.user) from JWT for MVCC routes and audit
// This middleware is forgiving: if token is missing/invalid we just continue
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    if (!token || !process.env.JWT_SECRET) {
      return next();
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      // invalid token
      return next();
    }

    // If token already contains a user id, use it
    if (decoded?.id || decoded?.userId) {
      req.userId = decoded.id || decoded.userId;
      req.user = { id: req.userId, email: decoded.email };
      return next();
    }

    // Otherwise try to resolve user by email (token includes email from legacy login)
    if (decoded?.email) {
      const user = await Instructor.findOne({ email: { $regex: new RegExp(`^${decoded.email}$`, 'i') } }).select('_id email').lean();
      if (user) {
        req.userId = user._id.toString();
        req.user = { id: req.userId, email: user.email };
      }
    }
    next();
  } catch (err) {
    console.warn('Auth population middleware error:', err && err.message ? err.message : err);
    next();
  }
});

// ============== ENVIRONMENT VARIABLE VALIDATION ==============
// Critical variables that must be set
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Optional variables with defaults
const optionalEnvVars = {
  'CORS_ORIGIN': process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000',
  'PORT': '5000',
  'NODE_ENV': 'development'
};

Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
  if (!process.env[key]) {
    if (defaultValue) {
      console.warn(`⚠️ ${key} not set, using default: ${defaultValue}`);
      process.env[key] = defaultValue;
    } else {
      console.warn(`⚠️ ${key} not set (recommended for production)`);
    }
  }
});

// MongoDB connection URI
const mongoURI = process.env.MONGO_URI;

// Function to drop old email index and create new partial unique index
async function setupIndexes() {
  try {
    const collection = mongoose.connection.collection('instructors');

    // Get current indexes
    const indexes = await collection.indexes();
    const emailIndex = indexes.find(index => index.key.email);

    if (emailIndex) {
      console.log(`Dropping existing index: ${emailIndex.name}`);
      await collection.dropIndex(emailIndex.name);
      console.log('Old email index dropped successfully.');
    } else {
      console.log('No email index found to drop.');
    }

    // Create the indexes defined in Mongoose schema (includes partial unique index)
    await Instructor.createIndexes();
    console.log('New indexes created as per schema definitions.');
  } catch (err) {
    console.error('Error during index setup:', err);
  }
}

// Function to initialize default admin account
async function initializeAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      // If admin exists but doesn't have username, update it
      if (!existingAdmin.username) {
        existingAdmin.username = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing admin account with username: admin');
      } else {
        console.log('✅ Admin account already exists with username: admin');
      }
      return;
    }

    // Get default password from environment or use a default
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Create default admin account
    const admin = new Admin({
      username: 'admin',
      password: hashedPassword,
      email: ''
    });

    await admin.save();
    console.log('✅ Default admin account created successfully!');
    console.log('   Username: admin');
    console.log('   Password: ' + defaultPassword);
    console.log('   ⚠️  Please change the default password after first login!');
  } catch (err) {
    // If error is due to duplicate username, that's okay
    if (err.code === 11000) {
      console.log('✅ Admin account already exists.');
    } else {
      console.error('❌ Error initializing admin account:', err);
    }
  }
}

// Connect to MongoDB and then setup indexes and start server
mongoose
  .connect(mongoURI, {
    serverSelectionTimeoutMS: 60000, // Increase timeout to 60 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    connectTimeoutMS: 60000, // Increase connection timeout to 60 seconds
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 1, // Reduce min pool size to avoid connection issues
    retryWrites: true,
    w: 'majority',
    // Additional options for better connection handling
    tls: true, // Enable TLS for Atlas connections
    tlsAllowInvalidCertificates: false, // Ensure valid certificates
    tlsAllowInvalidHostnames: false, // Ensure valid hostnames
    // Retry connection on failure
    retryReads: true,
  })
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    await setupIndexes(); // Ensure indexes before server start
    await initializeAdmin(); // Initialize default admin account

    // After indexes setup, start your server...
    const server = http.createServer(app);
    const io = new SocketIOServer(server, {
      cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
    });

    app.use((req, res, next) => {
      req.io = io;
      next();
    });

    // Start weather scheduler for automatic weather checks
    startWeatherScheduler(io);

    // Route Mounting
    // ============== DEBUG ROUTES ==============
    // Temporary endpoints to test Sentry integration
    app.get('/api/debug/sentry/throw', (req, res) => {
      throw new Error('Sentry test error - thrown');
    });

    app.get('/api/debug/sentry/reject', (req, res) => {
      // Trigger an unhandled rejection
      Promise.reject(new Error('Sentry test rejection - unhandled')).catch(() => {});
      // Also create a rejection that is not caught to ensure process handler catches it
      setTimeout(() => { Promise.reject(new Error('Sentry delayed test rejection')); }, 0);
      res.json({ success: true, message: 'Triggered test rejections. Check Sentry.' });
    });

    // ============== MVCC ROUTES (Concurrency Control) - DEFAULT ==============
    // Mount MVCC-enabled routes as the primary endpoints so all write operations
    // use optimistic locking, conflict detection and transaction logging by default.
    app.use('/api/schedule', mvccScheduleRoutes);
    app.use('/api/sections', mvccSectionRoutes);
    app.use('/api/rooms', mvccRoomRoutes);
    app.use('/api/instructors', mvccInstructorRoutes);

    // ============== EXISTING (LEGACY) ROUTES ==============
    // Keep the original non-MVCC routes available under /api/legacy/* for
    // compatibility and gradual migration.
    app.use('/api/admin', adminRoutes);
    app.use('/api/admin', alertsRoutes);
    app.use('/api/instructor', instructorNotificationRoutes);
    app.use('/api/legacy/schedule', scheduleRoutes);
    app.use('/api/instructor', instructorAuthRoutes);
    app.use('/api/legacy/instructors', instructorRoutes);
    app.use('/api/legacy/rooms', roomRoutes);
    app.use('/api/year-levels', yearLevelRoutes);
    app.use('/api/registration', registrationRoutes);
    app.use('/api/legacy/sections', sectionRoutes);
    app.use('/api/schedule-templates', scheduleTemplateRoutes);
    app.use('/api/password-reset', passwordResetRoutes);
    app.use('/api/public', publicRoutes);
    app.use('/api/weather', weatherRoutes);
    app.use('/api/admin-message', adminMessageRoutes);
    app.use('/api/documents', documentRoutes);
    app.use("/uploads", express.static("uploads"));

    // ============== ERROR HANDLING ==============
    // MVCC version conflict handler (must come first)
    app.use(versionConflictHandler);
    
    // Sentry error handler (must be before other error handlers)
    // Only use if Sentry is properly initialized
    if (isSentryReady()) {
      app.use(Sentry.Handlers.errorHandler());
    }

    // Final Express error handler - capture to Sentry (if available) and respond
    app.use((err, req, res, next) => {
      try {
        console.error('Unhandled route error:', err && (err.stack || err.message || err));
        if (isSentryReady()) {
          Sentry.captureException(err);
        }
      } catch (e) {
        console.error('Error while reporting to Sentry:', e);
      }

      // If headers already sent, delegate to default handler
      if (res.headersSent) return next(err);
      res.status(err && err.status ? err.status : 500).json({ success: false, message: 'Internal server error' });
    });

    // Existing health check, error handlers, socket handlers, etc.

    io.on('connection', (socket) => {
      console.log('🔌 New client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
      });

      socket.on('subscribe-alerts', (userId) => {
        socket.join(`user-${userId}`);
        console.log(`📢 User ${userId} subscribed to alerts`);
      });
    });

    // Start server listening
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown handler remains unchanged
    process.on('SIGTERM', () => {
      console.log('⚠️ SIGTERM received: closing server');
      // Flush Sentry events then close
      (async () => {
        if (isSentryReady()) await flushSentry(2000);
        server.close(() => {
          console.log('✅ HTTP server closed');
          mongoose.connection.close(false, () => {
            console.log('✅ MongoDB connection closed');
            process.exit(0);
          });
        });
      })();
    });

    // Capture unhandled promise rejections and uncaught exceptions
    process.on('unhandledRejection', async (reason) => {
      console.error('Unhandled Rejection at:', reason);
      try {
        if (isSentryReady()) {
          Sentry.captureException(reason);
          await flushSentry(2000);
        }
      } catch (e) {
        console.error('Error flushing Sentry on unhandledRejection:', e);
      }
    });

    process.on('uncaughtException', async (err) => {
      console.error('Uncaught Exception:', err);
      try {
        if (isSentryReady()) {
          Sentry.captureException(err);
          await flushSentry(2000);
        }
      } catch (e) {
        console.error('Error flushing Sentry on uncaughtException:', e);
      } finally {
        // After flushing, exit to avoid undefined state
        process.exit(1);
      }
    });

  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err);
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Check if your IP address is whitelisted in MongoDB Atlas');
    console.error('   - Go to MongoDB Atlas → Network Access → Add IP Address');
    console.error('   - Add your current IP or use 0.0.0.0/0 (less secure, for testing)');
    console.error('2. Verify your MONGO_URI in .env file is correct');
    console.error('   - Format: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
    console.error('   - Make sure username and password are URL-encoded if they contain special characters');
    console.error('3. Check your internet connection');
    console.error('   - Try pinging: ping cluster0.xxxxx.mongodb.net');
    console.error('4. Ensure MongoDB Atlas cluster is running');
    console.error('   - Go to MongoDB Atlas → Clusters → Check if cluster is active (not paused)');
    console.error('5. Try connecting with MongoDB Compass to verify credentials');
    console.error('   - Use the same connection string from your .env file');
    console.error('6. Check firewall/antivirus settings');
    console.error('   - Some firewalls block MongoDB Atlas connections');
    console.error('7. Verify database user credentials');
    console.error('   - Go to MongoDB Atlas → Database Access → Verify username and password');
    console.error('\n🔍 Connection Details:');
    console.error(`   - URI Format: ${mongoURI ? (mongoURI.includes('@') ? 'mongodb+srv://user:***@cluster' : 'mongodb://...') : 'NOT SET'}`);
    console.error(`   - Connection Timeout: 60 seconds`);
    console.error(`   - Error Type: ${err.name || 'Unknown'}`);
    if (err.message) {
      console.error(`   - Error Message: ${err.message}`);
    }
    process.exit(1);
  });

// Other existing middleware and error handling code remains as you have it
