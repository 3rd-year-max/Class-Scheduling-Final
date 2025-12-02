# Database Schema Documentation

## System Overview
This Class Scheduling System uses **MongoDB** as the database with **Mongoose** as the ODM (Object Document Mapper). The system manages class schedules, instructors, sections, rooms, and various notifications.

---

## Collections (Tables)

### 1. Admin
**Collection Name:** `admins`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `password` | String | Yes | Hashed admin password |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:** None

**Relationships:**
- One-to-Many with `AdminMessage` (as sender)

---

### 2. Instructor
**Collection Name:** `instructors`

| Field | Type | Required | Unique | Description |
|-------|------|----------|--------|-------------|
| `_id` | ObjectId | Yes | Yes | Primary key (auto-generated) |
| `instructorId` | String | No | Yes (sparse) | Unique instructor identifier |
| `firstname` | String | No | No | Instructor's first name |
| `lastname` | String | No | No | Instructor's last name |
| `email` | String | Yes | Yes | Instructor's email (lowercase, trimmed) |
| `password` | String | No | No | Hashed instructor password |
| `contact` | String | No | No | Contact information |
| `department` | String | No | No | Department name (e.g., "IT", "EMC") |
| `image` | String | No | No | Profile image path (default: '') |
| `status` | String | No | No | Status: 'pending', 'active', 'archived' (default: 'pending') |
| `__v` | Number | Auto | No | Version key for optimistic concurrency |
| `createdAt` | Date | Auto | No | Timestamp when created |
| `updatedAt` | Date | Auto | No | Timestamp when last updated |

**Indexes:**
- `email` (unique)
- `status`
- `instructorId` (unique, sparse)

**Relationships:**
- One-to-Many with `Schedule` (via `instructor` and `instructorEmail`)
- One-to-Many with `AdminMessage` (as recipient)
- One-to-Many with `InstructorNotification`
- One-to-Many with `EmailNotification`

---

### 3. Schedule
**Collection Name:** `schedules`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `course` | String | Yes | Course name (e.g., "BSIT", "BSEMC-DAT") |
| `year` | String | Yes | Year level (e.g., "1st Year", "2nd Year") |
| `section` | String | Yes | Section name |
| `subject` | String | Yes | Subject name |
| `instructor` | String | Yes | Instructor full name |
| `instructorEmail` | String | No | Instructor email (for Google Calendar sync) |
| `day` | String | Yes | Day of week (e.g., "Monday", "Tuesday") |
| `time` | String | Yes | Time range (e.g., "7:30 AM - 9:00 AM") |
| `room` | String | Yes | Room name |
| `googleCalendarEventId` | String | No | Google Calendar event ID for sync |
| `archived` | Boolean | No | Archive flag (default: false) |
| `__v` | Number | Auto | Version key for optimistic concurrency |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- Compound: `{ room: 1, day: 1, time: 1 }` (for conflict detection)
- Compound: `{ instructor: 1, day: 1, time: 1 }` (for instructor conflict detection)
- Compound: `{ instructorEmail: 1, archived: 1 }` (for instructor workload queries)
- `archived` (for filtering active schedules)
- Compound: `{ course: 1, year: 1, section: 1 }` (for course/year/section queries)
- `googleCalendarEventId` (for Google Calendar sync)

**Relationships:**
- Many-to-One with `Instructor` (via `instructor` and `instructorEmail`)
- Many-to-One with `Section` (via `course`, `year`, `section`)
- Many-to-One with `Room` (via `room`)

---

### 4. Section
**Collection Name:** `sections`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `course` | String | Yes | Course name |
| `year` | String | Yes | Year level |
| `name` | String | Yes | Section name (e.g., "A", "B", "1") |
| `archived` | Boolean | No | Archive flag (default: false) |
| `__v` | Number | Auto | Version key for optimistic concurrency |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- Compound Unique: `{ course: 1, year: 1, name: 1 }` (ensures unique sections per course/year)
- `archived` (for filtering active sections)
- Compound: `{ course: 1, year: 1 }` (for course/year queries)

**Relationships:**
- One-to-Many with `Schedule` (via `course`, `year`, `section`)

---

### 5. Room
**Collection Name:** `rooms`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `room` | String | Yes | Room name/identifier (unique) |
| `area` | String | Yes | Room area/location |
| `status` | String | Yes | Status: 'available', 'occupied', 'maintenance' (default: 'available') |
| `archived` | Boolean | No | Archive flag (default: false) |
| `__v` | Number | Auto | Version key for optimistic concurrency |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- `room` (unique)
- Compound: `{ status: 1, archived: 1 }` (for available rooms query)
- `archived` (for filtering active rooms)

**Relationships:**
- One-to-Many with `Schedule` (via `room`)

---

### 6. YearLevel
**Collection Name:** `year-levels`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `course` | String | Yes | Course name |
| `subtitle` | String | Yes | Year level subtitle/description |
| `year` | String | Yes | Year level (e.g., "1st Year", "2nd Year") |

**Indexes:** None

**Relationships:**
- Referenced by `Schedule` and `Section` (via `year` field)

---

### 7. Alert
**Collection Name:** `alerts`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `type` | String | No | Alert type (e.g., 'availability-update') |
| `message` | String | Yes | Alert message content |
| `source` | String | No | Source: 'admin' or 'instructor' (default: 'admin') |
| `link` | String | No | Optional link URL (default: null) |
| `meta` | Mixed | No | Optional extra metadata |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:** None

**Relationships:** None (standalone alerts)

---

### 8. AdminMessage
**Collection Name:** `adminmessages`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `instructor` | ObjectId | Yes | Reference to Instructor (ref: 'Instructor') |
| `admin` | ObjectId | Yes | Reference to Admin (ref: 'Admin') |
| `message` | String | Yes | Message content |
| `read` | Boolean | No | Read status (default: false) |
| `createdAt` | Date | Auto | Timestamp when created |

**Indexes:** None

**Relationships:**
- Many-to-One with `Instructor` (as recipient)
- Many-to-One with `Admin` (as sender)

---

### 9. InstructorNotification
**Collection Name:** `instructornotifications`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `instructorEmail` | String | Yes | Instructor email (lowercase, trimmed) |
| `title` | String | Yes | Notification title |
| `message` | String | Yes | Notification message |
| `link` | String | No | Optional link URL (default: null) |
| `read` | Boolean | No | Read status (default: false) |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- Compound: `{ instructorEmail: 1, createdAt: -1 }` (for efficient querying by instructor and date)

**Relationships:**
- Many-to-One with `Instructor` (via `instructorEmail`)

---

### 10. EmailNotification
**Collection Name:** `emailnotifications`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `instructorEmail` | String | Yes | Instructor email (lowercase, trimmed) |
| `preferencesEnabled` | Boolean | No | Global email preferences toggle (default: true) |
| `scheduleChanges` | Boolean | No | Schedule change notifications (default: true) |
| `roomStatus` | Boolean | No | Room status notifications (default: true) |
| `weatherAlerts` | Boolean | No | Weather alert notifications (default: true) |
| `adminMessages` | Boolean | No | Admin message notifications (default: true) |
| `history` | Array | No | Email history array |
| `history[].type` | String | Yes | History entry type (e.g., 'scheduleChange', 'roomStatus') |
| `history[].message` | String | Yes | History entry message |
| `history[].sentAt` | Date | Auto | Timestamp when email was sent |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- `instructorEmail` (for efficient lookups)

**Relationships:**
- One-to-One with `Instructor` (via `instructorEmail`)

---

### 11. PasswordResetToken
**Collection Name:** `passwordresettokens`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `email` | String | Yes | User email (lowercase, trimmed, indexed) |
| `token` | String | Yes | Reset token (unique, indexed) |
| `expiresAt` | Date | Yes | Expiration date (auto-delete after 1 hour) |
| `used` | Boolean | No | Whether token has been used (default: false) |
| `userType` | String | Yes | User type: 'instructor' (default: 'instructor') |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:**
- `email` (for lookups)
- `token` (unique, for lookups)
- `expiresAt` (TTL index, auto-delete after expiration)

**Relationships:**
- Referenced by `Instructor` (via `email`)

---

### 12. ScheduleTemplate
**Collection Name:** `scheduletemplates`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | Yes | Primary key (auto-generated) |
| `name` | String | Yes | Template name |
| `description` | String | No | Template description (default: '') |
| `course` | String | Yes | Course name |
| `year` | String | Yes | Year level |
| `schedules` | Array | No | Array of schedule objects |
| `schedules[].subject` | String | Yes | Subject name |
| `schedules[].instructor` | String | Yes | Instructor name |
| `schedules[].instructorEmail` | String | No | Instructor email |
| `schedules[].day` | String | Yes | Day of week |
| `schedules[].time` | String | Yes | Time range |
| `schedules[].room` | String | Yes | Room name |
| `createdBy` | String | No | Creator identifier (default: 'admin') |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:** None

**Relationships:**
- Referenced by `Schedule` (templates can be used to create schedules)

---

### 13. Counter
**Collection Name:** `counters`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | String | Yes | Counter name (e.g., 'instructorId') |
| `seq` | Number | No | Sequence number (default: 0) |
| `createdAt` | Date | Auto | Timestamp when created |
| `updatedAt` | Date | Auto | Timestamp when last updated |

**Indexes:** None

**Relationships:**
- Used for generating auto-incrementing IDs (e.g., `instructorId`)

---

## Key Features

### Optimistic Concurrency Control (MVCC)
The following collections use version keys (`__v`) for optimistic concurrency:
- `Instructor`
- `Schedule`
- `Section`
- `Room`

This prevents concurrent update conflicts by checking the version before updating.

### Timestamps
All collections (except `Counter`) automatically include:
- `createdAt`: Date when document was created
- `updatedAt`: Date when document was last updated

### Archive Pattern
Several collections use an `archived` flag for soft deletion:
- `Schedule`
- `Section`
- `Room`

This allows data retention while hiding inactive records.

---

## Data Types Reference

- **ObjectId**: MongoDB's unique identifier (24-character hex string)
- **String**: Text data
- **Number**: Numeric data
- **Boolean**: True/false values
- **Date**: Date and time values
- **Array**: List of values
- **Mixed**: Any type (flexible schema)
- **Enum**: Restricted to specific string values

---

## Notes

1. **Email Normalization**: All email fields are stored in lowercase and trimmed for consistency.
2. **Sparse Indexes**: The `instructorId` field uses a sparse unique index, meaning it only enforces uniqueness for documents that have this field.
3. **TTL Indexes**: `PasswordResetToken` uses a TTL (Time To Live) index to automatically delete expired tokens.
4. **Compound Indexes**: Multiple fields are indexed together for efficient querying of related data.
5. **References**: Some relationships use ObjectId references (e.g., `AdminMessage`), while others use string matching (e.g., `Schedule` to `Instructor` via email).

