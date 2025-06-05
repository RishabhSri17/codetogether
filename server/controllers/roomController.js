import Room from '../models/Room.js';

export const createRoom = async (req, res) => {
  const { roomName, password, language } = req.body;
  const room = new Room({
    roomName,
    password,
    language,
    code: '',
  });
  await room.save();
  res.status(201).json(room);
};

export const getRooms = async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.status(200).json(rooms);
};

export const getRoomById = async (req, res) => {
  const { roomId } = req.params;
  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }
  res.status(200).json(room);
};

export const updateRoomCode = async (req, res) => {
  const { roomId } = req.params;
  const { code } = req.body;
  const room = await Room.findByIdAndUpdate(roomId, { code }, { new: true });
  if (!room) {
    return res.status(404).json({ message: 'Room not found' });
  }
  res.status(200).json(room);
};


export const verifyRoomPassword = async (req, res) => {
  const { roomId } = req.params;
  const { password } = req.body;

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (!room.password || room.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    return res.status(200).json({ message: 'Password verified' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};
