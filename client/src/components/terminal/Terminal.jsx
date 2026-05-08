import { useRef, useEffect, useState } from 'react';
import { Terminal as TerminalIcon, XCircle, CheckCircle2, Info, Clock } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';
import { EXECUTION_STATUS } from '../../utils/constants';

export default function Terminal() {
  const { 
    status, 
    output, 
    currentStep, 
    snapshots, 
    isWaitingForInput, 
    sendInput,
    isStreaming 
  } = useExecutionStore();
  
  const [inputValue, setInputValue] = useState('');
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  // Accumulate terminal content up to the current step
  const getTerminalContent = () => {
    const limit = isStreaming ? snapshots.length - 1 : currentStep;
    let content = [];
    
    for (let i = 0; i <= limit && i < snapshots.length; i++) {
      const snap = snapshots[i];
      if (snap.stdout_delta) {
        content.push({ type: 'stdout', text: snap.stdout_delta });
      }
      if (snap.event === 'stdin' && snap.stdin_value) {
        content.push({ type: 'stdin', text: snap.stdin_value });
      }
    }
    return content;
  };

  const terminalContent = getTerminalContent();

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalContent, isWaitingForInput]);

  // Focus input when waiting
  useEffect(() => {
    if (isWaitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingForInput]);

  const handleSubmit = (e) => {
    if (e.key === 'Enter') {
      sendInput(inputValue);
      setInputValue('');
    }
  };

  // Helper to render content without extra spacing
  const renderContent = () => {
    return terminalContent.map((item, idx) => (
      <span 
        key={idx} 
        className={item.type === 'stdin' ? 'text-accent-primary font-bold' : 'text-text-primary'}
      >
        {item.text}
      </span>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary font-mono text-[13px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-text-muted" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Console
          </span>
        </div>

        <div className="flex items-center gap-3">
          {status === EXECUTION_STATUS.COMPLETED && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-success">
              <CheckCircle2 size={12} />
              Exited: {output.exitCode ?? 0}
            </div>
          )}
          {status === EXECUTION_STATUS.RUNNING && (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-warning animate-pulse">
              <Clock size={12} />
              {isWaitingForInput ? 'INPUT REQUIRED' : 'RUNNING'}
            </div>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={outputRef}
        className="flex-1 p-4 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-all leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {terminalContent.length === 0 && status === EXECUTION_STATUS.IDLE ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted opacity-20 gap-2">
            <TerminalIcon size={32} />
            <span className="text-sm">Interactive console ready</span>
          </div>
        ) : (
          <div className="relative">
            {renderContent()}
            
            {/* Inline Input */}
            {isWaitingForInput && isStreaming && (
              <span className="inline-flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleSubmit}
                  className="bg-transparent border-none outline-none text-accent-primary font-bold caret-accent-primary p-0 m-0 w-[20ch] max-w-full"
                  autoFocus
                />
                <span className="w-2 h-4 bg-accent-primary animate-pulse ml-0.5" />
              </span>
            )}
          </div>
        )}

        {/* Stderr */}
        {output.stderr && (
          <div className="text-error mt-2 opacity-90 border-l-2 border-error/30 pl-2">
            {output.stderr}
          </div>
        )}
        
        {/* Error */}
        {status === EXECUTION_STATUS.ERROR && (
          <div className="text-error mt-2 font-bold flex items-center gap-2">
            <XCircle size={14} />
            Execution Error
          </div>
        )}
      </div>
    </div>
  );
}
