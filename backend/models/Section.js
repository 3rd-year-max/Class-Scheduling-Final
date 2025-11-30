import mongoose from 'mongoose';


const sectionSchema = new mongoose.Schema({
  course: { type: String, required: true },
  year: { type: String, required: true },
  name: { type: String, required: true },
  archived: { type: Boolean, default: false },
}, {
  timestamps: true,
  versionKey: '__v',
  optimisticConcurrency: true
});

// Indexes for faster queries and uniqueness constraint
sectionSchema.index({ course: 1, year: 1, name: 1 }, { unique: true }); // Ensure unique sections
sectionSchema.index({ archived: 1 });
sectionSchema.index({ course: 1, year: 1 }); // For course/year queries

const Section = mongoose.model('Section', sectionSchema);
export default Section;
