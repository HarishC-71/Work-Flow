import { motion, AnimatePresence } from 'framer-motion';
import { Box, Hash, Type, ToggleLeft, List, Braces } from 'lucide-react';
import useExecutionStore from '../../store/executionStore';
import { formatValue, getTypeColor } from '../../utils/formatters';

function TypeIcon({ type }) {
  if (type === 'int' || type === 'float' || type === 'double') return <Hash size={11} />;
  if (type === 'str' || type === 'string' || type === 'String') return <Type size={11} />;
  if (type === 'bool' || type === 'boolean')                   return <ToggleLeft size={11} />;
  if (type === 'list' || type === 'tuple' || type?.endsWith('[]')) return <List size={11} />;
  if (type === 'dict' || type === 'HashMap' || type === 'set') return <Braces size={11} />;
  return <Box size={11} />;
}

export default function VariableInspector() {
  const { snapshots, currentStep } = useExecutionStore();
  const snapshot = snapshots[currentStep];

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8 opacity-50">
        <Box size={40} className="mb-4" />
        <p className="text-sm">No snapshot at this step</p>
      </div>
    );
  }

  const variables = snapshot.variables ? Object.values(snapshot.variables) : [];

  if (variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8 opacity-50">
        <Box size={40} className="mb-4" />
        <p className="text-sm">No variables in scope</p>
      </div>
    );
  }

  return (
    <div className="p-3 overflow-x-hidden">
      <table className="w-full text-left border-separate border-spacing-y-1.5">
        <thead>
          <tr className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            <th className="px-3 pb-1">Name</th>
            <th className="px-3 pb-1 text-center">Type</th>
            <th className="px-3 pb-1 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {variables.map((v) => (
              <motion.tr
                layout
                key={v.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  // Flash yellow when value changed
                  backgroundColor: v.changed
                    ? ['rgba(234,179,8,0.15)', 'rgba(234,179,8,0.05)']
                    : 'rgba(0,0,0,0)',
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={`group transition-all ${
                  v.changed ? 'ring-1 ring-yellow-500/30' : ''
                }`}
              >
                {/* Name */}
                <td className="px-3 py-2.5 rounded-l-lg border-y border-l border-border-default bg-bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded bg-bg-tertiary ${getTypeColor(v.type)}`}>
                      <TypeIcon type={v.type} />
                    </div>
                    <span className="text-sm font-mono font-semibold text-text-primary">
                      {v.name}
                    </span>
                    {v.changed && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-[8px] px-1 bg-yellow-500 text-bg-primary rounded font-bold uppercase"
                      >
                        changed
                      </motion.span>
                    )}
                  </div>
                </td>

                {/* Type */}
                <td className="px-3 py-2.5 border-y border-border-default text-center bg-bg-secondary/30">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary ${getTypeColor(v.type)}`}>
                    {v.type}
                  </span>
                </td>

                {/* Value – no truncation, wraps naturally */}
                <td className="px-3 py-2.5 rounded-r-lg border-y border-r border-border-default text-right bg-bg-secondary/30">
                  <span
                    className={`text-xs font-mono font-medium break-all ${
                      v.changed ? 'text-yellow-400' : 'text-text-secondary'
                    }`}
                  >
                    {formatValue(v.value, v.type)}
                  </span>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
