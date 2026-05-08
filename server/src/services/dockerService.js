const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');

class LocalExecutionService {
  /**
   * Starts a code execution process and returns a handle for streaming.
   *
   * @param {Object} executor
   * @param {string} code
   * @returns {Object} { child, tmpDir, cleanup }
   */
  async startProcess(executor, code) {
    const containerId = `codeflow-${uuidv4()}`;
    const tmpDir = path.resolve(__dirname, `../../../tmp/${containerId}`);

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    let codeFileName, tracerFileName, tracerSrcPath, spawnCmd, spawnArgs;

    if (executor.language === 'python') {
      tracerSrcPath = path.resolve(__dirname, '../../../sandbox/python/tracer.py');
      codeFileName  = 'user_code.py';
      tracerFileName = 'runner.py';
      spawnCmd  = 'python';
      spawnArgs = ['runner.py'];
    } else if (executor.language === 'java') {
      tracerSrcPath  = path.resolve(__dirname, '../../../sandbox/java/Tracer.java');
      
      // Extract class name (prefer public class, but fallback to any class)
      const publicClassMatch = code.match(/public\s+class\s+([a-zA-Z_$][a-zA-Z\d_$]*)/);
      const anyClassMatch = code.match(/class\s+([a-zA-Z_$][a-zA-Z\d_$]*)/);
      const className = (publicClassMatch ? publicClassMatch[1] : (anyClassMatch ? anyClassMatch[1] : 'Main'));
      
      codeFileName   = `${className}.java`;
      tracerFileName = 'Tracer.java';
      spawnCmd  = 'java';
      spawnArgs = ['--add-modules', 'jdk.jdi', 'Tracer', className];
    } else {
      throw new Error(`Unsupported language: ${executor.language}`);
    }

    fs.writeFileSync(path.join(tmpDir, codeFileName),   code);
    fs.writeFileSync(path.join(tmpDir, tracerFileName), fs.readFileSync(tracerSrcPath));

    if (executor.language === 'java') {
      const { spawnSync } = require('child_process');
      const javac = spawnSync('javac', ['-g', codeFileName, tracerFileName], { cwd: tmpDir });
      
      if (javac.status !== 0) {
        const errorMsg = javac.stderr.toString() || javac.stdout.toString() || 'Compilation failed';
        // Cleanup if we failed
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(_) {}
        throw new Error(`Java Compilation Error:\n${errorMsg}`);
      }
    }

    const child = spawn(spawnCmd, spawnArgs, {
      cwd:   tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });

    const cleanup = () => {
      try {
        if (!child.killed) child.kill('SIGKILL');
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    };

    return { child, tmpDir, cleanup };
  }

  /**
   * Legacy batch execution method (kept for compatibility)
   */
  async runContainer(executor, code, stdin) {
    const { child, cleanup } = await this.startProcess(executor, code);
    
    return new Promise((resolve, reject) => {
      let stdoutBuf = '';
      let stderrBuf = '';

      child.stdout.on('data', (chunk) => { stdoutBuf += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });

      if (stdin && child.stdin) {
        child.stdin.write(stdin.endsWith('\n') ? stdin : stdin + '\n');
      }
      child.stdin.end();

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Execution timed out'));
      }, 15_000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        cleanup();
        resolve({
          stdout:   stdoutBuf,
          stderr:   stderrBuf,
          exitCode: code ?? 1,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    });
  }
}

module.exports = new LocalExecutionService();
