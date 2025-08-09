import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
	fetchRoomById,
	saveRoomCode,
	verifyRoomPassword
} from "../services/api";
import CodeEditor from "../components/CodeEditor";
import PasswordModal from "../components/PasswordModal";
import ActiveUsers from "../components/ActiveUsers";
import SaveStatus from "../components/SaveStatus";

function Room() {
	const { roomId } = useParams();
	const navigate = useNavigate();
	const location = useLocation();

	const [room, setRoom] = useState(null);
	const [code, setCode] = useState("");
	const [loading, setLoading] = useState(true);
	const [isVerified, setIsVerified] = useState(false);
	const [passwordRequired, setPasswordRequired] = useState(false);
	const [fetchedRoom, setFetchedRoom] = useState(null);
	const [userId] = useState(
		() => `user_${Math.random().toString(36).substr(2, 9)}`
	);

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
							setCode(data.code || "");
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
					setCode(data.code || "");
					setIsVerified(true);
				}
			} catch (err) {
				console.error(err);
				alert("Room not found!");
				navigate("/");
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
			setCode(fetchedRoom.code || "");
			setIsVerified(true);
			setPasswordRequired(false);
		} catch (err) {
			alert("Wrong password!");
			navigate("/");
		}
	};

	if (loading) return <p>Loading room...</p>;
	if (passwordRequired && !isVerified)
		return <PasswordModal onSubmit={handlePasswordSubmit} />;

	return (
		<div className="p-4">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-xl font-bold">
					{room.roomName} (ID: {roomId})
				</h2>
				<div className="flex items-center gap-4">
					<ActiveUsers
						roomId={roomId}
						currentUserId={userId}
					/>
					<div className="text-sm text-gray-400">Your ID: {userId}</div>
				</div>
			</div>
			<CodeEditor
				code={code}
				onChange={setCode}
				language={room.language}
				roomId={roomId}
				userId={userId}
			/>
			<div className="mt-4 flex items-center justify-between">
				<div className="text-sm text-gray-500">
					💡 Code saves automatically every second when you stop typing
				</div>
				<SaveStatus roomId={roomId} />
			</div>
		</div>
	);
}

export default Room;
