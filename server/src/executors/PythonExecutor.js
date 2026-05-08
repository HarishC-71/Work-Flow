const BaseExecutor = require('./BaseExecutor');

class PythonExecutor extends BaseExecutor {
  constructor() {
    super('python');
  }

  getDockerConfig() {
    return {
      image: 'python:3.11-slim',
      cmd: ['python', '/tmp/runner.py'],
      memory: 256 * 1024 * 1024,
      cpuPeriod: 100000,
      cpuQuota: 50000,
    };
  }

  prepare(code, stdin) {
    return code;
  }

  /**
   * Parse raw process stdout into structured snapshots.
   *
   * The tracer writes every snapshot as:
   *   ---SNAPSHOT---{json}\n
   *
   * Anything that is NOT a ---SNAPSHOT--- line is a stray line
   * (e.g. prompt text echoed by patched input()). We ignore those
   * because all terminal output is carried inside stdout_delta fields
   * of the snapshot objects themselves.
   */
  parseSnapshots(stdout, stderr) {
    const snapshots = [];
    const lines = (stdout || '').split('\n');

    for (const line of lines) {
      if (line.startsWith('---SNAPSHOT---')) {
        try {
          const json = line.substring('---SNAPSHOT---'.length).trim();
          if (json) {
            const snapshot = JSON.parse(json);
            // Normalise: ensure stdout_delta always exists
            if (!snapshot.stdout_delta) snapshot.stdout_delta = '';
            if (!snapshot.label) snapshot.label = `Step ${snapshot.step}`;
            snapshots.push(snapshot);
          }
        } catch (e) {
          console.error('Failed to parse snapshot:', e.message, '| raw:', line.slice(0, 120));
        }
      }
      // Stray lines are intentionally ignored – output is in stdout_delta
    }

    // Build the full accumulated stdout from all output-event deltas
    const fullStdout = snapshots
      .filter(s => s.stdout_delta)
      .map(s => s.stdout_delta)
      .join('');

    return { snapshots, stdout: fullStdout };
  }
}

module.exports = PythonExecutor;
