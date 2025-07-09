// browser-agent/server.js
import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const port = process.env.BROWSER_PORT || 10001;

console.log('🌐 Starting Browser Agent...');
console.log('🔌 Port:', port);
console.log('📍 Working directory:', process.cwd());
console.log('🔧 Node version:', process.version);
console.log('🏗️ Environment:', process.env.NODE_ENV || 'development');

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  console.log('📋 Health check requested');
  res.status(200).json({
    status: 'browser-agent-ok',
    timestamp: new Date().toISOString(),
    port,
  });
});

// Web browsing endpoint
app.post('/api/browse', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    console.warn('⚠️ Invalid or missing URL in request body');
    return res.status(400).json({ error: 'Missing or invalid "url" in request body' });
  }

  console.log(`🌍 Browsing to URL: ${url}`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { timeout: 10000 });

    const title = await page.title();
    const html = await page.content();

    res.json({
      title,
      html: html.slice(0, 5000), // Limit for safety
    });
  } catch (err) {
    console.error('❌ Browsing failed:', err);
    res.status(500).json({ error: 'Failed to load page', details: err.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log('🧹 Browser closed');
    }
  }
});

// 404 fallback
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: ['/health', '/api/browse'],
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Browser Agent listening on http://0.0.0.0:${port}`);
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