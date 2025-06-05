import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchRoomById, saveRoomCode, verifyRoomPassword } from '../services/api';
import CodeEditor from '../components/CodeEditor';
import PasswordModal from '../components/PasswordModal';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation(); // <-- get passed state

  const [room, setRoom] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [fetchedRoom, setFetchedRoom] = useState(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await fetchRoomById(roomId);
        setFetchedRoom(data);

        if (data.password) {
          // If password exists, check if password passed in location.state
          if (location.state?.password) {
            try {
              // Try verifying automatically with passed password
              await verifyRoomPassword(roomId, location.state.password);
              setRoom(data);
              setCode(data.code || '');
              setIsVerified(true);
              setPasswordRequired(false);
            } catch {
              // If verification fails, ask for password input
              setPasswordRequired(true);
            }
          } else {
            // No password passed, ask password modal
            setPasswordRequired(true);
          }
        } else {
          // No password required
          setRoom(data);
          setCode(data.code || '');
          setIsVerified(true);
        }
      } catch (err) {
        console.error(err);
        alert('Room not found!');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId, navigate, location.state]);

  const handlePasswordSubmit = async (pwd) => {
    try {
      await verifyRoomPassword(roomId, pwd);
      setRoom(fetchedRoom);
      setCode(fetchedRoom.code || '');
      setIsVerified(true);
      setPasswordRequired(false);
    } catch (err) {
      alert('Wrong password!');
      navigate('/');
    }
  };

  if (loading) return <p>Loading room...</p>;
  if (passwordRequired && !isVerified) return <PasswordModal onSubmit={handlePasswordSubmit} />;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">{room.roomName} (ID: {roomId})</h2>
      <CodeEditor code={code} onChange={setCode} language={room.language} />
      <button
        onClick={() => saveRoomCode(roomId, code)}
        className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
      >
        Save Code
      </button>
    </div>
  );
}

export default Room;
