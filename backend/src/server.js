/* eslint-env node */
/* eslint-disable no-undef */

const express = require('express');
const cors = require('cors');
const path = require('path');
const winston = require('winston');

// Check if we're in production environment
const isProduction = process.env.NODE_ENV === 'production';

// Conditionally require Docker-dependent modules
let DockerContainerManager;
let CloudContainerManager;

if (!isProduction) {
  // Development mode - use Docker
  DockerContainerManager = require('./containerManager.js').DockerContainerManager;
} else {
  // Production mode - use cloud-compatible manager
  CloudContainerManager = require('./cloudContainerManager.js').CloudContainerManager;
}

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize container manager based on environment
const containerManager = isProduction 
  ? new CloudContainerManager() 
  : new DockerContainerManager();

logger.info(`🏗️ Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);
logger.info(`📦 Using ${isProduction ? 'Cloud' : 'Docker'} Container Manager`);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow Vite dev server and React
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    containers: containerManager.getContainerStatus()
  });
});

// Initialize container
app.post('/api/container/init', async (req, res) => {
  try {
    logger.info('POST /api/container/init - Initializing container');
    const result = await containerManager.initializeContainer();
    res.json({ 
      success: true, 
      containerId: result.containerId,
      containerName: result.containerName 
    });
  } catch (error) {
    logger.error('Failed to initialize container:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Execute command in container
app.post('/api/container/execute', async (req, res) => {
  try {
    const { command, workingDir } = req.body;
    logger.info(`POST /api/container/execute - Command: ${command}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.executeInContainer(container.id, command, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to execute command:', error);
    res.status(500).json({ 
      output: '', 
      error: error.message, 
      exitCode: 1 
    });
  }
});

// Read file from container
app.post('/api/container/read', async (req, res) => {
  try {
    const { filePath, workingDir } = req.body;
    logger.info(`POST /api/container/read - File: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.readFileFromContainer(container.id, filePath, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to read file:', error);
    res.status(500).json({ 
      content: '', 
      error: error.message 
    });
  }
});

// Write file to container
app.post('/api/container/write', async (req, res) => {
  try {
    const { filePath, content, workingDir } = req.body;
    logger.info(`POST /api/container/write - File: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.writeFileToContainer(container.id, filePath, content, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to write file:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// List directory in container
app.post('/api/container/list', async (req, res) => {
  try {
    const { dirPath, workingDir } = req.body;
    logger.info(`POST /api/container/list - Directory: ${dirPath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.listDirectoryInContainer(container.id, dirPath, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to list directory:', error);
    res.status(500).json({ 
      files: [], 
      error: error.message 
    });
  }
});

// Create directory in container
app.post('/api/container/mkdir', async (req, res) => {
  try {
    const { dirPath, workingDir } = req.body;
    logger.info(`POST /api/container/mkdir - Directory: ${dirPath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.createDirectoryInContainer(container.id, dirPath, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to create directory:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete file/directory in container
app.post('/api/container/delete', async (req, res) => {
  try {
    const { filePath, workingDir } = req.body;
    logger.info(`POST /api/container/delete - Path: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.deleteInContainer(container.id, filePath, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to delete path:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Check if file exists in container
app.post('/api/container/exists', async (req, res) => {
  try {
    const { filePath, workingDir } = req.body;
    logger.info(`POST /api/container/exists - File: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.fileExistsInContainer(container.id, filePath, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to check file existence:', error);
    res.status(500).json({ 
      exists: false 
    });
  }
});

// Get all files from container
app.post('/api/container/all-files', async (req, res) => {
  try {
    const { workingDir } = req.body;
    logger.info('POST /api/container/all-files - Getting all files');
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.getAllFilesFromContainer(container.id, workingDir);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to get all files:', error);
    res.status(500).json({ 
      files: [] 
    });
  }
});

// Get preview URL
app.get('/api/container/preview-url', async (req, res) => {
  try {
    logger.info('GET /api/container/preview-url - Getting preview URL');
    
    const container = await containerManager.getActiveContainer();
    const result = await containerManager.getPreviewUrl(container.id);
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to get preview URL:', error);
    res.status(500).json({ 
      url: null 
    });
  }
});

// Cleanup containers
app.post('/api/container/cleanup', async (req, res) => {
  try {
    logger.info('POST /api/container/cleanup - Cleaning up containers');
    
    await containerManager.cleanup();
    
    res.json({ 
      success: true, 
      message: 'Containers cleaned up successfully' 
    });
  } catch (error) {
    logger.error('Failed to cleanup containers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get container status
app.get('/api/container/status', (req, res) => {
  try {
    const status = containerManager.getContainerStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get container status:', error);
    res.status(500).json({ 
      activeContainers: 0, 
      containers: [] 
    });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path 
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down server...');
  await containerManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Shutting down server...');
  await containerManager.cleanup();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  logger.info(`📋 Health check: http://0.0.0.0:${PORT}/health`);
  logger.info(`🐳 Container API: http://0.0.0.0:${PORT}/api/container/*`);
}); 