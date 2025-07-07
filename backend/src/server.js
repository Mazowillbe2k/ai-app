import express from 'express';
import cors from 'cors';

const app = express();
// Use Render's recommended port with their default fallback
const port = process.env.PORT || 10000;

console.log('🚀 Starting AI Agent Backend Server...');
console.log('📍 Working directory:', process.cwd());
console.log('🔧 Node version:', process.version);
console.log('🏗️ Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

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
    port: port
  });
});

// Basic API status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'AI Agent Backend API is running',
    port: port,
    endpoints: ['/health', '/api/status']
  });
});

// Minimal container API endpoints for compatibility
app.post('/api/container/init', (req, res) => {
  res.json({ 
    success: true, 
    containerId: 'simple-mode',
    containerName: 'simple-container'
  });
});

app.post('/api/container/execute', (req, res) => {
  const { command } = req.body;
  res.json({
    output: `Simulated execution: ${command}`,
    exitCode: 0
  });
});

app.get('/api/container/status', (req, res) => {
  res.json({ 
    mode: 'simple',
    activeContainers: 1,
    containers: []
  });
});

// Catch all other API routes
app.use('/api/*', (req, res) => {
  res.status(200).json({ 
    message: 'API endpoint available in simple mode',
    endpoint: req.path
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: ['/health', '/api/status']
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
}); 