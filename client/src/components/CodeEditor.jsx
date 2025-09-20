import React, { useEffect, useRef, useCallback } from "react";

// View / decorations
import {
  EditorView,
  Decoration,
  WidgetType,
  keymap,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  rectangularSelection,
  crosshairCursor
} from "@codemirror/view";

// State
import { StateField, StateEffect, Compartment } from "@codemirror/state";

// Language infra (+ bracketMatching here)
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  bracketMatching,
  StreamLanguage
} from "@codemirror/language";

// Commands & keymaps
import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";

// Close brackets moved to @codemirror/autocomplete
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

// Search utils
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";

// Theme
import { oneDark } from "@codemirror/theme-one-dark";

// Modern language packs
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";

// Legacy modes (wrap with StreamLanguage.define)
import { csharp, kotlin } from "@codemirror/legacy-modes/mode/clike";
import { sql } from "@codemirror/legacy-modes/mode/sql";
import { swift } from "@codemirror/legacy-modes/mode/swift";

import socket from "../services/socket";

function CodeEditor({ code, onChange, language = "javascript", roomId, userId }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  const languageCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const lastSavedCode = useRef("");
  const saveTimeoutRef = useRef(null);
  const isLocalChange = useRef(false);
  const isRemoteChange = useRef(false);
  const lastCursorPos = useRef(0);
  const cursorEmitTimeout = useRef(null);
  const hasJoinedRoom = useRef(false);
  const localDocumentState = useRef("");

  // ---------- Minimal setup ----------
  const minimalSetup = [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap
    ])
  ];

  // clamp a position into [0, doc.length]
  const clampPos = (view, pos) =>
    Math.max(0, Math.min(pos ?? 0, view.state.doc.length));

  // ---------- Remote cursor decorations ----------
  const updateCursors = StateEffect.define();

  const createCursorDecorations = (cursors, docLen) => {
    const decos = [];
    for (const { userId: otherId, position, color } of cursors || []) {
      if (otherId !== userId && Number.isFinite(position)) {
        const p = Math.max(0, Math.min(position, docLen)); // clamp
        decos.push(
          Decoration.widget({
            widget: new (class extends WidgetType {
              toDOM() {
                const span = document.createElement("span");
                span.className = "cursor-marker";
                span.style.cssText = `
                  background-color: ${color || "currentColor"};
                  width: 2px; height: 1.2em; display: inline-block;
                  position: relative; z-index: 10; animation: blink 1s infinite;
                `;
                return span;
              }
            })(),
            side: 1
          }).range(p)
        );
      }
    }
    return Decoration.set(decos);
  };

  const cursorField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(decorations, tr) {
      const eff = tr.effects.find((e) => e.is && e.is(updateCursors));
      if (eff) {
        const docLen = tr.state.doc.length;
        return createCursorDecorations(eff.value || [], docLen);
      }
      return decorations.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f)
  });

  // ---------- Language picker ----------
  const getLanguageExtension = useCallback(() => {
    switch (language) {
      case "python": return python();
      case "cpp": return cpp();
      case "java": return java();
      case "csharp": return StreamLanguage.define(csharp);
      case "php": return php();
      case "html": return html();
      case "css": return css();
      case "sql": return StreamLanguage.define(sql);
      case "rust": return rust();
      case "go": return go();
      case "swift": return StreamLanguage.define(swift);
      case "kotlin": return StreamLanguage.define(kotlin);
      default: return javascript();
    }
  }, [language]);

  // ---------- Simple overlap heuristic ----------
  const checkForConflicts = useCallback((currentContent, changes) => {
    return Array.isArray(changes) && changes.some((ch) => ch.from < currentContent.length && ch.to > 0);
  }, []);

  // ---------- Debounced save (10s) ----------
  const debouncedSave = useCallback((newCode) => {
    if (newCode === lastSavedCode.current) return;
    lastSavedCode.current = newCode;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const pos = viewRef.current?.state.selection.main.head ?? 0;
      socket.emit("saveCode", { roomId, code: newCode, cursorPosition: pos, userId });
    }, 10000);
  }, [roomId, userId]);

  // ---------- Apply remote changes (safe selection) ----------
  const applyRemoteChanges = useCallback((changes) => {
    if (!viewRef.current || isLocalChange.current) return;
    if (!Array.isArray(changes) || changes.length === 0) return;

    isRemoteChange.current = true;
    try {
      const view = viewRef.current;
      const sorted = [...changes].sort((a, b) => a.from - b.from);

      // Let CM map selection through the changes; no explicit selection in same dispatch
      view.dispatch({ changes: sorted });

      const newValue = view.state.doc.toString();
      localDocumentState.current = newValue;
      onChange(newValue);
    } catch (e) {
      console.error("Error applying remote changes:", e);
    } finally {
      isRemoteChange.current = false;
    }
  }, [onChange]);

  // ---------- Init once ----------
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    viewRef.current = new EditorView({
      doc: typeof code === "string" ? code : "",
      extensions: [
        minimalSetup,
        themeCompartment.current.of(oneDark),
        languageCompartment.current.of(getLanguageExtension()),
        cursorField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isRemoteChange.current) {
            isLocalChange.current = true;

            const value = update.state.doc.toString();
            localDocumentState.current = value;

            const changes = [];
            update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              changes.push({ from: fromA, to: toA, insert: inserted.toString() });
            });

            if (changes.length) socket.emit("codeChange", { roomId, changes, userId });

            onChange(value);
            debouncedSave(value);

            const cursorPos = update.state.selection.main.head;
            if (cursorPos !== lastCursorPos.current) {
              lastCursorPos.current = cursorPos;
              if (cursorEmitTimeout.current) clearTimeout(cursorEmitTimeout.current);
              cursorEmitTimeout.current = setTimeout(() => {
                socket.emit("cursorChange", { roomId, userId, position: cursorPos });
              }, 50);
            }

            setTimeout(() => { isLocalChange.current = false; }, 10);
          }
        })
      ],
      parent: editorRef.current
    });

    if (!hasJoinedRoom.current) {
      socket.emit("joinRoom", roomId, userId);
      hasJoinedRoom.current = true;
    }

    const handleCodeChange = ({ changes, senderId }) => {
      if (senderId === userId || isLocalChange.current || !changes?.length) return;
      const current = viewRef.current?.state.doc.toString() || "";
      if (checkForConflicts(current, changes)) {
        console.warn("Potential conflict detected; applying anyway.");
      }
      applyRemoteChanges(changes);
    };

    const handleCursorChange = ({ userId: otherUserId, position, color }) => {
      if (otherUserId === userId || !viewRef.current) return;
      viewRef.current.dispatch({ effects: updateCursors.of([{ userId: otherUserId, position, color }]) });
    };

    const handleRoomState = ({ code: roomCode }) => {
      if (!viewRef.current || isLocalChange.current) return;
      const view = viewRef.current;
      const cur = view.state.doc.toString();
      if (roomCode !== cur) {
        isRemoteChange.current = true;

        // 1) apply text change
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: roomCode }
        });

        // 2) clamp and restore selection in a separate dispatch
        const prev = clampPos(view, view.state.selection.main.head);
        view.dispatch({ selection: { anchor: prev, head: prev } });

        localDocumentState.current = roomCode;
        onChange(roomCode);
        isRemoteChange.current = false;
      }
    };

    const handleCodeSaved = ({ userId: savedByUserId, cursorPosition }) => {
      if (savedByUserId !== userId || !viewRef.current) return;
      const view = viewRef.current;
      const safe = clampPos(view, cursorPosition || 0);
      view.dispatch({ selection: { anchor: safe, head: safe } });
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

      if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (cursorEmitTimeout.current) clearTimeout(cursorEmitTimeout.current);
      hasJoinedRoom.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorRef, getLanguageExtension, roomId, userId, onChange, debouncedSave, applyRemoteChanges, checkForConflicts]);

  // external code prop change (no re-create)
  useEffect(() => {
    if (!viewRef.current || isLocalChange.current || isRemoteChange.current) return;
    const view = viewRef.current;
    const current = view.state.doc.toString();
    if (typeof code === "string" && code !== "" && code !== current) {
      isRemoteChange.current = true;

      // 1) apply text change
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code }
      });

      // 2) clamp and restore selection separately
      const prev = clampPos(view, view.state.selection.main.head);
      view.dispatch({ selection: { anchor: prev, head: prev } });

      isRemoteChange.current = false;
    }
  }, [code]);

  // dynamic language reconfig
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({ effects: languageCompartment.current.reconfigure(getLanguageExtension()) });
  }, [getLanguageExtension]);

  return <div className="h-[500px] border rounded" ref={editorRef} />;
}

export default CodeEditor;