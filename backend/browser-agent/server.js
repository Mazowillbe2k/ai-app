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
    // Enhanced browser configuration for cloud environments
    const browserOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    browser = await chromium.launch(browserOptions);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();

    // Navigate with extended timeout and better error handling
    await page.goto(url, { 
      timeout: 30000,
      waitUntil: 'networkidle'
    });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(2000);

    const title = await page.title();
    const html = await page.content();

    // Capture screenshot for thumbnail
    let screenshot = null;
    try {
      const screenshotBuffer = await page.screenshot({ 
        fullPage: true,
        quality: 60,
        type: 'jpeg'
      });
      screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`;
    } catch (screenshotError) {
      console.warn('⚠️ Failed to capture screenshot:', screenshotError.message);
    }

    // Get page metadata
    const metadata = await page.evaluate(() => {
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');
      const metaImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const favicon = document.querySelector('link[rel="icon"]')?.getAttribute('href') || 
                     document.querySelector('link[rel="shortcut icon"]')?.getAttribute('href');
      
      return {
        description: metaDescription,
        image: metaImage,
        favicon: favicon
      };
    });

    console.log(`✅ Successfully browsed: ${url} (${title})`);

    res.json({
      title,
      html: html.slice(0, 50000), // Increased limit for better content capture
      screenshot,
      metadata: {
        ...metadata,
        url: url
      }
    });
  } catch (err) {
    console.error('❌ Browsing failed:', err);
    res.status(500).json({ 
      error: 'Failed to load page', 
      details: err.message,
      url: url
    });
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
  console.log(`📋 Health: http://0.0.0.0:${port}/health`);
  console.log(`🌐 Browse: http://0.0.0.0:${port}/api/browse`);
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