import useExecutionStore from '../../store/executionStore';
import { getEventColor } from '../../utils/formatters';

export default function StepTimeline() {
  const { snapshots, currentStep, setCurrentStep } = useExecutionStore();

  if (!snapshots || snapshots.length === 0) return null;

  const current = snapshots[currentStep];
  const progress = snapshots.length > 1
    ? (currentStep / (snapshots.length - 1)) * 100
    : 100;

  return (
    <div className="px-4 py-3 border-b border-border-default bg-bg-secondary/30 flex-shrink-0">
      {/* Slider row */}
      <div className="relative h-6 flex items-center group">
        {/* Track background */}
        <div className="absolute w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-primary transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Tick markers (≤ 60 steps) */}
        {snapshots.length <= 60 && snapshots.map((_, idx) => (
          <div
            key={idx}
            className={`absolute w-1 h-1 rounded-full transition-colors pointer-events-none ${
              idx <= currentStep ? 'bg-white/40' : 'bg-white/10'
            }`}
            style={{
              left: `${snapshots.length > 1 ? (idx / (snapshots.length - 1)) * 100 : 0}%`,
              transform: 'translateX(-50%)',
            }}
          />
        ))}

        {/* Native range input (invisible, for interaction) */}
        <input
          type="range"
          min="0"
          max={snapshots.length - 1}
          value={currentStep}
          onChange={(e) => setCurrentStep(parseInt(e.target.value, 10))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
        />

        {/* Thumb */}
        <div
          className="absolute w-4 h-4 bg-white rounded-full shadow-lg border-2 border-accent-primary transition-all duration-200 pointer-events-none"
          style={{
            left: `${progress}%`,
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Step info row */}
      <div className="flex items-center justify-between mt-2 px-0.5">
        <span className="text-[10px] text-text-muted font-medium uppercase tracking-tighter">
          Start
        </span>

        {/* Centre: event badge + label */}
        <div className="flex items-center gap-2 max-w-[60%] overflow-hidden">
          <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${getEventColor(current?.event)}`}>
            {current?.event ?? 'step'}
          </span>
          {current?.line && (
            <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
              L{current.line}
            </span>
          )}
          <span className="text-[10px] text-text-secondary font-mono truncate">
            {current?.label ?? ''}
          </span>
        </div>

        <span className="text-[10px] text-text-muted font-medium uppercase tracking-tighter">
          End
        </span>
      </div>
    </div>
  );
}
