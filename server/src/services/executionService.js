const { v4: uuidv4 } = require('uuid');
// Mongoose import kept but we won't strictly rely on it if it fails
const Execution = require('../models/Execution');
const PythonExecutor = require('../executors/PythonExecutor');
const JavaExecutor = require('../executors/JavaExecutor');
const dockerService = require('./dockerService'); // now runs locally

const executors = {
  python: new PythonExecutor(),
  java: new JavaExecutor(),
};

// In-memory fallback map
const memoryExecutions = new Map();

class ExecutionService {
  async execute(language, code, stdin) {
    const executor = executors[language];
    if (!executor) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const executionId = `exec-${uuidv4()}`;
    const startTime = Date.now();

    const executionData = {
      executionId,
      language,
      code,
      stdin,
      status: 'running',
      snapshots: [],
      output: { stdout: '', stderr: '', exitCode: null },
      metadata: null,
      error: null
    };

    memoryExecutions.set(executionId, executionData);

    try {
      const result = await dockerService.runContainer(executor, code, stdin);
      const parsed = executor.parseSnapshots(result.stdout, result.stderr);

      executionData.status = 'completed';
      executionData.snapshots = parsed.snapshots;
      executionData.output = {
        stdout: parsed.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      };
      executionData.metadata = {
        executionTimeMs: Date.now() - startTime,
        snapshotCount: parsed.snapshots.length
      };

      return executionData;

    } catch (error) {
      executionData.status = error.message.includes('timeout') ? 'timeout' : 'error';
      executionData.error = {
        type: error.name,
        message: error.message
      };
      return executionData;
    }
  }

  async getExecution(executionId) {
    return memoryExecutions.get(executionId) || null;
  }
}

module.exports = new ExecutionService();
