// browser-agent/server.js
const express = require('express');
const { chromium } = require('playwright');
const app = express();
app.use(express.json());

app.post('/browse', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { timeout: 10000 });

  const title = await page.title();
  const html = await page.content();

  await browser.close();

  res.json({ title, html: html.slice(0, 5000) });
});

app.get('/health', (req, res) => res.json({ status: 'browser-agent-ok' }));

app.listen(process.env.BROWSER_PORT || 10001, () =>
  console.log('Browser agent running on port 10001')
);
