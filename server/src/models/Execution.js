const mongoose = require('mongoose');

const SnapshotSchema = new mongoose.Schema({
  step: Number,
  line: Number,
  event: String,
  timestamp_ms: Number,
  variables: Object,
  stack: Array,
  heap: Array,
  stdout_delta: String,
  stderr_delta: String,
  exception: Object
}, { _id: false });

const ExecutionSchema = new mongoose.Schema({
  executionId: { type: String, required: true, unique: true },
  language: { type: String, required: true },
  code: { type: String, required: true },
  stdin: String,
  status: { 
    type: String, 
    enum: ['queued', 'running', 'completed', 'error', 'timeout'],
    default: 'queued'
  },
  snapshots: [SnapshotSchema],
  output: {
    stdout: { type: String, default: '' },
    stderr: { type: String, default: '' },
    exitCode: Number
  },
  error: {
    type: { type: String },
    message: String
  },
  metadata: {
    executionTimeMs: Number,
    snapshotCount: Number
  },
  expiresAt: { type: Date, expires: '1h', default: Date.now } // TTL index
}, { timestamps: true });

module.exports = mongoose.model('Execution', ExecutionSchema);
