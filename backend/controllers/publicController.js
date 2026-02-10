import Schedule from '../models/Schedule.js';
import Section from '../models/Section.js';
import Room from '../models/Room.js';
import YearLevel from '../models/yearLevelModel.js';
import Instructor from '../models/Instructor.js';
import { getCurrentTime } from '../services/worldTimeService.js';

export const getPublicTime = async (req, res) => {
  const timezone = req.query.timezone || 'Etc/UTC';
  try {
    const timeData = await getCurrentTime(timezone);
    res.json(timeData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicHealth = (req, res) => {
  res.json({
    status: 'ok',
    service: 'Class Scheduling System Public API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};

export const getPublicCourses = async (req, res) => {
  try {
    const courses = await Schedule.distinct('course');
    const courseInfo = {
      bsit: {
        id: 'bsit',
        name: 'Bachelor of Science in Information Technology',
        shortName: 'BSIT',
        description: 'Information Technology Program'
      },
      'bsemc-dat': {
        id: 'bsemc-dat',
        name: 'Bachelor of Science in Entertainment and Multimedia Computing - Digital Animation Technology',
        shortName: 'BSEMC-DAT',
        description: 'Entertainment and Multimedia Computing Program'
      }
    };
    const availableCourses = courses.filter(course => courseInfo[course]).map(course => courseInfo[course]);
    res.json({ success: true, courses: availableCourses, count: availableCourses.length });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ success: false, message: 'Error fetching courses', error: error.message });
  }
};

export const getPublicYearLevels = async (req, res) => {
  try {
    const yearLevels = await YearLevel.find({}).select('year course subtitle -_id');
    res.json({ success: true, yearLevels: yearLevels || [], count: yearLevels?.length || 0 });
  } catch (error) {
    console.error('Error fetching year levels:', error);
    res.status(500).json({ success: false, message: 'Error fetching year levels', error: error.message });
  }
};

export const getPublicSections = async (req, res) => {
  try {
    const { course, year } = req.query;
    if (!course || !year) {
      return res.status(400).json({ success: false, message: 'Course and year parameters are required' });
    }
    const sections = await Section.find({ course, year }).select('name course year _id').sort({ name: 1 });
    res.json({ success: true, course, year, sections: sections || [], count: sections?.length || 0 });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ success: false, message: 'Error fetching sections', error: error.message });
  }
};

export const getPublicRooms = async (req, res) => {
  try {
    const rooms = await Room.find({}).select('room area status -_id').sort({ room: 1 });
    res.json({ success: true, rooms: rooms || [], count: rooms?.length || 0 });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ success: false, message: 'Error fetching rooms', error: error.message });
  }
};

export const getPublicSchedules = async (req, res) => {
  try {
    const { course, year, section, day, room, instructor, subject, limit = 100, page = 1 } = req.query;
    const query = {};
    if (course) query.course = course;
    if (year) query.year = year;
    if (section) query.section = section;
    if (day) query.day = { $regex: new RegExp(day, 'i') };
    if (room) query.room = room;
    if (instructor) query.instructor = { $regex: new RegExp(instructor, 'i') };
    if (subject) query.subject = { $regex: new RegExp(subject, 'i') };

    const limitNum = Math.min(parseInt(limit) || 100, 500);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    const [schedules, total] = await Promise.all([
      Schedule.find(query)
        .select('course year section subject instructor day time room -_id')
        .sort({ course: 1, year: 1, section: 1, day: 1, time: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Schedule.countDocuments(query)
    ]);

    res.json({
      success: true,
      schedules: schedules || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: skip + limitNum < total,
        hasPrev: pageNum > 1
      },
      filters: { course: course || null, year: year || null, section: section || null, day: day || null, room: room || null, instructor: instructor || null, subject: subject || null }
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, message: 'Error fetching schedules', error: error.message });
  }
};

export const getPublicSchedulesBySection = async (req, res) => {
  try {
    const { course, year, section } = req.params;
    const schedules = await Schedule.find({ course, year, section })
      .select('subject instructor day time room -_id')
      .sort({ day: 1, time: 1 })
      .lean();
    res.json({ success: true, course, year, section, schedules: schedules || [], count: schedules?.length || 0 });
  } catch (error) {
    console.error('Error fetching section schedules:', error);
    res.status(500).json({ success: false, message: 'Error fetching section schedules', error: error.message });
  }
};

export const getPublicSchedulesByRoom = async (req, res) => {
  try {
    const { room } = req.params;
    const schedules = await Schedule.find({ room })
      .select('course year section subject instructor day time -_id')
      .sort({ day: 1, time: 1 })
      .lean();
    res.json({ success: true, room, schedules: schedules || [], count: schedules?.length || 0 });
  } catch (error) {
    console.error('Error fetching room schedules:', error);
    res.status(500).json({ success: false, message: 'Error fetching room schedules', error: error.message });
  }
};

export const getPublicSchedulesByDay = async (req, res) => {
  try {
    const { day } = req.params;
    const schedules = await Schedule.find({ day: { $regex: new RegExp(day, 'i') } })
      .select('course year section subject instructor time room -_id')
      .sort({ time: 1 })
      .lean();
    res.json({ success: true, day, schedules: schedules || [], count: schedules?.length || 0 });
  } catch (error) {
    console.error('Error fetching day schedules:', error);
    res.status(500).json({ success: false, message: 'Error fetching day schedules', error: error.message });
  }
};

export const getPublicInstructors = async (req, res) => {
  try {
    const { department, search } = req.query;
    const query = { status: 'active' };
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { firstname: { $regex: new RegExp(search, 'i') } },
        { lastname: { $regex: new RegExp(search, 'i') } }
      ];
    }
    const instructors = await Instructor.find(query)
      .select('instructorId firstname lastname department -_id -email -password -image -status')
      .sort({ lastname: 1, firstname: 1 })
      .lean();
    res.json({ success: true, instructors: instructors || [], count: instructors?.length || 0 });
  } catch (error) {
    console.error('Error fetching instructors:', error);
    res.status(500).json({ success: false, message: 'Error fetching instructors', error: error.message });
  }
};

export const getPublicInstructorById = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const instructor = await Instructor.findOne({ instructorId, status: 'active' })
      .select('instructorId firstname lastname department -_id -email -password -image -status')
      .lean();

    if (!instructor) {
      return res.status(404).json({ success: false, message: 'Instructor not found' });
    }

    const schedules = await Schedule.find({
      instructor: { $regex: new RegExp(`${instructor.firstname} ${instructor.lastname}`, 'i') }
    })
      .select('course year section subject day time room -_id')
      .sort({ day: 1, time: 1 })
      .lean();

    res.json({
      success: true,
      instructor: { ...instructor, schedules: schedules || [], scheduleCount: schedules?.length || 0 }
    });
  } catch (error) {
    console.error('Error fetching instructor:', error);
    res.status(500).json({ success: false, message: 'Error fetching instructor', error: error.message });
  }
};

export const getPublicStatistics = async (req, res) => {
  try {
    const [
      totalSchedules,
      totalSections,
      totalRooms,
      totalInstructors,
      coursesCount,
      schedulesByDay,
      schedulesByCourse
    ] = await Promise.all([
      Schedule.countDocuments(),
      Section.countDocuments(),
      Room.countDocuments(),
      Instructor.countDocuments({ status: 'active' }),
      Schedule.distinct('course').then(courses => courses.length),
      Schedule.aggregate([{ $group: { _id: '$day', count: { $sum: 1 } } }]),
      Schedule.aggregate([{ $group: { _id: '$course', count: { $sum: 1 } } }])
    ]);

    res.json({
      success: true,
      statistics: {
        totalSchedules,
        totalSections,
        totalRooms,
        totalInstructors,
        totalCourses: coursesCount,
        schedulesByDay: schedulesByDay.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        schedulesByCourse: schedulesByCourse.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {})
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
};
