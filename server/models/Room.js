import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  password: { type: String, default: null },
  language: { type: String, default: 'javascript' },
  code: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Room', roomSchema);
