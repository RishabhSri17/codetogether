import React, { useState, useEffect } from "react";
import socket from "../services/socket";

function SaveStatus({ roomId }) {
	const [status, setStatus] = useState("saved"); // 'saving', 'saved', 'error'
	const [lastSavedTime, setLastSavedTime] = useState(null);

	useEffect(() => {
		const handleCodeSaved = ({ timestamp, userId }) => {
			setStatus("saved");
			setLastSavedTime(new Date(timestamp));
		};

		const handleError = ({ message }) => {
			setStatus("error");
			console.error("Save error:", message);
			setTimeout(() => setStatus("saved"), 3000);
		};

		// Listen for save events
		socket.on("codeSaved", handleCodeSaved);
		socket.on("error", handleError);

		return () => {
			socket.off("codeSaved", handleCodeSaved);
			socket.off("error", handleError);
		};
	}, [roomId]);

	// Auto-reset to saved status after a delay
	useEffect(() => {
		if (status === "saving") {
			const timer = setTimeout(() => {
				setStatus("saved");
			}, 5000); // Reset after 5 seconds if no save confirmation

			return () => clearTimeout(timer);
		}
	}, [status]);

	const getStatusText = () => {
		switch (status) {
			case "saving":
				return "Saving...";
			case "saved":
				return lastSavedTime
					? `Saved at ${lastSavedTime.toLocaleTimeString()}`
					: "All changes saved";
			case "error":
				return "Save failed";
			default:
				return "";
		}
	};

	const getStatusColor = () => {
		switch (status) {
			case "saving":
				return "text-yellow-500";
			case "saved":
				return "text-green-500";
			case "error":
				return "text-red-500";
			default:
				return "text-gray-500";
		}
	};

	const getStatusIcon = () => {
		switch (status) {
			case "saving":
				return "⏳";
			case "saved":
				return "✓";
			case "error":
				return "✗";
			default:
				return "";
		}
	};

	return (
		<div className={`text-xs ${getStatusColor()} flex items-center gap-1`}>
			<span>{getStatusIcon()}</span>
			<span>{getStatusText()}</span>
		</div>
	);
}

export default SaveStatus;
