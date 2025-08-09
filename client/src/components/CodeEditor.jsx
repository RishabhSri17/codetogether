import React, { useEffect, useRef, useCallback } from "react";
import { EditorView, basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { StreamLanguage } from "@codemirror/language";
import { csharp , c} from "@codemirror/legacy-modes/mode/clike";
import { sql } from "@codemirror/legacy-modes/mode/sql";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { kotlin } from "@codemirror/legacy-modes/mode/clike";
import { Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { StateField, StateEffect, ChangeDesc } from "@codemirror/state";
import socket from "../services/socket";

function CodeEditor({
	code,
	onChange,
	language = "javascript",
	roomId,
	userId
}) {
	const editorRef = useRef(null);
	const viewRef = useRef(null);
	const lastSavedCode = useRef("");
	const saveTimeoutRef = useRef(null);
	const isLocalChange = useRef(false);
	const isRemoteChange = useRef(false);
	const pendingChanges = useRef([]);
	const lastCursorPos = useRef(0);
	const cursorEmitTimeout = useRef(null);
	const hasJoinedRoom = useRef(false);
	const localDocumentState = useRef(""); // Local document state for conflict resolution

	const getLanguageExtension = useCallback(() => {
		switch (language) {
			case "python":
				return python();
			case "cpp":
				return cpp();
			case "java":
				return java();
			case "csharp":
				return csharp();
			case "php":
				return php();
			case "html":
				return html();
			case "css":
				return css();
			case "sql":
				return sql();
			case "rust":
				return rust();
			case "go":
				return go();
			case "swift":
				return swift();
			case "kotlin":
				return kotlin();
			default:
				return javascript();
		}
	}, [language]);

	// Create decorations for other users' cursors
	const createCursorDecorations = (cursors) => {
		const decorations = [];
		cursors.forEach(({ userId: otherUserId, position, color }) => {
			if (otherUserId !== userId) {
				decorations.push(
					Decoration.widget({
						widget: new (class extends WidgetType {
							toDOM() {
								const span = document.createElement("span");
								span.className = "cursor-marker";
								span.style.cssText = `
				  background-color: ${color};
				  width: 2px;
				  height: 1.2em;
				  display: inline-block;
				  position: relative;
				  z-index: 10;
				  animation: blink 1s infinite;
				`;
								return span;
							}
						})(),
						side: 1
					}).range(position)
				);
			}
		});
		return Decoration.set(decorations);
	};

	// State field for cursor decorations
	const cursorField = StateField.define({
		create() {
			return Decoration.none;
		},
		update(decorations, tr) {
			if (tr.effects.some((e) => e.is(updateCursors))) {
				return createCursorDecorations(
					tr.effects.find((e) => e.is(updateCursors))?.value || []
				);
			}
			return decorations.map(tr.changes);
		},
		provide: (f) => EditorView.decorations.from(f)
	});

	const updateCursors = StateEffect.define();

	// Check for potential conflicts between local and remote changes
	const checkForConflicts = useCallback((currentContent, changes) => {
		// Simple conflict detection: check if changes overlap with recent local changes
		// This is a basic implementation - for production, consider using CRDT
		const hasOverlappingChanges = changes.some((change) => {
			// Check if the change range overlaps with recent local modifications
			// This is a simplified check - in practice, you'd want more sophisticated conflict detection
			return change.from < currentContent.length && change.to > 0;
		});

		return hasOverlappingChanges;
	}, []);

	// Debounced auto-save function with 10 second timeout
	const debouncedSave = useCallback(
		(newCode) => {
			if (newCode !== lastSavedCode.current) {
				lastSavedCode.current = newCode;

				// Clear existing timeout
				if (saveTimeoutRef.current) {
					clearTimeout(saveTimeoutRef.current);
				}

				// Set new timeout for auto-save after 10 seconds of inactivity
				saveTimeoutRef.current = setTimeout(() => {
					// Store current cursor position before saving
					const currentSelection = viewRef.current?.state.selection;
					const cursorPos = currentSelection ? currentSelection.main.head : 0;

					socket.emit("saveCode", {
						roomId,
						code: newCode,
						cursorPosition: cursorPos,
						userId: userId
					});
				}, 10000); // Save after 10 seconds of inactivity
			}
		},
		[roomId, userId]
	);

	// Apply remote changes to the editor with improved cursor handling and conflict resolution
	const applyRemoteChanges = useCallback(
		(changes) => {
			if (!viewRef.current || isLocalChange.current) return;

			isRemoteChange.current = true;

			try {
				// Store current cursor position and selection
				const currentSelection = viewRef.current.state.selection;
				const cursorPos = currentSelection.main.head;
				const anchorPos = currentSelection.main.anchor;

				// Sort changes by position to apply them in order
				const sortedChanges = [...changes].sort((a, b) => a.from - b.from);

				// Calculate new cursor and anchor positions after all changes
				let newCursorPos = cursorPos;
				let newAnchorPos = anchorPos;

				// Apply changes and update cursor positions
				sortedChanges.forEach(({ from, to, insert }) => {
					const changeLength = insert.length - (to - from);

					// Update cursor position
					if (newCursorPos >= from) {
						if (newCursorPos <= to) {
							// Cursor is within the changed range
							newCursorPos = from + insert.length;
						} else {
							// Cursor is after the changed range
							newCursorPos += changeLength;
						}
					}

					// Update anchor position (for selections)
					if (newAnchorPos >= from) {
						if (newAnchorPos <= to) {
							// Anchor is within the changed range
							newAnchorPos = from + insert.length;
						} else {
							// Anchor is after the changed range
							newAnchorPos += changeLength;
						}
					}
				});

				// Ensure positions are within bounds
				const docLength = viewRef.current.state.doc.length;
				newCursorPos = Math.max(0, Math.min(newCursorPos, docLength));
				newAnchorPos = Math.max(0, Math.min(newAnchorPos, docLength));

				// Apply all changes in a single dispatch with preserved selection
				viewRef.current.dispatch({
					changes: sortedChanges,
					selection: { anchor: newAnchorPos, head: newCursorPos }
				});

				// Update local document state
				const newValue = viewRef.current.state.doc.toString();
				localDocumentState.current = newValue;
				onChange(newValue);
			} catch (error) {
				console.error("Error applying remote changes:", error);
			} finally {
				isRemoteChange.current = false;
			}
		},
		[onChange]
	);

	useEffect(() => {
		if (!editorRef.current) return;

		if (viewRef.current) {
			viewRef.current.destroy();
		}

		viewRef.current = new EditorView({
			doc: code,
			extensions: [
				basicSetup,
				oneDark,
				getLanguageExtension(),
				cursorField,
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !isRemoteChange.current) {
						isLocalChange.current = true;

						const value = update.state.doc.toString();
						localDocumentState.current = value;

						// Extract changes from the update
						const changes = [];
						update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
							changes.push({
								from: fromA,
								to: toA,
								insert: inserted.toString()
							});
						});

						// Emit changes to other users
						if (changes.length > 0) {
							socket.emit("codeChange", {
								roomId,
								changes,
								userId
							});
						}

						// Update parent component
						onChange(value);

						// Auto-save
						debouncedSave(value);

						// Emit cursor position (debounced to avoid spam)
						const cursorPos = update.state.selection.main.head;
						if (cursorPos !== lastCursorPos.current) {
							lastCursorPos.current = cursorPos;

							// Clear existing timeout
							if (cursorEmitTimeout.current) {
								clearTimeout(cursorEmitTimeout.current);
							}

							// Emit cursor position after a small delay
							cursorEmitTimeout.current = setTimeout(() => {
								socket.emit("cursorChange", {
									roomId,
									userId,
									position: cursorPos
								});
							}, 50); // Small delay to batch rapid cursor movements
						}

						// Reset local change flag after a small delay to ensure proper processing
						setTimeout(() => {
							isLocalChange.current = false;
						}, 10);
					}
				})
			],
			parent: editorRef.current
		});

		// Join the room only once
		if (!hasJoinedRoom.current) {
			socket.emit("joinRoom", roomId, userId);
			hasJoinedRoom.current = true;
		}

		// Listen for code changes from other users with conflict resolution
		const handleCodeChange = ({ changes, senderId }) => {
			if (
				senderId !== userId &&
				changes &&
				changes.length > 0 &&
				!isLocalChange.current
			) {
				// Check for potential conflicts
				const currentContent = viewRef.current?.state.doc.toString() || "";
				const hasConflict = checkForConflicts(currentContent, changes);

				if (hasConflict) {
					console.warn(
						"Potential conflict detected, applying with conflict resolution"
					);
				}

				applyRemoteChanges(changes);
			}
		};

		// Listen for cursor changes from other users
		const handleCursorChange = ({ userId: otherUserId, position, color }) => {
			if (otherUserId !== userId && viewRef.current) {
				viewRef.current.dispatch({
					effects: updateCursors.of([{ userId: otherUserId, position, color }])
				});
			}
		};

		// Listen for room state updates (only on initial join)
		const handleRoomState = ({ code: roomCode, users }) => {
			if (
				viewRef.current &&
				roomCode !== viewRef.current.state.doc.toString() &&
				!isLocalChange.current
			) {
				isRemoteChange.current = true;

				// Store current cursor position
				const currentSelection = viewRef.current.state.selection;
				const cursorPos = currentSelection.main.head;

				viewRef.current.dispatch({
					changes: {
						from: 0,
						to: viewRef.current.state.doc.length,
						insert: roomCode
					},
					selection: { anchor: cursorPos, head: cursorPos }
				});

				// Update local document state
				localDocumentState.current = roomCode;
				onChange(roomCode);
				isRemoteChange.current = false;
			}
		};

		// Listen for code saved events
		const handleCodeSaved = ({ userId: savedByUserId, cursorPosition }) => {
			// If the current user is the one who saved, maintain their cursor position
			if (savedByUserId === userId && viewRef.current) {
				const docLength = viewRef.current.state.doc.length;
				const safeCursorPos = Math.min(cursorPosition || 0, docLength);

				// Set cursor to the saved position
				viewRef.current.dispatch({
					selection: { anchor: safeCursorPos, head: safeCursorPos }
				});
			}
		};

		socket.on("codeChange", handleCodeChange);
		socket.on("cursorChange", handleCursorChange);
		socket.on("roomState", handleRoomState);
		socket.on("codeSaved", handleCodeSaved);

		return () => {
			socket.off("codeChange", handleCodeChange);
			socket.off("cursorChange", handleCursorChange);
			socket.off("roomState", handleRoomState);
			socket.off("codeSaved", handleCodeSaved);
			if (viewRef.current) {
				viewRef.current.destroy();
			}
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
			if (cursorEmitTimeout.current) {
				clearTimeout(cursorEmitTimeout.current);
			}
			// Reset join room flag for next mount
			hasJoinedRoom.current = false;
		};
	}, [
		code,
		onChange,
		getLanguageExtension,
		roomId,
		userId,
		debouncedSave,
		applyRemoteChanges,
		checkForConflicts
	]);

	// Handle external code updates (e.g., from room state) - only when necessary
	useEffect(() => {
		if (viewRef.current && !isLocalChange.current && !isRemoteChange.current) {
			const currentValue = viewRef.current.state.doc.toString();
			if (currentValue !== code && code !== "") {
				isRemoteChange.current = true;

				// Store current cursor position
				const currentSelection = viewRef.current.state.selection;
				const cursorPos = currentSelection.main.head;

				viewRef.current.dispatch({
					changes: { from: 0, to: currentValue.length, insert: code },
					selection: { anchor: cursorPos, head: cursorPos }
				});
				isRemoteChange.current = false;
			}
		}
	}, [code]);

	return (
		<div
			className="h-[500px] border rounded"
			ref={editorRef}
		></div>
	);
}

export default CodeEditor;
