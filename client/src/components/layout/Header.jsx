import { motion } from 'framer-motion';
import { 
  Code2, Zap, Activity, Settings, BookOpen, Globe, 
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import useUIStore from '../../store/uiStore';
import useEditorStore from '../../store/editorStore';
import useExecutionStore from '../../store/executionStore';
import { LANGUAGES, EXECUTION_STATUS } from '../../utils/constants';

export default function Header() {
  const { language } = useEditorStore();
  const { status, snapshots, currentStep } = useExecutionStore();
  const langConfig = LANGUAGES[language];

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border-default bg-bg-secondary/80 backdrop-blur-md z-50 shrink-0">
      {/* Left: Logo & Brand */}
      <div className="flex items-center gap-3">
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-gradient-from to-accent-gradient-to flex items-center justify-center shadow-lg shadow-accent-primary/20">
            <Code2 size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold gradient-text leading-tight">
              CodeFlow
            </h1>
            <span className="text-[10px] text-text-muted leading-none">
              Workflow Visualizer
            </span>
          </div>
        </motion.div>
      </div>

      {/* Center: Status indicator */}
      <div className="flex items-center gap-4">
        {/* Language badge */}
        <div 
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
          style={{ 
            borderColor: langConfig.color + '40',
            background: langConfig.color + '15',
            color: langConfig.color,
          }}
        >
          <span>{langConfig.icon}</span>
          <span>{langConfig.name}</span>
        </div>

        {/* Execution status */}
        {status !== EXECUTION_STATUS.IDLE && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium"
          >
            {status === EXECUTION_STATUS.RUNNING && (
              <>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400">Executing...</span>
              </>
            )}
            {status === EXECUTION_STATUS.COMPLETED && (
              <>
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-success">
                  {snapshots.length} steps · Step {currentStep + 1}
                </span>
              </>
            )}
            {status === EXECUTION_STATUS.ERROR && (
              <>
                <div className="w-2 h-2 rounded-full bg-error" />
                <span className="text-error">Error</span>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="View on GitHub"
        >
          <Globe size={16} />
        </a>
        <button
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title="Documentation"
        >
          <BookOpen size={16} />
        </button>
      </div>
    </header>
  );
}
