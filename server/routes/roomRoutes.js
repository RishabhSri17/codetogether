import express from 'express';
import {
  createRoom,
  getRooms,
  getRoomById,
  updateRoomCode,
  verifyRoomPassword,
} from '../controllers/roomController.js';

const router = express.Router();

router.post('/', createRoom);
router.get('/', getRooms);
router.get('/:roomId', getRoomById);
router.put('/:roomId', updateRoomCode);
router.post('/:roomId/verify', verifyRoomPassword);

export default router;
