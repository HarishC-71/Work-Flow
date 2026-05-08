import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';

export default function StackVisualizer() {
  const { snapshots, currentStep } = useExecutionStore();
  const snapshot = snapshots[currentStep];
  
  if (!snapshot || !snapshot.stack) return null;

  const stack = [...snapshot.stack].reverse(); // Most recent on top

  if (stack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8 opacity-50">
        <Layers size={40} className="mb-4" />
        <p className="text-sm">Empty call stack</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-3 overflow-y-auto">
      <AnimatePresence mode="popLayout">
        {stack.map((frame, idx) => (
          <motion.div
            layout
            key={`${frame.function}-${stack.length - idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              idx === 0 
                ? 'bg-accent-primary/10 border-accent-primary shadow-lg shadow-accent-primary/10' 
                : 'bg-bg-panel border-border-default opacity-60'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                  {idx === 0 ? 'Active Frame' : 'Parent Frame'}
                </span>
                <span className={`text-base font-mono font-bold ${idx === 0 ? 'text-accent-primary' : 'text-text-primary'}`}>
                  {frame.function}()
                </span>
              </div>
              <div className="px-2 py-1 bg-bg-tertiary rounded text-[10px] font-mono text-text-secondary border border-border-default">
                Line {frame.line}
              </div>
            </div>

            {frame.locals && Object.keys(frame.locals).length > 0 && (
              <div className="mt-3 pt-3 border-t border-border-default/50">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(frame.locals).map(([name, val]) => (
                    <div key={name} className="px-2 py-1 bg-bg-secondary rounded text-[10px] font-mono border border-border-default">
                      <span className="text-text-muted">{name}=</span>
                      <span className="text-text-secondary">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Depth indicator */}
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-bg-secondary border border-border-default flex items-center justify-center text-[10px] font-bold text-text-muted shadow-sm">
              {stack.length - idx}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
