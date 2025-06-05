import React, { useState } from 'react';
import { createRoom } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

function CreateRoomBox() {
  const [roomName, setRoomName] = useState('');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!roomName) return alert('Room name required!');
    const { data } = await createRoom(roomName, passwordEnabled ? password : null, language);
    navigate(`/room/${data._id}`, { state: { password: passwordEnabled ? password : null } });
  };

  return (
    <div className="bg-[#111] p-4 rounded-lg shadow-md space-y-4 border border-gray-700">
      <input
        className="bg-[#222] border border-gray-600 text-white p-2 w-full rounded"
        placeholder="Title"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />
      <select
        className="bg-[#222] border border-gray-600 text-white p-2 w-full rounded"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {['javascript', 'python', 'cpp', 'java', 'csharp', 'ruby', 'go', 'typescript', 'php', 'kotlin', 'swift', 'rust', 'html'].map(lang => (
          <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={passwordEnabled}
          onChange={() => setPasswordEnabled(!passwordEnabled)}
        />
        <span>Password</span>
      </div>
      {passwordEnabled && (
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="bg-[#222] border border-gray-600 text-white p-2 w-full rounded pr-10"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-2 top-2 text-gray-400 hover:text-white"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      )}
      <button
        className="bg-green-600 hover:bg-green-700 text-white w-full p-2 rounded"
        onClick={handleCreate}
      >
        Get Link
      </button>
    </div>
  );
}

export default CreateRoomBox;
