import express from 'express';
import Section from '../models/Section.js';
import Schedule from '../models/Schedule.js'; // Import Schedule model
import Alert from '../models/Alert.js';
import { detectAndEmitChange } from '../utils/dataChangeDetector.js';

const router = express.Router();

// Create new section
router.post('/create', async (req, res) => {
  const { course, year, name } = req.body;
  if (!course || !year || !name) {
    return res.json({ success: false, message: 'Missing required fields' });
  }
  try {
    const newSection = new Section({ course, year, name });
    await newSection.save();

    const alert = await Alert.create({
      type: 'section-created',
      message: `Section ${name} created for ${course} ${year}.`,
      link: '/admin/section-management'
    });
    req.io?.emit('new-alert', alert);

    res.json({ success: true, section: newSection });
  } catch (error) {
    console.error('Error creating section:', error);
    res.json({ success: false, message: 'Error saving section' });
  }
});


// Get sections filtered by course and year (not archived)
router.get('/', async (req, res) => {
  const { course, year } = req.query;
  if (!course || !year) {
    return res.json({ success: false, message: 'Missing course or year query' });
  }
  try {
    const sections = await Section.find({ course, year, archived: false });
    detectAndEmitChange('sections', sections, req.io, 'data-updated:sections');
    res.json(sections);
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.json({ success: false, message: 'Error fetching sections' });
  }
});

// Get archived sections
router.get('/archived/list', async (req, res) => {
  try {
    const { course, year } = req.query;
    const filter = { archived: true };
    if (course) filter.course = course;
    if (year) filter.year = year;
    const archivedSections = await Section.find(filter);
    res.json(archivedSections);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching archived sections', error: error.message });
  }
});

// Archive section by ID (soft delete)
router.patch('/:id/archive', async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    section.archived = true;
    await section.save();

    const scheduleUpdate = await Schedule.updateMany(
      { course: section.course, year: section.year, section: section.name },
      { archived: true }
    );

    res.json({
      success: true,
      section,
      affectedSchedules: scheduleUpdate.modifiedCount || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error archiving section', error: error.message });
  }
});

// Restore archived section
router.patch('/:id/restore', async (req, res) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    section.archived = false;
    await section.save();

    const scheduleUpdate = await Schedule.updateMany(
      { course: section.course, year: section.year, section: section.name },
      { archived: false }
    );

    res.json({
      success: true,
      section,
      restoredSchedules: scheduleUpdate.modifiedCount || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error restoring section', error: error.message });
  }
});

// Permanently delete section by ID (and cascade delete associated schedules)
router.delete('/:id/permanent', async (req, res) => {
  try {
    const sectionId = req.params.id;
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    // Delete all schedules associated with this section
    const deleteSchedulesResult = await Schedule.deleteMany({ 
      section: section.name,
      course: section.course,
      year: section.year
    });
    await Section.findByIdAndDelete(sectionId);
    res.json({ 
      success: true, 
      message: 'Section and associated schedules permanently deleted',
      deletedSchedules: deleteSchedulesResult.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error permanently deleting section', error: error.message });
  }
});

export default router;
