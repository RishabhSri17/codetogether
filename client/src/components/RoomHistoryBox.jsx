import React, { useEffect, useState } from 'react';
import { fetchRooms } from '../services/api';
import { useNavigate } from 'react-router-dom';

function RoomHistoryBox() {
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await fetchRooms();
      setRooms(data);
    };
    fetch();
  }, []);

  return (
    <div className="bg-[#111] p-4 rounded-lg shadow-md border border-gray-700 max-h-96 overflow-y-auto">
      <h3 className="font-bold text-lg mb-2 sticky top-0 bg-[#111] z-10">Public Archive</h3>
      <div className="space-y-1">
        {rooms.map((room) => (
          <div
            key={room._id}
            className="flex justify-between items-center border-b border-gray-600 p-2 hover:bg-[#222] cursor-pointer"
            onClick={() => navigate(`/room/${room._id}`)}
          >
            <div>
              <span className="text-blue-400 hover:underline block">{room.roomName}</span>
              <span className="text-xs text-gray-500">
                ID: {room._id.slice(-6)} | Lang: {room.language || 'N/A'}
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(room.createdAt).toISOString().split('T')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RoomHistoryBox;
