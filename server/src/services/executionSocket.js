const dockerService = require('./dockerService');
const PythonExecutor = require('../executors/PythonExecutor');
const JavaExecutor = require('../executors/JavaExecutor');

const executors = {
  python: new PythonExecutor(),
  java: new JavaExecutor(),
};

module.exports = (io) => {
  io.on('connection', (socket) => {
    let activeProcess = null;
    let activeCleanup = null;
    let stdoutBuffer = '';
    let stepCounter = 0;
    let lastSnapshot = null;

    const emitVirtualSnapshot = (event, data) => {
      // Create a snapshot that carries only the output/input change
      // but preserves the last known state (line, variables, stack)
      const virtual = {
        ...(lastSnapshot || {}),
        step: stepCounter++,
        event: event,
        timestamp_ms: Date.now(), // approximation
        stdout_delta: event === 'stdout' ? data : '',
        stdin_value: event === 'stdin' ? data : undefined,
        // Ensure it doesn't look like a line change if it's just output
        isVirtual: true 
      };
      socket.emit('snapshot', virtual);
    };

    socket.on('execute', async (data) => {
      const { code, language } = data;
      if (activeProcess && activeCleanup) activeCleanup();

      const executor = executors[language];
      if (!executor) return socket.emit('error', { message: `Unsupported language: ${language}` });

      stdoutBuffer = '';
      stepCounter = 0;
      lastSnapshot = null;

      try {
        const { child, cleanup } = await dockerService.startProcess(executor, code);
        activeProcess = child;
        activeCleanup = cleanup;

        child.stdout.on('data', (data) => {
          stdoutBuffer += data.toString();
          let lineEndIndex;
          while ((lineEndIndex = stdoutBuffer.indexOf('\n')) !== -1) {
            const line = stdoutBuffer.substring(0, lineEndIndex).trim();
            stdoutBuffer = stdoutBuffer.substring(lineEndIndex + 1);

            if (line.startsWith('---SNAPSHOT---')) {
              try {
                const snapshotJson = line.substring('---SNAPSHOT---'.length).trim();
                if (snapshotJson) {
                  const snapshot = JSON.parse(snapshotJson);
                  lastSnapshot = snapshot;
                  stepCounter = snapshot.step + 1;
                  socket.emit('snapshot', snapshot);
                }
              } catch (e) {
                console.error('Snapshot parse error:', e);
              }
            } else if (line) {
              // Raw output -> turn into a virtual snapshot for synchronization
              emitVirtualSnapshot('stdout', line + '\n');
            }
          }
        });

        child.stderr.on('data', (data) => {
          // You could also emit a virtual snapshot for stderr
          socket.emit('stderr', data.toString());
        });

        child.on('close', (code) => {
          // Flush remaining buffer - might contain multiple snapshots
          if (stdoutBuffer.trim()) {
            const lines = stdoutBuffer.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('---SNAPSHOT---')) {
                try {
                  const snapshotJson = trimmed.substring('---SNAPSHOT---'.length).trim();
                  socket.emit('snapshot', JSON.parse(snapshotJson));
                } catch(e) {}
              } else {
                socket.emit('stdout', trimmed + '\n');
              }
            }
          }
          socket.emit('exit', { exitCode: code });
          activeProcess = null;
          activeCleanup = null;
          stdoutBuffer = '';
        });

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('stdin', (data) => {
      if (activeProcess && activeProcess.stdin && activeProcess.stdin.writable) {
        // Create a virtual snapshot for the input itself
        emitVirtualSnapshot('stdin', data + '\n');
        activeProcess.stdin.write(data + '\n');
      }
    });

    socket.on('stop', () => {
      if (activeCleanup) activeCleanup();
    });

    socket.on('disconnect', () => {
      if (activeCleanup) activeCleanup();
    });
  });
};
