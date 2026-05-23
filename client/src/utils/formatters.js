/**
 * Format a variable value for display in the inspector.
 * Shows the full value – no truncation – so users see everything.
 */
export function formatValue(value, type) {
  if (value === null || value === undefined) return 'null';
  if (type === 'str' || type === 'string' || typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return `[${value.map((v) => formatValue(v)).join(', ')}]`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Get a Tailwind color class for a variable type.
 */
export function getTypeColor(type) {
  const typeColors = {
    int:      'text-blue-400',
    float:    'text-cyan-400',
    double:   'text-cyan-400',
    str:      'text-green-400',
    string:   'text-green-400',
    String:   'text-green-400',
    bool:     'text-yellow-400',
    boolean:  'text-yellow-400',
    list:     'text-purple-400',
    tuple:    'text-violet-400',
    dict:     'text-orange-400',
    set:      'text-rose-400',
    'int[]':  'text-purple-400',
    HashMap:  'text-orange-400',
    NoneType: 'text-gray-500',
    null:     'text-gray-500',
  };
  return typeColors[type] || 'text-slate-400';
}

/**
 * Format execution time nicely.
 */
export function formatTime(ms) {
  if (ms < 1)    return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Get event type badge color class.
 */
export function getEventColor(event) {
  const colors = {
    line:           'bg-blue-500/20 text-blue-400',
    call:           'bg-green-500/20 text-green-400',
    return:         'bg-purple-500/20 text-purple-400',
    exception:      'bg-red-500/20 text-red-400',
    input_waiting:  'bg-yellow-500/20 text-yellow-400',
    input_received: 'bg-amber-500/20 text-amber-400',
    stdin:          'bg-amber-500/20 text-amber-400',
    output:         'bg-cyan-500/20 text-cyan-400',
    program_end:    'bg-emerald-500/20 text-emerald-400',
    // Legacy Java event names
    input:          'bg-yellow-500/20 text-yellow-400',
  };
  return colors[event] || 'bg-slate-500/20 text-slate-400';
}

/**
 * Get a human-readable icon string for an event type.
 */
export function getEventIcon(event) {
  const icons = {
    line:           '→',
    call:           '▶',
    return:         '◀',
    exception:      '✕',
    input_waiting:  '⌛',
    input_received: '⌨',
    stdin:          '⌨',
    output:         '▷',
    program_end:    '✓',
    input:          '⌨',
  };
  return icons[event] || '•';
}
