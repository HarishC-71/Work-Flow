import { motion } from 'framer-motion';
import { Database, Share2 } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';

export default function MemoryVisualizer() {
  const { snapshots, currentStep } = useExecutionStore();
  const snapshot = snapshots[currentStep];
  
  if (!snapshot) return null;

  const heap = snapshot.heap || [];

  if (heap.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8 opacity-50">
        <Database size={40} className="mb-4" />
        <p className="text-sm">No heap objects allocated</p>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
      {heap.map((obj) => (
        <motion.div
          key={obj.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-xl border border-border-default bg-bg-panel hover:border-accent-primary/50 transition-colors"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-mono text-text-muted px-2 py-0.5 bg-bg-tertiary rounded">
              {obj.id}
            </span>
            <span className="text-xs font-bold text-accent-primary uppercase tracking-tighter">
              {obj.type}
            </span>
          </div>

          <div className="bg-bg-secondary rounded-lg p-3 font-mono text-xs text-text-secondary border border-border-default/50">
            {Array.isArray(obj.value) ? (
              <div className="flex flex-wrap gap-1">
                <span className="text-text-muted">[</span>
                {obj.value.map((v, i) => (
                  <span key={i}>
                    {JSON.stringify(v)}
                    {i < obj.value.length - 1 ? <span className="text-text-muted">, </span> : null}
                  </span>
                ))}
                <span className="text-text-muted">]</span>
              </div>
            ) : typeof obj.value === 'object' ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(obj.value, null, 2)}</pre>
            ) : (
              <span>{String(obj.value)}</span>
            )}
          </div>

          {obj.references && obj.references.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-default/30 flex items-center gap-2">
              <Share2 size={12} className="text-text-muted" />
              <div className="flex gap-1.5">
                {obj.references.map(ref => (
                  <span key={ref} className="text-[10px] font-mono text-accent-secondary bg-accent-secondary/10 px-1.5 py-0.5 rounded">
                    → {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
