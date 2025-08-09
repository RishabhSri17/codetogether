import Room from "./models/Room.js";

const socketServer = (io) => {
	// In-memory document cache for active rooms
	const docs = new Map(); // { roomId: { content: string, users: Set, lastModified: Date } }
	const userColors = new Map();
	const clientUserIds = new Map(); // Map socket.id to client userId

	// Periodic snapshot saving (every 30 seconds)
	const snapshotInterval = setInterval(async () => {
		for (const [roomId, doc] of docs.entries()) {
			if (doc.lastModified && Date.now() - doc.lastModified.getTime() > 5000) {
				try {
					await Room.findByIdAndUpdate(
						roomId,
						{ code: doc.content },
						{ new: true }
					);
					console.log(`Periodic snapshot saved for room ${roomId}`);
				} catch (error) {
					console.error(
						`Error saving periodic snapshot for room ${roomId}:`,
						error
					);
				}
			}
		}
	}, 30000); // 30 seconds

	// Generate a random color for each user
	const generateUserColor = (userId) => {
		const colors = [
			"#FF6B6B",
			"#4ECDC4",
			"#45B7D1",
			"#96CEB4",
			"#FFEAA7",
			"#DDA0DD",
			"#98D8C8",
			"#F7DC6F",
			"#BB8FCE",
			"#85C1E9",
			"#F8C471",
			"#82E0AA"
		];
		// Simple hash function for userId
		let hash = 0;
		for (let i = 0; i < userId.length; i++) {
			const char = userId.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return colors[Math.abs(hash) % colors.length];
	};

	// Apply changes to document content
	const applyChangesToDocument = (roomId, changes) => {
		if (!docs.has(roomId)) {
			docs.set(roomId, {
				content: "",
				users: new Set(),
				lastModified: new Date()
			});
		}

		const doc = docs.get(roomId);
		let currentContent = doc.content;

		// Sort changes by position to apply them in order
		const sortedChanges = [...changes].sort((a, b) => a.from - b.from);

		// Apply changes from end to beginning to maintain correct positions
		for (let i = sortedChanges.length - 1; i >= 0; i--) {
			const { from, to, insert } = sortedChanges[i];

			// Ensure from and to are within bounds
			const safeFrom = Math.max(0, Math.min(from, currentContent.length));
			const safeTo = Math.max(safeFrom, Math.min(to, currentContent.length));

			currentContent =
				currentContent.slice(0, safeFrom) +
				insert +
				currentContent.slice(safeTo);
		}

		doc.content = currentContent;
		doc.lastModified = new Date();
		return currentContent;
	};

	io.on("connection", (socket) => {
		console.log("New client connected:", socket.id);

		// Track which rooms each socket has joined to prevent duplicate joins
		const socketRooms = new Set();

		// Join a room
		socket.on("joinRoom", async (roomId, clientUserId) => {
			try {
				// Prevent duplicate room joins
				const roomKey = `${socket.id}-${roomId}`;
				if (socketRooms.has(roomKey)) {
					console.log(
						`User ${clientUserId} already joined room ${roomId}, skipping duplicate join`
					);
					return;
				}

				// Verify room exists
				const room = await Room.findById(roomId);
				if (!room) {
					socket.emit("error", { message: "Room not found" });
					return;
				}

				// Store the client's userId
				clientUserIds.set(socket.id, clientUserId);

				socket.join(roomId);
				socketRooms.add(roomKey);
				console.log(
					`User ${clientUserId} (socket: ${socket.id}) joined room: ${roomId}`
				);

				// Initialize document if not exists
				if (!docs.has(roomId)) {
					docs.set(roomId, {
						content: room.code || "",
						users: new Set(),
						lastModified: new Date()
					});
				}

				// Add user to document
				docs.get(roomId).users.add(clientUserId);

				// Assign color to user
				if (!userColors.has(clientUserId)) {
					userColors.set(clientUserId, generateUserColor(clientUserId));
				}

				// Notify other users in the room
				socket.to(roomId).emit("userJoined", {
					userId: clientUserId,
					color: userColors.get(clientUserId)
				});

				// Send current document state to the new user
				const doc = docs.get(roomId);
				socket.emit("roomState", {
					code: doc.content,
					users: Array.from(doc.users).map((id) => ({
						userId: id,
						color: userColors.get(id)
					}))
				});

				// Broadcast updated presence to all users in the room
				io.to(roomId).emit("presenceUpdate", {
					users: Array.from(doc.users).map((id) => ({
						userId: id,
						color: userColors.get(id)
					}))
				});
			} catch (error) {
				console.error("Error joining room:", error);
				socket.emit("error", { message: "Failed to join room" });
			}
		});

		// Handle code changes with differential updates
		socket.on("codeChange", ({ roomId, changes, userId }) => {
			// Validate input
			if (
				!roomId ||
				!changes ||
				!Array.isArray(changes) ||
				changes.length === 0
			) {
				console.warn("Invalid codeChange event received:", {
					roomId,
					changes,
					userId
				});
				return;
			}

			console.log(
				`Code change in room ${roomId} from user ${userId} with ${changes.length} changes`
			);

			// Apply changes to document
			const updatedContent = applyChangesToDocument(roomId, changes);

			// Broadcast changes to other users in the room
			socket.to(roomId).emit("codeChange", {
				changes,
				senderId: userId
			});
		});

		// Handle cursor changes
		socket.on("cursorChange", ({ roomId, userId, position }) => {
			// Validate input
			if (!roomId || typeof position !== "number" || position < 0) {
				console.warn("Invalid cursorChange event received:", {
					roomId,
					userId,
					position
				});
				return;
			}

			const clientUserId = clientUserIds.get(socket.id) || userId;
			const color = userColors.get(clientUserId);
			socket.to(roomId).emit("cursorChange", {
				userId: clientUserId,
				position,
				color
			});
		});

		// Handle auto-save with cursor position
		socket.on("saveCode", async ({ roomId, code, cursorPosition, userId }) => {
			try {
				const clientUserId = clientUserIds.get(socket.id) || userId;

				// Update database
				await Room.findByIdAndUpdate(roomId, { code }, { new: true });

				// Update in-memory document
				if (docs.has(roomId)) {
					docs.get(roomId).content = code;
					docs.get(roomId).lastModified = new Date();
				}

				console.log(
					`Code saved for room ${roomId} by user ${clientUserId} at cursor position ${cursorPosition}`
				);

				// Notify all users in the room that code was saved, including cursor position
				io.to(roomId).emit("codeSaved", {
					timestamp: new Date(),
					userId: clientUserId,
					cursorPosition: cursorPosition || 0
				});
			} catch (error) {
				console.error("Error saving code:", error);
				socket.emit("error", { message: "Failed to save code" });
			}
		});

		// Handle disconnection
		socket.on("disconnect", () => {
			const clientUserId = clientUserIds.get(socket.id);
			console.log("Client disconnected:", clientUserId || socket.id);

			// Remove user from all documents they were in
			for (const [roomId, doc] of docs.entries()) {
				if (doc.users.has(clientUserId)) {
					doc.users.delete(clientUserId);
					socket.to(roomId).emit("userLeft", { userId: clientUserId });

					// Broadcast updated presence
					io.to(roomId).emit("presenceUpdate", {
						users: Array.from(doc.users).map((id) => ({
							userId: id,
							color: userColors.get(id)
						}))
					});

					// Clean up empty documents
					if (doc.users.size === 0) {
						docs.delete(roomId);
						console.log(`Document ${roomId} cleaned up - no users remaining`);
					}
				}
			}

			// Clean up user data
			userColors.delete(clientUserId);
			clientUserIds.delete(socket.id);
		});
	});

	// Return cleanup function for the interval
	return () => {
		clearInterval(snapshotInterval);
	};
};

export default socketServer;
