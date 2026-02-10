import express from 'express';
import * as publicController from '../controllers/publicController.js';

const router = express.Router();

/**
 * PUBLIC API ROUTES
 *
 * These endpoints are publicly accessible and provide read-only access
 * to schedule information for students, parents, and external systems.
 *
 * Security considerations:
 * - No sensitive data (no instructor emails, internal IDs)
 * - Read-only operations
 * - Rate limiting recommended (can be added via middleware)
 * - CORS enabled for public access
 */

// ============== WORLD TIME API ==============
/** GET /api/public/time - Get current time from World Time API (query: timezone) */
router.get('/time', publicController.getPublicTime);

// ============== HEALTH CHECK ==============
router.get('/health', publicController.getPublicHealth);

// ============== COURSES & PROGRAMS ==============
/** GET /api/public/courses - Get list of available courses/programs */
router.get('/courses', publicController.getPublicCourses);

// ============== YEAR LEVELS ==============
/** GET /api/public/year-levels - Get list of available year levels */
router.get('/year-levels', publicController.getPublicYearLevels);

// ============== SECTIONS ==============
/** GET /api/public/sections - Get sections by course and year (query: course, year) */
router.get('/sections', publicController.getPublicSections);

// ============== ROOMS ==============
/** GET /api/public/rooms - Get list of available rooms */
router.get('/rooms', publicController.getPublicRooms);

// ============== SCHEDULES ==============
/** GET /api/public/schedules - Get schedules with filtering (query: course, year, section, day, room, instructor, subject, limit, page) */
router.get('/schedules', publicController.getPublicSchedules);
/** GET /api/public/schedules/by-section/:course/:year/:section */
router.get('/schedules/by-section/:course/:year/:section', publicController.getPublicSchedulesBySection);
/** GET /api/public/schedules/by-room/:room */
router.get('/schedules/by-room/:room', publicController.getPublicSchedulesByRoom);
/** GET /api/public/schedules/by-day/:day */
router.get('/schedules/by-day/:day', publicController.getPublicSchedulesByDay);

// ============== INSTRUCTORS ==============
/** GET /api/public/instructors - Get list of instructors (query: department, search) */
router.get('/instructors', publicController.getPublicInstructors);
/** GET /api/public/instructors/:instructorId */
router.get('/instructors/:instructorId', publicController.getPublicInstructorById);

// ============== STATISTICS ==============
/** GET /api/public/statistics - Get public statistics */
router.get('/statistics', publicController.getPublicStatistics);

export default router;
