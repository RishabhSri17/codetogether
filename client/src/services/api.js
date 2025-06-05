import axios from 'axios';

const API = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api` || 'http://localhost:5000/api',
});

// Room APIs
export const createRoom = (roomName, password = null, language = 'javascript') =>
  API.post('/rooms', { roomName, password, language });

export const fetchRooms = () => API.get('/rooms');

export const fetchRoomById = (roomId) => API.get(`/rooms/${roomId}`);

export const saveRoomCode = (roomId, code) =>
  API.put(`/rooms/${roomId}`, { code });

export const verifyRoomPassword = (roomId, password) =>
  API.post(`/rooms/${roomId}/verify`, { password });

export default API;
