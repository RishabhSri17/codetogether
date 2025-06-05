import React from 'react';
import CreateRoomBox from '../components/CreateRoomBox';
import RoomHistoryBox from '../components/RoomHistoryBox';
import JoinRoomBox from '../components/JoinRoomBox';

function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-center text-green-500 mb-6">
        Code<span className="text-white">Together</span>
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <CreateRoomBox />
        <RoomHistoryBox />
        <JoinRoomBox />
      </div>
    </div>
  );
}

export default HomePage;
