import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react'; 

const PasswordModal = ({ onSubmit }) => {
  const [input, setInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(input);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-lg font-semibold mb-4">Enter Room Password</h2>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="w-full border border-gray-300 p-2 rounded pr-10"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            required
          />
          <button
            type="button"
            className="absolute right-3 top-2.5 text-gray-500"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded w-full mt-4"
        >
          Join Room
        </button>
      </form>
    </div>
  );
};

export default PasswordModal;
