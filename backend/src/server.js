import express from 'express';
import cors from 'cors';
import { DockerContainerManager } from './containerManager.js';
import { CloudContainerManager } from './cloudContainerManager.js';

const app = express();
// Use Render's recommended port with their default fallback
const port = process.env.PORT || 10000;

console.log('🚀 Starting AI Agent Backend Server...');
console.log('📍 Working directory:', process.cwd());
console.log('🔧 Node version:', process.version);
console.log('🏗️ Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

// Detect environment and initialize appropriate container manager
let containerManager;
const isCloudEnvironment = process.env.NODE_ENV === 'production' || process.env.RENDER || !process.env.DOCKER_AVAILABLE;

if (isCloudEnvironment) {
  console.log('☁️ Cloud environment detected - using CloudContainerManager');
  containerManager = new CloudContainerManager();
} else {
  console.log('🐳 Local environment detected - using DockerContainerManager');
  containerManager = new DockerContainerManager();
}

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - CRITICAL for Render
app.get('/health', (req, res) => {
  console.log('📋 Health check requested');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'AI Agent Backend is running',
    port: port,
    containerMode: isCloudEnvironment ? 'cloud' : 'docker'
  });
});

// Basic API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'AI Agent Backend API is running',
    port: port,
    containerMode: isCloudEnvironment ? 'cloud' : 'docker',
    containerManager: containerManager.getContainerStatus()
  });
});

// Container Management Endpoints
app.post('/api/container/init', async (req, res) => {
  try {
    console.log('🚀 Initializing container...');
    const result = await containerManager.initializeContainer();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Container initialization failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/container/execute', async (req, res) => {
  try {
    const { command, workingDir = '/workspace' } = req.body;
    console.log(`🔧 Executing command: ${command}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.status(400).json({
        output: '',
        error: 'No active container found. Please initialize a container first.',
        exitCode: 1
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.executeInContainer(containerId, command, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ Command execution failed:', error);
    res.json({
      output: '',
      error: error.message,
      exitCode: 1
    });
  }
});

app.post('/api/container/read', async (req, res) => {
  try {
    const { filePath, workingDir = '/workspace' } = req.body;
    console.log(`📖 Reading file: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        content: '',
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.readFileFromContainer(containerId, filePath, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ File read failed:', error);
    res.json({
      content: '',
      error: error.message
    });
  }
});

app.post('/api/container/write', async (req, res) => {
  try {
    const { filePath, content, workingDir = '/workspace' } = req.body;
    console.log(`✏️ Writing file: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        success: false,
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.writeFileToContainer(containerId, filePath, content, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ File write failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/container/list', async (req, res) => {
  try {
    const { dirPath, workingDir = '/workspace' } = req.body;
    console.log(`📁 Listing directory: ${dirPath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        files: [],
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.listDirectoryInContainer(containerId, dirPath, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ Directory listing failed:', error);
    res.json({
      files: [],
      error: error.message
    });
  }
});

app.post('/api/container/mkdir', async (req, res) => {
  try {
    const { dirPath, workingDir = '/workspace' } = req.body;
    console.log(`📂 Creating directory: ${dirPath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        success: false,
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.createDirectoryInContainer(containerId, dirPath, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ Directory creation failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/container/delete', async (req, res) => {
  try {
    const { filePath, workingDir = '/workspace' } = req.body;
    console.log(`🗑️ Deleting: ${filePath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        success: false,
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.deleteInContainer(containerId, filePath, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/container/exists', async (req, res) => {
  try {
    const { filePath, workingDir = '/workspace' } = req.body;
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({ exists: false });
    }
    
    const containerId = container.id || container;
    const exists = await containerManager.fileExistsInContainer(containerId, filePath, workingDir);
    res.json({ exists });
  } catch (error) {
    console.error('❌ File existence check failed:', error);
    res.json({ exists: false });
  }
});

app.post('/api/container/all-files', async (req, res) => {
  try {
    const { workingDir = '/workspace' } = req.body;
    console.log(`📄 Getting all files from: ${workingDir}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        files: [],
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.getAllFilesFromContainer(containerId, workingDir);
    res.json(result);
  } catch (error) {
    console.error('❌ Get all files failed:', error);
    res.json({
      files: [],
      error: error.message
    });
  }
});

app.get('/api/container/preview-url', async (req, res) => {
  try {
    console.log('🌐 Getting preview URL...');
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({ url: null });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.getPreviewUrl(containerId);
    res.json(result);
  } catch (error) {
    console.error('❌ Preview URL check failed:', error);
    res.json({ url: null });
  }
});

app.get('/api/container/status', async (req, res) => {
  try {
    const status = containerManager.getContainerStatus();
    res.json(status);
  } catch (error) {
    console.error('❌ Status check failed:', error);
    res.json({ 
      mode: isCloudEnvironment ? 'cloud' : 'docker',
      activeContainers: 0,
      containers: [],
      error: error.message
    });
  }
});

app.post('/api/container/cleanup', async (req, res) => {
  try {
    console.log('🧹 Cleaning up containers...');
    await containerManager.cleanup();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/container/set-working-dir', async (req, res) => {
  try {
    const { dirPath } = req.body;
    console.log(`📂 Setting working directory: ${dirPath}`);
    
    const container = await containerManager.getActiveContainer();
    if (!container) {
      return res.json({
        success: false,
        error: 'No active container found. Please initialize a container first.'
      });
    }
    
    const containerId = container.id || container;
    const result = await containerManager.setContainerWorkingDirectory(containerId, dirPath);
    res.json(result);
  } catch (error) {
    console.error('❌ Set working directory failed:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: ['/health', '/api/status', '/api/container/*']
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server - exactly as Render documentation shows
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ AI Agent Backend listening on port ${port}`);
  console.log(`🌐 Server running on http://0.0.0.0:${port}`);
  console.log(`📋 Health check: http://0.0.0.0:${port}/health`);
  console.log(`🔧 Container manager: ${isCloudEnvironment ? 'CloudContainerManager' : 'DockerContainerManager'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  containerManager.cleanup().finally(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  containerManager.cleanup().finally(() => {
    process.exit(0);
  });
}); 