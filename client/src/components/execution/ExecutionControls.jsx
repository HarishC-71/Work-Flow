import { Play, Pause, SkipBack, SkipForward, RotateCcw, Zap, Sliders } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';
import useEditorStore from '../../store/editorStore';
import { executeCode } from '../../services/api';
import { EXECUTION_STATUS, REPLAY_SPEEDS } from '../../utils/constants';
import { motion } from 'framer-motion';

export default function ExecutionControls() {
  const { code, language, stdin } = useEditorStore();
  const { 
    status, 
    snapshots, 
    currentStep, 
    isPlaying, 
    replaySpeed,
    startExecution,
    stopExecution,
    setCurrentStep,
    nextStep,
    prevStep,
    startReplay,
    stopReplay,
    setReplaySpeed,
    reset
  } = useExecutionStore();

  const handleRun = () => {
    startExecution(code, language);
  };

  const handleStop = () => {
    stopExecution();
  };

  const isCompleted = status === EXECUTION_STATUS.COMPLETED;
  const isRunning = status === EXECUTION_STATUS.RUNNING;
  const hasSnapshots = snapshots.length > 0;

  return (
    <div className="h-12 flex items-center justify-between px-4 bg-bg-panel border-b border-border-default z-40">
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-error/20 text-error hover:bg-error/30 transition-all shadow-lg shadow-error/10"
          >
            <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-accent-primary hover:bg-accent-secondary text-white shadow-lg shadow-accent-primary/20 accent-glow transition-all"
          >
            <Zap size={16} fill="currentColor" />
            Run Code
          </button>
        )}

        {hasSnapshots && (
          <div className="h-6 w-px bg-border-default mx-2" />
        )}

        {hasSnapshots && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentStep(0)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="First step"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous step"
            >
              <SkipBack size={18} fill={currentStep === 0 ? "none" : "currentColor"} />
            </button>
            
            <button
              onClick={isPlaying ? stopReplay : startReplay}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-warning/20 text-warning hover:bg-warning/30' 
                  : 'bg-success/20 text-success hover:bg-success/30'
              }`}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
            </button>

            <button
              onClick={nextStep}
              disabled={currentStep === snapshots.length - 1}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next step"
            >
              <SkipForward size={18} fill={currentStep === snapshots.length - 1 ? "none" : "currentColor"} />
            </button>
          </div>
        )}
      </div>

      {hasSnapshots && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-bg-secondary px-3 py-1.5 rounded-lg border border-border-default">
            <Sliders size={14} className="text-text-muted" />
            <select
              value={replaySpeed}
              onChange={(e) => setReplaySpeed(Number(e.target.value))}
              className="bg-transparent text-xs font-medium text-text-secondary focus:outline-none cursor-pointer"
            >
              {REPLAY_SPEEDS.map(speed => (
                <option key={speed.value} value={speed.value}>{speed.label}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-mono text-text-muted bg-bg-secondary px-3 py-1.5 rounded-lg border border-border-default">
            <span className="text-text-primary">{currentStep + 1}</span>
            <span className="mx-1">/</span>
            <span>{snapshots.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
