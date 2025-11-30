import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  course: { type: String, required: true },
  year: { type: String, required: true },
  section: { type: String, required: true },
  subject: { type: String, required: true },
  instructor: { type: String, required: true },
  instructorEmail: { type: String, required: false },
  day: { type: String, required: true },
  time: { type: String, required: true },
  room: { type: String, required: true },
  googleCalendarEventId: { type: String, required: false },
  archived: { type: Boolean, default: false },
}, { 
  timestamps: true,
  versionKey: '__v',
  optimisticConcurrency: true
});

// Indexes for conflict detection and common queries
scheduleSchema.index({ room: 1, day: 1, time: 1 });
scheduleSchema.index({ instructor: 1, day: 1, time: 1 });
scheduleSchema.index({ instructorEmail: 1, archived: 1 }); // For instructor workload queries
scheduleSchema.index({ archived: 1 });
scheduleSchema.index({ course: 1, year: 1, section: 1 }); // For course/year/section queries
scheduleSchema.index({ googleCalendarEventId: 1 }); // For Google Calendar sync

export default mongoose.model("Schedule", scheduleSchema);
