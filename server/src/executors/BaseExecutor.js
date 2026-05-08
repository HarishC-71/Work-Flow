/**
 * Abstract Base Class for language-specific executors
 */
class BaseExecutor {
  constructor(language, config = {}) {
    this.language = language;
    this.config = config;
  }

  /**
   * Prepares the code for execution (e.g. instrumentation)
   * @param {string} code 
   * @param {string} stdin 
   * @returns {string}
   */
  prepare(code, stdin) {
    throw new Error('Method prepare() must be implemented');
  }

  /**
   * Returns language specific config for Docker
   */
  getDockerConfig() {
    throw new Error('Method getDockerConfig() must be implemented');
  }

  /**
   * Parses raw tracer output into unified snapshots
   * @param {string} stdout 
   * @param {string} stderr 
   * @returns {Array} Snapshots
   */
  parseSnapshots(stdout, stderr) {
    throw new Error('Method parseSnapshots() must be implemented');
  }
}

module.exports = BaseExecutor;
