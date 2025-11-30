import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  room: { type: String, required: true },
  area: { type: String, required: true },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance'],
    required: true,
    default: 'available',
  },
  archived: { type: Boolean, default: false },
}, {
  timestamps: true,
  versionKey: '__v',
  optimisticConcurrency: true
});

// Indexes for room queries
roomSchema.index({ room: 1 }, { unique: true }); // Ensure unique room names
roomSchema.index({ status: 1, archived: 1 }); // Compound index for available rooms query
roomSchema.index({ archived: 1 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
