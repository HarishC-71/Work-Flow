const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const executionRoutes = require('./routes/execution');
const healthRoutes = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');
const setupExecutionSocket = require('./services/executionSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/execute', executionRoutes);
app.use('/api/v1/health', healthRoutes);

// Error Handling
app.use(errorHandler);

// WebSocket Setup
setupExecutionSocket(io);

// Database Connection
mongoose.connect(config.mongodbUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log('MongoDB not available. Executions will be stored in memory.'));

// Start Server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
