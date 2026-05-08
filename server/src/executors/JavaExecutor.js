const BaseExecutor = require('./BaseExecutor');

class JavaExecutor extends BaseExecutor {
  constructor() {
    super('java');
  }

  getDockerConfig() {
    return {
      image: 'eclipse-temurin:17-jdk',
      // Note: The execution service should handle filename detection.
      // If using Docker, ensure the code is saved as the correct class name.
      cmd: ['sh', '-c', 'javac -g /tmp/*.java && java -cp /tmp --add-modules jdk.jdi Tracer Main'],
      memory: 512 * 1024 * 1024,
      cpuPeriod: 100000,
      cpuQuota: 50000,
    };
  }

  prepare(code, stdin) {
    return code;
  }

  /**
   * Parse Java snapshots.
   * Same logic as Python: all output is inside stdout_delta fields.
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
            if (!snapshot.stdout_delta) snapshot.stdout_delta = '';
            
            // Normalize Java types for the frontend color map
            if (snapshot.variables) {
                for (const key in snapshot.variables) {
                    const v = snapshot.variables[key];
                    if (v.type === 'java.lang.String') v.type = 'String';
                    if (v.type === 'int') v.type = 'int';
                    // etc.
                }
            }

            snapshots.push(snapshot);
          }
        } catch (e) {
          console.error('Failed to parse Java snapshot:', e.message);
        }
      }
    }

    const fullStdout = snapshots
      .filter(s => s.stdout_delta)
      .map(s => s.stdout_delta)
      .join('');

    return { snapshots, stdout: fullStdout };
  }
}

module.exports = JavaExecutor;
