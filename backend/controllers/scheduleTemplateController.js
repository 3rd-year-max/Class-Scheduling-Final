import ScheduleTemplate from '../models/ScheduleTemplate.js';

export const getAllTemplates = async (req, res) => {
  try {
    const { course, year } = req.query;
    const query = {};
    if (course) query.course = course;
    if (year) query.year = year;

    const templates = await ScheduleTemplate.find(query).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: 'Error fetching templates' });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ success: false, message: 'Error fetching template' });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { name, description, course, year, schedules } = req.body;

    if (!name || !course || !year || !schedules || !Array.isArray(schedules)) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const template = new ScheduleTemplate({
      name,
      description: description || '',
      course,
      year,
      schedules,
    });

    await template.save();
    res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: 'Error creating template' });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { name, description, schedules } = req.body;

    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (name) template.name = name;
    if (description !== undefined) template.description = description;
    if (schedules && Array.isArray(schedules)) template.schedules = schedules;

    await template.save();
    res.json({ success: true, template });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: 'Error updating template' });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const template = await ScheduleTemplate.findByIdAndDelete(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: 'Error deleting template' });
  }
};
