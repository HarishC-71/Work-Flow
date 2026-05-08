import { useRef, useEffect } from 'react';
import { Search, Clock, ChevronRight, Terminal, ArrowDownCircle, ArrowUpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';
import { getEventColor, getEventIcon } from '../../utils/formatters';

export default function TracePanel() {
  const { snapshots, currentStep, setCurrentStep } = useExecutionStore();
  const activeRef = useRef(null);

  // Auto-scroll to the active step
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentStep]);

  if (!snapshots || snapshots.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border-default bg-bg-secondary/30">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search trace events…"
            className="w-full bg-bg-tertiary border border-border-default rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:border-accent-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {snapshots.map((step, idx) => (
          <button
            key={idx}
            ref={idx === currentStep ? activeRef : null}
            onClick={() => setCurrentStep(idx)}
            className={`w-full text-left px-4 py-3 border-b border-border-default/30 transition-all flex items-start gap-3 ${
              idx === currentStep
                ? 'bg-accent-primary/8 border-l-4 border-l-accent-primary'
                : 'hover:bg-bg-hover border-l-4 border-l-transparent'
            }`}
          >
            {/* Step index */}
            <div className="flex flex-col items-center gap-1 min-w-[28px] pt-0.5">
              <span className={`text-[10px] font-bold ${idx === currentStep ? 'text-accent-primary' : 'text-text-muted'}`}>
                #{idx + 1}
              </span>
              {idx < snapshots.length - 1 && (
                <div className="w-0.5 h-3 bg-border-default rounded-full" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${getEventColor(step.event)}`}>
                  {step.event}
                </span>
                {step.line && (
                  <span className="text-[10px] text-text-muted font-mono">
                    line {step.line}
                  </span>
                )}
                <span className="text-[10px] text-text-muted flex items-center gap-1 ml-auto">
                  <Clock size={9} />
                  {typeof step.timestamp_ms === 'number' ? step.timestamp_ms.toFixed(1) : '?'}ms
                </span>
              </div>

              {/* Human-readable label */}
              <p className="text-xs font-mono text-text-secondary break-words whitespace-normal leading-relaxed">
                {step.label || describeStep(step)}
              </p>

              {/* Show stdout_delta preview inline */}
              {step.stdout_delta && (
                <p className="mt-1 text-[10px] font-mono text-cyan-400 truncate">
                  ▶ {step.stdout_delta.trim()}
                </p>
              )}
              {/* Show stdin value inline */}
              {step.stdin_value !== undefined && (
                <p className="mt-1 text-[10px] font-mono text-yellow-400 truncate">
                  ← "{step.stdin_value}"
                </p>
              )}
            </div>

            <ChevronRight
              size={13}
              className={`text-text-muted mt-0.5 flex-shrink-0 transition-transform ${idx === currentStep ? 'rotate-90 text-accent-primary' : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Fallback description if the snapshot has no `label` field (old format). */
function describeStep(step) {
  switch (step.event) {
    case 'line':          return `Execute line ${step.line}`;
    case 'call':          return `Enter ${step.stack?.[step.stack.length - 1]?.function ?? 'function'}()`;
    case 'return':        return 'Return from function';
    case 'output':        return `Output → ${(step.stdout_delta || '').trim()}`;
    case 'input_waiting': return 'Program waiting for input…';
    case 'input_received':return `Input received → "${step.stdin_value ?? ''}"`;
    case 'program_end':   return 'Program finished';
    case 'exception':     return `Exception: ${step.exception?.type ?? 'Error'}`;
    default:              return `Event: ${step.event}`;
  }
}
