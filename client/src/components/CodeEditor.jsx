import React, { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';

function CodeEditor({ code, onChange, language = 'javascript' }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  const getLanguageExtension = useCallback(() => {
    switch (language) {
      case 'python':
        return python();
      case 'cpp':
        return cpp();
      default:
        return javascript();
    }
  }, [language]);

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
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString();
            onChange(value);
          }
        }),
      ],
      parent: editorRef.current,
    });

    return () => {
      if (viewRef.current) viewRef.current.destroy();
    };
  }, [code, onChange, getLanguageExtension]);

  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== code) {
        const cursorPos = viewRef.current.state.selection.main.head;
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: code },
          selection: { anchor: cursorPos },
        });
      }
    }
  }, [code]);

  return <div className="h-[500px] border rounded" ref={editorRef}></div>;
}

export default CodeEditor;
