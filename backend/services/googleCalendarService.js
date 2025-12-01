import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to normalize private key format
const normalizePrivateKey = (key) => {
  if (!key) return null;
  
  // Remove surrounding quotes if present
  let normalized = key.trim();
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || 
      (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }
  
  // Handle different newline formats
  // Replace literal \n with actual newlines
  normalized = normalized.replace(/\\n/g, '\n');
  // Replace escaped newlines
  normalized = normalized.replace(/\\\\n/g, '\n');
  // Ensure proper line breaks
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }
  
  return normalized;
};

// Helper function to validate and get credentials
const getGoogleCredentials = () => {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const projectId = process.env.GOOGLE_PROJECT_ID?.trim();
  
  if (!clientEmail || !privateKeyRaw || !projectId) {
    return null;
  }
  
  const privateKey = normalizePrivateKey(privateKeyRaw);
  
  if (!privateKey || !privateKey.includes('BEGIN PRIVATE KEY')) {
    console.error('⚠️ GOOGLE_PRIVATE_KEY format is invalid. It must include "BEGIN PRIVATE KEY" and "END PRIVATE KEY"');
    return null;
  }
  
  return {
    client_email: clientEmail,
    private_key: privateKey,
    project_id: projectId
  };
};

// Initialize Google Calendar API using service account (calendar must be shared with this account)
let auth = null;
let calendar = null;

try {
  const credentials = getGoogleCredentials();
  if (credentials) {
    auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    
    calendar = google.calendar({ version: 'v3', auth });
    console.log('✅ Google Calendar API initialized successfully');
  } else {
    console.log('⚠️ Google Calendar API not initialized - credentials missing or invalid');
  }
} catch (error) {
  console.error('❌ Error initializing Google Calendar API:', error.message);
  auth = null;
  calendar = null;
}

/**
 * Convert day string to day of week number (0 = Sunday, 1 = Monday, etc.)
 */
const dayToDayOfWeek = (day) => {
  const dayMap = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3, 'weds': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };

  if (typeof day !== 'string') return null;
  const normalizedDay = day.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(dayMap, normalizedDay) ? dayMap[normalizedDay] : null;
};

/**
 * Convert day string to Google Calendar RRULE day abbreviation (SU, MO, TU, etc.)
 */
const dayToRRULEDay = (day) => {
  const dayMap = {
    'sunday': 'SU', 'sun': 'SU',
    'monday': 'MO', 'mon': 'MO',
    'tuesday': 'TU', 'tue': 'TU', 'tues': 'TU',
    'wednesday': 'WE', 'wed': 'WE', 'weds': 'WE',
    'thursday': 'TH', 'thu': 'TH', 'thur': 'TH', 'thurs': 'TH',
    'friday': 'FR', 'fri': 'FR',
    'saturday': 'SA', 'sat': 'SA',
  };
  
  if (typeof day !== 'string') return null;
  const normalizedDay = day.toLowerCase().trim();
  return dayMap[normalizedDay] || null;
};

/**
 * Parse time string to hours and minutes
 */
const parseTime = (timeStr) => {
  if (!timeStr) return null;
  
  // Handle time range like "7:30 AM - 10:00 AM"
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  
  let [, hours, minutes, period] = match;
  hours = parseInt(hours);
  minutes = parseInt(minutes);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
};

/**
 * Get current date/time components in Philippines timezone (Asia/Manila, UTC+8)
 * Returns an object with date components in Philippines time
 */
const getPhilippinesTimeComponents = () => {
  const now = new Date();
  // Get UTC time in milliseconds
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Philippines is UTC+8, so add 8 hours (8 * 60 * 60 * 1000 milliseconds)
  const philippinesOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  const philippinesTime = new Date(utcTime + philippinesOffset);
  
  return {
    year: philippinesTime.getUTCFullYear(),
    month: philippinesTime.getUTCMonth(),
    date: philippinesTime.getUTCDate(),
    day: philippinesTime.getUTCDay(),
    hours: philippinesTime.getUTCHours(),
    minutes: philippinesTime.getUTCMinutes(),
    seconds: philippinesTime.getUTCSeconds()
  };
};

/**
 * Get the next occurrence of a given day (using Philippines timezone)
 */
const getNextDayOccurrence = (dayOfWeek, time) => {
  const phTime = getPhilippinesTimeComponents(); // Use Philippines time
  const day = phTime.day;
  
  // Calculate days until next occurrence
  let daysUntil = dayOfWeek - day;
  if (daysUntil < 0 || (daysUntil === 0 && time)) {
    const currentTime = parseTime(time);
    if (currentTime) {
      const nowMinutes = phTime.hours * 60 + phTime.minutes;
      const eventMinutes = currentTime.hours * 60 + currentTime.minutes;
      if (nowMinutes >= eventMinutes) {
        daysUntil += 7;
      }
    } else {
      daysUntil += 7;
    }
  }
  
  // Create date in Philippines timezone
  const targetDate = phTime.date + daysUntil;
  const targetMonth = phTime.month;
  const targetYear = phTime.year;
  
  // Create a date object representing the target date/time in Philippines
  // We'll create it as UTC and then adjust
  const nextOccurrence = new Date(Date.UTC(targetYear, targetMonth, targetDate, 0, 0, 0));
  // Subtract 8 hours to get the correct UTC time that represents Philippines time
  nextOccurrence.setUTCHours(nextOccurrence.getUTCHours() - 8);
  
  return nextOccurrence;
};

const extractDaysFromString = (value = '') => {
  if (typeof value !== 'string') return [];
  const dayRegex = /(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thur|thurs|thu|friday|fri|saturday|sat)/gi;
  const matches = value.match(dayRegex);
  return matches ? matches.map(match => match.trim()) : [];
};

const getDaysArray = (schedule) => {
  if (Array.isArray(schedule?.days) && schedule.days.length) {
    return schedule.days;
  }
  if (typeof schedule?.day === 'string') {
    return extractDaysFromString(schedule.day);
  }
  return [];
};

const getNextOccurrenceForDays = (days, time) => {
  const dayNumbers = days
    .map(d => dayToDayOfWeek(d))
    .filter(d => d !== null);
  if (!dayNumbers.length) throw new Error('Invalid days provided');
  let bestDate = null;
  for (const d of dayNumbers) {
    const candidate = getNextDayOccurrence(d, time);
    if (!bestDate || candidate < bestDate) bestDate = candidate;
  }
  return bestDate;
};

/**
 * Get academic year start and end dates (June to May)
 * Returns { start: Date, end: Date }
 */
const getAcademicYearDates = () => {
  const phTime = getPhilippinesTimeComponents();
  const currentYear = phTime.year;
  const currentMonth = phTime.month + 1; // getPhilippinesTimeComponents returns 0-based month
  
  let academicYearStart, academicYearEnd;
  if (currentMonth >= 6) {
    // June onwards - we're in the current academic year, which ends next May
    academicYearStart = new Date(currentYear, 5, 1, 0, 0, 0); // June 1st (month is 0-based, so 5 = June)
    academicYearEnd = new Date(currentYear + 1, 4, 31, 23, 59, 59); // May 31st of next year
  } else {
    // January to May - we're in the second semester, academic year started last June
    academicYearStart = new Date(currentYear - 1, 5, 1, 0, 0, 0); // June 1st of last year
    academicYearEnd = new Date(currentYear, 4, 31, 23, 59, 59); // May 31st of current year
  }
  
  return { start: academicYearStart, end: academicYearEnd };
};

/**
 * Get the first occurrence of a specific day of week in the academic year
 * This ensures events appear on ALL matching days throughout the year
 */
const getFirstOccurrenceInAcademicYear = (dayOfWeek, hours, minutes) => {
  const { start: academicYearStart } = getAcademicYearDates();
  const firstDayOfWeek = academicYearStart.getDay();
  
  // Calculate days until first occurrence of target day
  let daysToFirstOccurrence = dayOfWeek - firstDayOfWeek;
  if (daysToFirstOccurrence < 0) daysToFirstOccurrence += 7;
  
  // Create date for first occurrence
  const firstOccurrence = new Date(academicYearStart);
  firstOccurrence.setDate(academicYearStart.getDate() + daysToFirstOccurrence);
  firstOccurrence.setHours(hours, minutes, 0, 0);
  
  return firstOccurrence;
};

/**
 * Convert schedule day and time to Google Calendar date (in Philippines timezone)
 */
const scheduleToDate = (day, time) => {
  const dayOfWeek = dayToDayOfWeek(day);
  if (dayOfWeek === null) {
    throw new Error(`Invalid day: ${day}`);
  }
  
  const date = getNextDayOccurrence(dayOfWeek, time);
  const timeData = parseTime(time);
  
  if (timeData) {
    // Set hours in Philippines timezone
    // Get current date components in Philippines time
    const phTime = getPhilippinesTimeComponents();
    const targetDate = date;
    // Calculate the target date in Philippines time
    const phDate = new Date(Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      timeData.hours,
      timeData.minutes,
      0
    ));
    // Adjust for Philippines timezone (UTC+8)
    phDate.setUTCHours(phDate.getUTCHours() - 8);
    return phDate;
  }
  
  return date;
};

/**
 * Create a recurring event in Google Calendar
 */
export const createCalendarEvent = async (schedule, instructorEmail) => {
  // Re-initialize if not already done
  if (!auth || !calendar) {
    const credentials = getGoogleCredentials();
    if (credentials) {
      try {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
      } catch (initError) {
        console.error('❌ Failed to initialize Google Calendar API:', initError.message);
        return null;
      }
    } else {
      console.warn('⚠️ Google Calendar credentials not available');
      return null;
    }
  }
  
  try {
    // Parse start and end time
    const timeParts = schedule.time.split(' - ');
    if (timeParts.length !== 2) {
      throw new Error('Invalid time format. Expected format: "7:30 AM - 10:00 AM"');
    }
    
    const days = getDaysArray(schedule);
    
    // Get Philippines time components to calculate the correct day
    const phTime = getPhilippinesTimeComponents();
    
    // Calculate next occurrence day in Philippines timezone
    const startTimeParsed = parseTime(timeParts[0].trim());
    if (!startTimeParsed) throw new Error('Invalid start time');
    
    let dayOfWeek = null;
    if (days.length) {
      // For multiple days, find the next occurrence
      const dayNumbers = days.map(d => dayToDayOfWeek(d)).filter(d => d !== null);
      if (!dayNumbers.length) throw new Error('Invalid days provided');
      
      let daysUntil = 7;
      for (const d of dayNumbers) {
        let diff = d - phTime.day;
        if (diff < 0 || (diff === 0 && (phTime.hours * 60 + phTime.minutes) >= (startTimeParsed.hours * 60 + startTimeParsed.minutes))) {
          diff += 7;
        }
        if (diff < daysUntil) {
          daysUntil = diff;
          dayOfWeek = d;
        }
      }
    } else {
      dayOfWeek = dayToDayOfWeek(schedule.day);
      if (dayOfWeek === null) throw new Error(`Invalid day: ${schedule.day}`);
    }
    
    // Format as ISO string in Philippines timezone
    const formatDateTimeForPhilippines = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    
    // For recurring events, use the first occurrence of the day in the academic year
    // This ensures the event appears on ALL matching days (e.g., all Mondays) throughout the year
    const targetDate = getFirstOccurrenceInAcademicYear(dayOfWeek, startTimeParsed.hours, startTimeParsed.minutes);
    const startDateStr = formatDateTimeForPhilippines(targetDate);
    
    // Calculate end date
    const endTimeParsed = parseTime(timeParts[1].trim());
    if (!endTimeParsed) throw new Error('Invalid end time');
    
    const endDate = new Date(targetDate);
    endDate.setHours(endTimeParsed.hours, endTimeParsed.minutes, 0, 0);
    
    // If start time is after end time, add a day to end date
    if (endDate <= targetDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    
    const endDateStr = formatDateTimeForPhilippines(endDate);
    
    const rruleDays = (days.length ? days : [schedule.day])
      .map(d => dayToRRULEDay(d))
      .filter(Boolean)
      .join(',');

    // Get academic year end date
    const { end: academicYearEnd } = getAcademicYearDates();
    
    // Convert academic year end to UTC for RRULE UNTIL (Philippines is UTC+8, so subtract 8 hours)
    const academicYearEndUTC = new Date(academicYearEnd.getTime() - (8 * 60 * 60 * 1000));
    // Format for RRULE UNTIL: YYYYMMDDTHHMMSSZ (UTC)
    const year = academicYearEndUTC.getUTCFullYear();
    const month = String(academicYearEndUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(academicYearEndUTC.getUTCDate()).padStart(2, '0');
    const untilDate = `${year}${month}${day}T235959Z`;
    
    // Create recurrence rule: FREQ=WEEKLY means it repeats every week
    // BYDAY specifies which days (e.g., MO for Monday, TU for Tuesday)
    // UNTIL specifies when to stop (end of academic year)
    // This ensures: Monday schedule → appears on ALL Mondays, Tuesday schedule → appears on ALL Tuesdays, etc.
    const recurrenceRule = rruleDays
      ? `RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilDate}`
      : null;

    const event = {
      summary: `${schedule.subject}`,
      description: `Course: ${schedule.course}\nYear: ${schedule.year}\nSection: ${schedule.section}\nRoom: ${schedule.room}`,
      location: schedule.room,
      start: {
        dateTime: startDateStr,
        timeZone: 'Asia/Manila',
      },
      end: {
        dateTime: endDateStr,
        timeZone: 'Asia/Manila',
      },
      ...(recurrenceRule ? { recurrence: [recurrenceRule] } : {}),
    };
    
    const response = await calendar.events.insert({
      calendarId: instructorEmail, // Use instructor's email as calendar ID
      sendUpdates: 'all',
      resource: event,
    });
    
    console.log(`✅ Google Calendar event created in ${instructorEmail}'s calendar: ${response.data.id}`);
    return response.data.id;
    
  } catch (error) {
    // Handle 404 - Calendar not found or not shared
    if (error.code === 404 || error.status === 404) {
      console.warn(`⚠️ Google Calendar not found for ${instructorEmail}. Calendar may not exist or service account doesn't have access. Event creation skipped.`);
      return null; // Return null instead of throwing to allow schedule creation to continue
    }
    
    // Handle 403 - Permission denied
    if (error.code === 403 || error.status === 403) {
      console.warn(`⚠️ Permission denied creating event in calendar for ${instructorEmail}. Calendar may not be shared with service account. Event creation skipped.`);
      return null; // Return null instead of throwing to allow schedule creation to continue
    }

    // Log other errors but don't throw to prevent breaking schedule creation
    if (error?.response?.data) {
      console.error('❌ Error creating Google Calendar event:', JSON.stringify(error.response.data));
    } else {
      console.error('❌ Error creating Google Calendar event:', error.message);
    }
    // Return null instead of throwing to allow schedule creation to continue
    return null;
  }
};

/**
 * List upcoming events from an instructor's Google Calendar
 * Returns empty array if calendar doesn't exist or isn't accessible
 */
export const listCalendarEvents = async (instructorEmail, { timeMin, timeMax, maxResults = 50 } = {}) => {
  if (!instructorEmail) {
    console.warn('⚠️ listCalendarEvents: Instructor email is required');
    return [];
  }

  // Re-initialize if not already done
  if (!auth || !calendar) {
    const credentials = getGoogleCredentials();
    if (credentials) {
      try {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
      } catch (initError) {
        console.error('❌ Failed to initialize Google Calendar API:', initError.message);
        return [];
      }
    } else {
      return [];
    }
  }

  try {
    const now = new Date();
    const params = {
      calendarId: instructorEmail,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults,
      timeMin: (timeMin ? new Date(timeMin) : now).toISOString(),
    };
    if (timeMax) params.timeMax = new Date(timeMax).toISOString();

    const res = await calendar.events.list(params);
    return res.data.items || [];
  } catch (error) {
    // Handle 404 - Calendar not found or not shared
    if (error.code === 404 || error.status === 404) {
      console.warn(`⚠️ Google Calendar not found or not shared for ${instructorEmail}. Calendar may not exist or service account doesn't have access.`);
      return [];
    }
    
    // Handle 403 - Permission denied
    if (error.code === 403 || error.status === 403) {
      console.warn(`⚠️ Permission denied accessing calendar for ${instructorEmail}. Calendar may not be shared with service account.`);
      return [];
    }

    // Log other errors but don't crash
    console.error(`❌ Error fetching Google Calendar events for ${instructorEmail}:`, error.message);
    return [];
  }
};

/**
 * Get a specific event by ID from an instructor's calendar
 * Returns null if calendar or event doesn't exist
 */
export const getCalendarEvent = async (instructorEmail, eventId) => {
  if (!instructorEmail || !eventId) {
    console.warn('⚠️ getCalendarEvent: Instructor email and eventId are required');
    return null;
  }

  // Re-initialize if not already done
  if (!auth || !calendar) {
    const credentials = getGoogleCredentials();
    if (credentials) {
      try {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
      } catch (initError) {
        console.error('❌ Failed to initialize Google Calendar API:', initError.message);
        return null;
      }
    } else {
      return null;
    }
  }

  try {
    const res = await calendar.events.get({ calendarId: instructorEmail, eventId });
    return res.data;
  } catch (error) {
    // Handle 404 - Calendar or event not found
    if (error.code === 404 || error.status === 404) {
      console.warn(`⚠️ Google Calendar event not found for ${instructorEmail} (eventId: ${eventId})`);
      return null;
    }
    
    // Handle 403 - Permission denied
    if (error.code === 403 || error.status === 403) {
      console.warn(`⚠️ Permission denied accessing calendar event for ${instructorEmail}`);
      return null;
    }

    console.error(`❌ Error fetching Google Calendar event for ${instructorEmail}:`, error.message);
    return null;
  }
};

/**
 * Update an existing Google Calendar event
 */
export const updateCalendarEvent = async (eventId, schedule, instructorEmail) => {
  // Re-initialize if not already done
  if (!auth || !calendar) {
    const credentials = getGoogleCredentials();
    if (credentials) {
      try {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
      } catch (initError) {
        console.error('❌ Failed to initialize Google Calendar API:', initError.message);
        return null;
      }
    } else {
      console.warn('⚠️ Google Calendar credentials not available');
      return null;
    }
  }
  
  try {
    if (!eventId) {
      throw new Error('Event ID is required for update');
    }
    
    // Parse start and end time
    const timeParts = schedule.time.split(' - ');
    if (timeParts.length !== 2) {
      throw new Error('Invalid time format. Expected format: "7:30 AM - 10:00 AM"');
    }
    
    const days = getDaysArray(schedule);
    
    // Get Philippines time components to calculate the correct day
    const phTime = getPhilippinesTimeComponents();
    
    // Calculate next occurrence day in Philippines timezone
    const startTimeParsed = parseTime(timeParts[0].trim());
    if (!startTimeParsed) throw new Error('Invalid start time');
    
    let dayOfWeek = null;
    if (days.length) {
      // For multiple days, find the next occurrence
      const dayNumbers = days.map(d => dayToDayOfWeek(d)).filter(d => d !== null);
      if (!dayNumbers.length) throw new Error('Invalid days provided');
      
      let daysUntil = 7;
      for (const d of dayNumbers) {
        let diff = d - phTime.day;
        if (diff < 0 || (diff === 0 && (phTime.hours * 60 + phTime.minutes) >= (startTimeParsed.hours * 60 + startTimeParsed.minutes))) {
          diff += 7;
        }
        if (diff < daysUntil) {
          daysUntil = diff;
          dayOfWeek = d;
        }
      }
    } else {
      dayOfWeek = dayToDayOfWeek(schedule.day);
      if (dayOfWeek === null) throw new Error(`Invalid day: ${schedule.day}`);
    }
    
    // Format as ISO string in Philippines timezone
    const formatDateTimeForPhilippines = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    
    // For recurring events, use the first occurrence of the day in the academic year
    // This ensures the event appears on ALL matching days (e.g., all Mondays) throughout the year
    const targetDate = getFirstOccurrenceInAcademicYear(dayOfWeek, startTimeParsed.hours, startTimeParsed.minutes);
    const startDateStr = formatDateTimeForPhilippines(targetDate);
    
    // Calculate end date
    const endTimeParsed = parseTime(timeParts[1].trim());
    if (!endTimeParsed) throw new Error('Invalid end time');
    
    const endDate = new Date(targetDate);
    endDate.setHours(endTimeParsed.hours, endTimeParsed.minutes, 0, 0);
    
    // If start time is after end time, add a day to end date
    if (endDate <= targetDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    
    const endDateStr = formatDateTimeForPhilippines(endDate);
    
    const rruleDays = (days.length ? days : [schedule.day])
      .map(d => dayToRRULEDay(d))
      .filter(Boolean)
      .join(',');

    // Get academic year end date
    const { end: academicYearEnd } = getAcademicYearDates();
    
    // Convert academic year end to UTC for RRULE UNTIL (Philippines is UTC+8, so subtract 8 hours)
    const academicYearEndUTC = new Date(academicYearEnd.getTime() - (8 * 60 * 60 * 1000));
    // Format for RRULE UNTIL: YYYYMMDDTHHMMSSZ (UTC)
    const year = academicYearEndUTC.getUTCFullYear();
    const month = String(academicYearEndUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(academicYearEndUTC.getUTCDate()).padStart(2, '0');
    const untilDate = `${year}${month}${day}T235959Z`;
    
    // Create recurrence rule: FREQ=WEEKLY means it repeats every week
    // BYDAY specifies which days (e.g., MO for Monday, TU for Tuesday)
    // UNTIL specifies when to stop (end of academic year)
    // This ensures: Monday schedule → appears on ALL Mondays, Tuesday schedule → appears on ALL Tuesdays, etc.
    const recurrenceRule = rruleDays
      ? `RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilDate}`
      : null;

    const event = {
      summary: `${schedule.subject}`,
      description: `Course: ${schedule.course}\nYear: ${schedule.year}\nSection: ${schedule.section}\nRoom: ${schedule.room}`,
      location: schedule.room,
      start: {
        dateTime: startDateStr,
        timeZone: 'Asia/Manila',
      },
      end: {
        dateTime: endDateStr,
        timeZone: 'Asia/Manila',
      },
      ...(recurrenceRule ? { recurrence: [recurrenceRule] } : {}),
    };
    
    const response = await calendar.events.update({
      calendarId: instructorEmail, // Use instructor's email as calendar ID
      eventId: eventId,
      sendUpdates: 'all',
      resource: event,
    });
    
    console.log(`✅ Google Calendar event updated in ${instructorEmail}'s calendar: ${response.data.id}`);
    return response.data.id;
    
  } catch (error) {
    // Handle 404 - Calendar or event not found
    if (error.code === 404 || error.status === 404) {
      console.warn(`⚠️ Google Calendar event not found for update (${instructorEmail}, eventId: ${eventId}). Event may have been deleted.`);
      return null;
    }
    
    // Handle 403 - Permission denied
    if (error.code === 403 || error.status === 403) {
      console.warn(`⚠️ Permission denied updating calendar event for ${instructorEmail}. Calendar may not be shared with service account.`);
      return null;
    }

    // Log other errors but don't throw to prevent breaking schedule updates
    if (error?.response?.data) {
      console.error('❌ Error updating Google Calendar event:', JSON.stringify(error.response.data));
    } else {
      console.error('❌ Error updating Google Calendar event:', error.message);
    }
    // Return null instead of throwing to allow schedule update to continue
    return null;
  }
};

/**
 * Delete a Google Calendar event
 */
export const deleteCalendarEvent = async (eventId, instructorEmail) => {
  // Re-initialize if not already done
  if (!auth || !calendar) {
    const credentials = getGoogleCredentials();
    if (credentials) {
      try {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendar = google.calendar({ version: 'v3', auth });
      } catch (initError) {
        console.error('❌ Failed to initialize Google Calendar API:', initError.message);
        return;
      }
    } else {
      console.warn('⚠️ Google Calendar credentials not available');
      return;
    }
  }
  
  try {
    if (!eventId) {
      console.warn('⚠️ No event ID provided for deletion');
      return;
    }
    
    if (!instructorEmail) {
      console.warn('⚠️ No instructor email provided for deletion');
      return;
    }
    
    await calendar.events.delete({
      calendarId: instructorEmail, // Use instructor's email as calendar ID
      eventId: eventId,
      sendUpdates: 'all',
    });
    
    console.log(`✅ Google Calendar event deleted from ${instructorEmail}'s calendar: ${eventId}`);
    
  } catch (error) {
    console.error('❌ Error deleting Google Calendar event:', error.message);
    // Don't throw error for deletion failures to avoid breaking the main flow
  }
};

// Cache configuration status (but allow re-checking)
let configStatusChecked = false;
let lastConfigCheck = null;

/**
 * Check if Google Calendar is configured
 * This function can be called multiple times and will re-check if env vars change
 */
export const isGoogleCalendarConfigured = () => {
  // Force reload dotenv to pick up any changes
  dotenv.config();
  
  const credentials = getGoogleCredentials();
  const configured = !!credentials;
  
  // Log status changes or on first check
  const currentCheck = {
    configured,
    hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
    hasProjectId: !!process.env.GOOGLE_PROJECT_ID
  };
  
  const statusChanged = !lastConfigCheck || 
    lastConfigCheck.configured !== currentCheck.configured ||
    lastConfigCheck.hasClientEmail !== currentCheck.hasClientEmail ||
    lastConfigCheck.hasPrivateKey !== currentCheck.hasPrivateKey ||
    lastConfigCheck.hasProjectId !== currentCheck.hasProjectId;
  
  if (!configStatusChecked || statusChanged) {
    if (!configured) {
      console.log('⚠️  Google Calendar is not configured.');
      if (!currentCheck.hasClientEmail) console.log('   ❌ GOOGLE_CLIENT_EMAIL is missing');
      if (!currentCheck.hasPrivateKey) console.log('   ❌ GOOGLE_PRIVATE_KEY is missing');
      if (!currentCheck.hasProjectId) console.log('   ❌ GOOGLE_PROJECT_ID is missing');
      
      // Check if private key format is wrong
      if (currentCheck.hasPrivateKey) {
        const normalized = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
        if (!normalized || !normalized.includes('BEGIN PRIVATE KEY')) {
          console.log('   ⚠️  GOOGLE_PRIVATE_KEY format is invalid. It must include "BEGIN PRIVATE KEY" and "END PRIVATE KEY"');
          console.log('   💡 Tip: Make sure the private key is in quotes and uses \\n for newlines');
          console.log('   💡 Example: GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYour\\nKey\\n-----END PRIVATE KEY-----\\n"');
        }
      }
      
      console.log('   Set these in your .env file and restart the server.');
    } else {
      console.log(`✅ Google Calendar is configured with service account: ${credentials.client_email}`);
    }
    lastConfigCheck = currentCheck;
    configStatusChecked = true;
  }
  
  return configured;
};

