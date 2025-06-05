import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function JoinRoomBox() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId) return;
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="bg-[#111] p-4 rounded-lg shadow-md border border-gray-700 space-y-4">
      <input
        className="bg-[#222] border border-gray-600 text-white p-2 w-full rounded"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button
        className="bg-green-600 hover:bg-green-700 text-white w-full p-2 rounded"
        onClick={handleJoin}
      >
        Join Room
      </button>
    </div>
  );
}

export default JoinRoomBox;
