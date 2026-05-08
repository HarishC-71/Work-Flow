import { useCallback, useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import useEditorStore from '../../store/editorStore';
import useExecutionStore from '../../store/executionStore';
import { LANGUAGES, EXECUTION_STATUS } from '../../utils/constants';

export default function CodeEditor() {
  const { language, code, setCode } = useEditorStore();
  const { status, snapshots, currentStep } = useExecutionStore();
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);
  const containerRef = useRef(null);
  const [editorHeight, setEditorHeight] = useState('100%');

  const langConfig = LANGUAGES[language];

  // Use ResizeObserver to give Monaco an explicit pixel height
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setEditorHeight(`${h}px`);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      lineHeight: 22,
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true },
      folding: true,
      wordWrap: 'on',
      automaticLayout: true,
    });

    // Custom theme overrides
    monaco.editor.defineTheme('codeflow-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#111827',
        'editor.lineHighlightBackground': '#1e293b',
        'editorLineNumber.foreground': '#374151',
        'editorLineNumber.activeForeground': '#6366f1',
      },
    });
    monaco.editor.setTheme('codeflow-dark');
  }, []);

  // Highlight current executing line
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (status === EXECUTION_STATUS.COMPLETED && snapshots.length > 0) {
      const snapshot = snapshots[currentStep];
      // Only highlight if line is a positive integer (skip line 0 = module call, null = program_end)
      if (snapshot && snapshot.line && snapshot.line > 0) {
        const newDecorations = [
          {
            range: {
              startLineNumber: snapshot.line,
              startColumn: 1,
              endLineNumber: snapshot.line,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: 'line-highlight',
              glyphMarginClassName: 'line-highlight-glyph',
              overviewRuler: {
                color: '#6366f1',
                position: 1,
              },
            },
          },
        ];

        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          newDecorations
        );

        editor.revealLineInCenter(snapshot.line);
      }
    } else {
      if (decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          []
        );
      }
    }
  }, [currentStep, snapshots, status]);

  return (
    <div ref={containerRef} className="h-full relative" style={{ minHeight: 0 }}>
      <Editor
        height={editorHeight}
        language={langConfig.monacoId}
        value={code}
        onChange={(value) => setCode(value || '')}
        onMount={handleEditorMount}
        theme="vs-dark"
        loading={
          <div className="h-full flex items-center justify-center bg-bg-secondary">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full"
            />
          </div>
        }
        options={{
          readOnly: status === EXECUTION_STATUS.RUNNING,
          automaticLayout: true,
        }}
      />

      {/* Line number indicator overlay */}
      {status === EXECUTION_STATUS.COMPLETED && snapshots.length > 0 && (
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-2 right-2 px-2 py-1 rounded-md bg-accent-primary/20 border border-accent-primary/30 text-accent-primary text-xs font-mono max-w-[200px] truncate"
        >
          {snapshots[currentStep]?.line > 0 ? `Line ${snapshots[currentStep].line}` : '—'}
          {' · '}
          {snapshots[currentStep]?.event || ''}
        </motion.div>
      )}
    </div>
  );
}
