# Class Scheduling System - Overview

## 🏗️ System Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Frontend**: React.js
- **Real-time Communication**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Error Monitoring**: Sentry

---

## 🔄 How The System Works

### 1. **User Roles & Access**

#### **Admin**
- Full system access
- Manages instructors, schedules, sections, rooms
- Views reports and statistics
- Sends messages to instructors
- Manages system-wide alerts

#### **Instructor**
- Views personal schedule
- Receives notifications
- Views workload reports
- Manages profile settings
- Receives weather alerts

### 2. **Core Workflow**

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM WORKFLOW                          │
└─────────────────────────────────────────────────────────────┘

1. ADMIN CREATES RESOURCES
   ├── Creates Sections (Course + Year + Section Name)
   ├── Creates Rooms (Room Name + Area + Status)
   └── Manages Instructors (Registration, Activation)

2. ADMIN CREATES SCHEDULES
   ├── Selects Course, Year, Section
   ├── Assigns Subject, Instructor, Day, Time, Room
   ├── System checks for conflicts:
   │   ├── Room availability (same room, day, time)
   │   └── Instructor availability (same instructor, day, time)
   └── Schedule saved to database

3. REAL-TIME UPDATES (Socket.IO)
   ├── When schedule is created/updated/deleted
   ├── System broadcasts to:
   │   ├── All connected admins
   │   └── Affected instructor (if connected)
   └── Frontend updates automatically (no refresh needed)

4. GOOGLE CALENDAR SYNC
   ├── When instructor logs in → System syncs all schedules
   ├── Creates/updates Google Calendar events
   ├── Events recur weekly for entire academic year
   └── Instructor can view in Google Calendar

5. NOTIFICATIONS
   ├── Schedule changes → Instructor notified
   ├── Room status changes → Instructors notified
   ├── Weather alerts → All instructors notified
   └── Admin messages → Specific instructor notified

6. REPORTS & EXPORTS
   ├── Admin can export schedules (PDF/Excel)
   ├── Instructors can export personal schedules
   └── Statistics and analytics available
```

### 3. **Key Features**

#### **Optimistic Concurrency Control (MVCC)**
- Prevents data conflicts when multiple users edit simultaneously
- Uses version keys (`__v`) to detect conflicts
- Automatically handles concurrent updates

#### **Real-Time Updates**
- Socket.IO broadcasts changes instantly
- No page refresh needed
- Live notifications for schedule changes

#### **Conflict Detection**
- **Room Conflicts**: Same room, same day, same time
- **Instructor Conflicts**: Same instructor, same day, same time
- System prevents double-booking

#### **Soft Delete (Archive)**
- Schedules, sections, and rooms use `archived` flag
- Data retained for history/reports
- Can be restored if needed

#### **Google Calendar Integration**
- Automatic sync on instructor login
- Recurring events for weekly schedules
- Full academic year coverage (June to May)
- Timezone: Asia/Manila

#### **Weather Alerts**
- Automatic weather monitoring
- Alerts for severe weather conditions
- Helps instructors prepare for class disruptions

---

## 🌐 External APIs & Services Used

### 1. **Socket.IO (Real-Time Communication)**
**Purpose**: Real-time bidirectional communication between server and clients

**How it works**:
- WebSocket-based real-time messaging
- Server broadcasts events to connected clients instantly
- No polling needed - updates push automatically
- Supports room/channel-based messaging

**Configuration**:
```javascript
// Server-side (backend/server.js)
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Attach to Express requests
app.use((req, res, next) => {
  req.io = io;
  next();
});
```

**Client-side Connection** (React):
```javascript
import { io } from 'socket.io-client';
const socket = io(API_BASE_URL, { autoConnect: true });
```

**Events Emitted by Server**:
- `schedule-created` - New schedule added (broadcast to all)
- `schedule-updated` - Schedule modified (broadcast to all)
- `schedule-deleted` - Schedule removed (broadcast to all)
- `schedule-update-{email}` - Specific instructor update (targeted)
- `notification-{email}` - New notification for specific instructor
- `notifications` - Global notification channel
- `instructor-registered` - New instructor registered (admin notification)
- `room-status-changed` - Room status updated
- `weather-alert` - Weather alert broadcast
- `alert` - System-wide alert

**Events Received by Server**:
- `connect` - Client connected
- `disconnect` - Client disconnected
- `join-instructor-channel` - Instructor joins their notification channel

**Usage Examples**:
```javascript
// Server: Broadcast schedule creation
req.io.emit('schedule-created', {
  schedule: newSchedule,
  timestamp: new Date()
});

// Server: Notify specific instructor
req.io.emit(`schedule-update-${instructorEmail}`, {
  action: 'schedule-updated',
  schedule: updatedSchedule
});

// Client: Listen for updates
socket.on('schedule-created', (data) => {
  // Update UI with new schedule
});

socket.on(`notification-${userEmail}`, (data) => {
  // Show notification to user
});
```

**Key Features**:
- Automatic reconnection on disconnect
- Room/channel support for targeted messaging
- Low latency (WebSocket protocol)
- Fallback to HTTP long-polling if WebSocket unavailable
- CORS enabled for cross-origin connections

**API Documentation**: https://socket.io/docs/

---

### 2. **Sentry (Error Tracking & Monitoring)**
**Purpose**: Error tracking, performance monitoring, and application health monitoring

**How it works**:
- Captures exceptions and errors automatically
- Tracks performance metrics
- Provides error context and stack traces
- Sends alerts for critical errors
- Optional: User profiling for performance analysis

**Configuration Required**:
```env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% of profiles (optional)
NODE_ENV=production
```

**Initialization** (backend/utils/sentry.js):
```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // Performance monitoring
  beforeSend(event, hint) {
    // Filter sensitive data (passwords, tokens, etc.)
    return event;
  },
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
    // ... other known non-critical errors
  ]
});
```

**Key Functions**:
- `captureException(error, context)` - Capture errors with context
- `captureMessage(message, level, context)` - Log messages
- `setUser(user)` - Associate errors with user
- `flushSentry(timeout)` - Flush pending events (on shutdown)

**Error Handling Integration**:
```javascript
// Automatic error capture
try {
  // risky operation
} catch (error) {
  captureException(error, { 
    context: 'schedule-creation',
    scheduleId: schedule._id 
  });
  throw error;
}

// Manual message capture
captureMessage('Weather check completed', 'info', {
  city: 'Malaybalay',
  temperature: 25
});
```

**Security Features**:
- Automatically filters sensitive data:
  - Authorization headers
  - Cookies
  - Password/token query parameters
- User context tracking (for debugging)
- Environment-based filtering

**Process-Level Error Handling**:
```javascript
// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  Sentry.captureException(err);
  flushSentry(2000);
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  Sentry.captureException(err);
  flushSentry(2000);
  process.exit(1);
});
```

**Debug Endpoints** (Development):
- `GET /api/debug/sentry/throw` - Test error capture
- `GET /api/debug/sentry/reject` - Test promise rejection capture

**What Sentry Tracks**:
- Exceptions and stack traces
- Performance metrics (transaction timing)
- User actions leading to errors
- Environment information
- Request/response data (sanitized)
- Custom context and tags

**API Endpoint**: `https://sentry.io/api/` (managed service)

**Dashboard**: Access via Sentry web interface at https://sentry.io

**Pricing**: Free tier available, paid plans for advanced features

---

### 3. **Google Calendar API**
**Purpose**: Sync class schedules to instructors' Google Calendars

**How it works**:
- Uses **Service Account** authentication (OAuth 2.0)
- Creates calendar events for each schedule
- Events recur weekly using RRULE (iCal recurrence rules)
- Events span entire academic year (June 1 - May 31)
- Updates/deletes events when schedules change

**Configuration Required**:
```env
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_CALENDAR_ID=primary (or custom calendar ID)
```

**Key Functions**:
- `createCalendarEvent()` - Creates new calendar event
- `updateCalendarEvent()` - Updates existing event
- `deleteCalendarEvent()` - Removes event from calendar
- `listCalendarEvents()` - Lists instructor's events
- `isGoogleCalendarConfigured()` - Checks if API is set up

**API Endpoint**: `https://www.googleapis.com/calendar/v3`

---

### 4. **OpenWeatherMap API**
**Purpose**: Provides weather data and alerts for class scheduling

**How it works**:
- Fetches current weather conditions
- Monitors for severe weather (heavy rain, storms, etc.)
- Sends alerts to instructors via notifications
- Runs on a scheduler (automatic checks)

**Configuration Required**:
```env
OPENWEATHER_API_KEY=your-api-key
WEATHER_CITY=Manila (default)
WEATHER_COUNTRY_CODE=PH (default)
```

**Key Functions**:
- `getCurrentWeather(city, countryCode)` - Gets current weather
- `getWeatherForecast(city, countryCode)` - Gets 5-day forecast
- `checkWeatherAlerts()` - Checks for severe weather conditions
- `isWeatherConfigured()` - Checks if API key is set

**API Endpoint**: `https://api.openweathermap.org/data/2.5`

**Weather Scheduler**:
- Runs automatically in background
- Checks weather at configured intervals
- Sends alerts via Socket.IO when severe weather detected

---

### 5. **World Time API**
**Purpose**: Provides accurate time data for timezone handling

**How it works**:
- Fetches current time for specific timezone
- Used for accurate time calculations
- Helps with Google Calendar timezone handling

**Configuration**: None required (public API)

**Key Functions**:
- `getCurrentTime(timezone)` - Gets current time for timezone
- Default timezone: `Etc/UTC`
- Can specify: `Asia/Manila`, `America/New_York`, etc.

**API Endpoint**: `http://worldtimeapi.org/api/timezone/{timezone}`

**Public Endpoint**: `/api/public/time?timezone=Asia/Manila`

---

## 📡 System API Structure

### **Public API Routes** (`/api/public/*`)
**Purpose**: Read-only access for students, parents, external systems

**Endpoints**:
- `GET /api/public/health` - Health check
- `GET /api/public/courses` - List all courses
- `GET /api/public/year-levels` - List year levels
- `GET /api/public/sections?course=X&year=Y` - Get sections
- `GET /api/public/rooms` - List all rooms
- `GET /api/public/schedules` - Get schedules (with filters)
- `GET /api/public/schedules/by-section/:course/:year/:section` - Section schedules
- `GET /api/public/schedules/by-room/:room` - Room schedules
- `GET /api/public/schedules/by-day/:day` - Day schedules
- `GET /api/public/instructors` - List instructors (public info only)
- `GET /api/public/instructors/:instructorId` - Instructor details
- `GET /api/public/statistics` - System statistics
- `GET /api/public/time?timezone=X` - Current time

**Security**: No authentication required, but rate-limited

---

### **Protected API Routes** (`/api/*`)
**Purpose**: Full CRUD operations for authenticated users

**Authentication**: JWT tokens in `Authorization: Bearer <token>` header

**Main Routes**:
- `/api/admin/*` - Admin operations
- `/api/instructor/*` - Instructor operations
- `/api/schedule/*` - Schedule management (legacy)
- `/api/mvcc/schedule/*` - Schedule management (with MVCC)
- `/api/mvcc/section/*` - Section management (with MVCC)
- `/api/mvcc/room/*` - Room management (with MVCC)
- `/api/mvcc/instructor/*` - Instructor management (with MVCC)
- `/api/room/*` - Room operations
- `/api/section/*` - Section operations
- `/api/weather/*` - Weather data
- `/api/alerts/*` - System alerts
- `/api/notifications/*` - Instructor notifications
- `/api/messages/*` - Admin messages

---

## 🔐 Security Features

### **Rate Limiting**
- **General API**: 100 requests/15 minutes (production)
- **Write Operations**: 20 requests/15 minutes (production)
- **Public Routes**: Excluded from rate limiting

### **CORS Protection**
- Only configured origins allowed
- Credentials enabled for authenticated requests
- Production requires explicit `CORS_ORIGIN` setting

### **Input Sanitization**
- All user inputs sanitized
- Prevents XSS and injection attacks
- MongoDB ObjectId validation

### **Authentication**
- JWT tokens for session management
- Password hashing (bcrypt)
- Token expiration
- Password reset tokens (TTL: 1 hour)

---

## 📊 Data Flow Example

### **Creating a Schedule**

```
1. Admin fills form → Frontend (React)
   ↓
2. POST /api/mvcc/schedule → Backend (Express)
   ↓
3. Validation & Conflict Check → Database (MongoDB)
   ├── Check room availability
   ├── Check instructor availability
   └── Validate data
   ↓
4. Save Schedule → Database
   ↓
5. Broadcast Update → Socket.IO
   ├── Notify all admins
   └── Notify affected instructor
   ↓
6. Sync to Google Calendar → Google Calendar API
   ├── Create event
   └── Set recurrence (weekly)
   ↓
7. Send Notification → Database + Socket.IO
   └── Instructor receives notification
   ↓
8. Frontend Updates → Real-time (no refresh)
```

---

## 🔄 Real-Time Communication (Socket.IO)

**Note**: See "External APIs & Services Used" section above for detailed Socket.IO documentation.

### **Quick Reference - Events**:

**Events Emitted by Server**:
- `schedule-created` - New schedule added
- `schedule-updated` - Schedule modified
- `schedule-deleted` - Schedule removed
- `schedule-update-{email}` - Specific instructor update
- `notification-{email}` - New notification for instructor
- `notifications` - Global notification channel
- `alert` - System-wide alert
- `weather-alert` - Weather-related alert
- `instructor-registered` - New instructor registered
- `room-status-changed` - Room status updated

**Events Received by Server**:
- `connect` - Client connected
- `disconnect` - Client disconnected
- `join-instructor-channel` - Instructor joins notification channel

---

## 📝 Key Database Patterns

### **1. Soft Delete (Archive)**
```javascript
{ archived: false } // Active
{ archived: true }   // Archived (hidden but retained)
```

### **2. Optimistic Concurrency**
```javascript
{ __v: 0 }  // Version 0
{ __v: 1 }  // Version 1 (after update)
```

### **3. Timestamps**
```javascript
{ createdAt: Date, updatedAt: Date } // Auto-managed by Mongoose
```

### **4. String-Based Relationships**
- Most relationships use string matching (not ObjectId)
- Example: `Schedule.instructor` matches `Instructor` by name/email
- Provides flexibility but requires careful data consistency

---

## 🚀 Deployment Considerations

### **Environment Variables Required**:
```env
# Database
MONGO_URI=mongodb+srv://...

# Server
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Google Calendar
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
GOOGLE_PROJECT_ID=...
GOOGLE_CALENDAR_ID=primary

# Weather
OPENWEATHER_API_KEY=...
WEATHER_CITY=Malaybalay
WEATHER_COUNTRY_CODE=PH

# Error Tracking (Sentry)
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Security
JWT_SECRET=...
```

### **External Dependencies**:
- MongoDB Atlas (or self-hosted MongoDB)
- Google Cloud Platform (for Calendar API)
- OpenWeatherMap account (free tier available)
- World Time API (no account needed)
- Sentry account (free tier available, optional)
- Socket.IO (included in npm packages, no external service needed)

---

## 📈 System Scalability

### **Current Design**:
- Stateless API (JWT tokens)
- MongoDB indexes for performance
- Socket.IO for real-time (scales with Redis adapter)
- Rate limiting prevents abuse

### **Future Enhancements**:
- Redis for session management
- Caching layer for frequently accessed data
- Load balancing for multiple server instances
- CDN for static assets

---

## 🎯 Summary

**The Class Scheduling System** is a full-stack web application that:
1. Manages class schedules, instructors, sections, and rooms
2. Prevents scheduling conflicts automatically
3. Syncs schedules to Google Calendar
4. Provides real-time updates via WebSockets
5. Sends weather alerts and notifications
6. Offers public API for external access
7. Uses optimistic concurrency to handle simultaneous edits
8. Maintains data integrity with soft deletes and versioning

**External APIs & Services Used**:
- **Socket.IO**: Real-time bidirectional communication (WebSocket-based)
- **Sentry**: Error tracking and performance monitoring
- **Google Calendar API**: Calendar synchronization
- **OpenWeatherMap API**: Weather monitoring and alerts
- **World Time API**: Accurate timezone handling

The system is designed for reliability, real-time responsiveness, and scalability.

