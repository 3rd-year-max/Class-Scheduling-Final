import YearLevel from '../models/yearLevelModel.js';
import Alert from '../models/Alert.js';

export const getAllYearLevels = async (req, res) => {
  try {
    const yearLevels = await YearLevel.find({});
    res.json(yearLevels);
  } catch (error) {
    console.error('Error fetching year levels:', error);
    res.status(500).json({ message: 'Server error while fetching year levels' });
  }
};

export const createYearLevel = async (req, res) => {
  const { course, subtitle, year } = req.body;
  if (!course || !subtitle || !year) {
    return res.status(400).json({ message: 'All fields (course, subtitle, year) are required.' });
  }
  try {
    const newYearLevel = new YearLevel({ course, subtitle, year });
    const savedYearLevel = await newYearLevel.save();

    const alert = await Alert.create({
      type: 'yearlevel-added',
      message: `New year level added: ${course} - ${subtitle} (${year})`,
      link: '/admin/yearlevel-management'
    });
    req.io?.emit('new-alert', alert);

    res.status(201).json(savedYearLevel);
  } catch (error) {
    console.error('Error saving year level:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
