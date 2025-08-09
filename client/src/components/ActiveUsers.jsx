import React, { useState, useEffect } from "react";
import socket from "../services/socket";

function ActiveUsers({ roomId, currentUserId }) {
	const [users, setUsers] = useState([]);

	useEffect(() => {
		const handleUserJoined = ({ userId, color }) => {
			setUsers((prev) => {
				const existing = prev.find((u) => u.userId === userId);
				if (!existing) {
					return [...prev, { userId, color }];
				}
				return prev;
			});
		};

		const handleUserLeft = ({ userId }) => {
			setUsers((prev) => prev.filter((u) => u.userId !== userId));
		};

		const handleRoomState = ({ users: roomUsers }) => {
			setUsers(roomUsers.filter((u) => u.userId !== currentUserId));
		};

		const handlePresenceUpdate = ({ users: roomUsers }) => {
			setUsers(roomUsers.filter((u) => u.userId !== currentUserId));
		};

		socket.on("userJoined", handleUserJoined);
		socket.on("userLeft", handleUserLeft);
		socket.on("roomState", handleRoomState);
		socket.on("presenceUpdate", handlePresenceUpdate);

		return () => {
			socket.off("userJoined", handleUserJoined);
			socket.off("userLeft", handleUserLeft);
			socket.off("roomState", handleRoomState);
			socket.off("presenceUpdate", handlePresenceUpdate);
		};
	}, [currentUserId]);

	if (users.length === 0) {
		return <div className="text-sm text-gray-500">No other users in room</div>;
	}

	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-gray-400">Active users:</span>
			<div className="flex gap-1">
				{users.map((user) => (
					<div
						key={user.userId}
						className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
						style={{ backgroundColor: user.color + "20", color: user.color }}
					>
						<div
							className="w-2 h-2 rounded-full"
							style={{ backgroundColor: user.color }}
						/>
						{user.userId.slice(-4)}
					</div>
				))}
			</div>
		</div>
	);
}

export default ActiveUsers;
