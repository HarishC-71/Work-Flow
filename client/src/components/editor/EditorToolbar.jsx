import { motion } from 'framer-motion';
import { FileCode, Download, Upload, Copy, RotateCcw, Terminal } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import useEditorStore from '../../store/editorStore';
import useUIStore from '../../store/uiStore';
import { LANGUAGES } from '../../utils/constants';

export default function EditorToolbar() {
  const { language, code, setCode } = useEditorStore();
  const { showStdin, toggleStdin } = useUIStore();
  const langConfig = LANGUAGES[language];

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
  };

  const handleReset = () => {
    setCode(langConfig.defaultCode);
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary/50">
      <div className="flex items-center gap-2">
        <FileCode size={14} className="text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Editor
        </span>
        <LanguageSelector />
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          title="Copy code"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          title="Reset to default"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
