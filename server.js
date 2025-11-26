require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const UAParser = require('ua-parser-js');

const app = express();
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ALLOWED_ADMIN_IPS = (process.env.ALLOWED_ADMIN_IPS || '127.0.0.1').split(',');
const DATA_DIR = path.join(__dirname, 'data');
const LINKS_FILE = path.join(DATA_DIR, 'links.json');
const HITS_FILE = path.join(DATA_DIR, 'hits.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory storage for ultra-fast lookups
let links = new Map();
let hits = [];

// Load links from disk on startup
function loadLinks() {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
      links = new Map(Object.entries(data));
      console.log(`Loaded ${links.size} links from disk`);
    }
  } catch (err) {
    console.error('Error loading links:', err);
  }
}

// Load hits from disk on startup
function loadHits() {
  try {
    if (fs.existsSync(HITS_FILE)) {
      hits = JSON.parse(fs.readFileSync(HITS_FILE, 'utf8'));
      console.log(`Loaded ${hits.length} hits from disk`);
    }
  } catch (err) {
    console.error('Error loading hits:', err);
  }
}

// Save links to disk
function saveLinks() {
  try {
    const data = Object.fromEntries(links);
    fs.writeFileSync(LINKS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving links:', err);
  }
}

// Save hits to disk (batched to avoid performance issues)
let saveHitsTimeout = null;
function saveHits() {
  clearTimeout(saveHitsTimeout);
  saveHitsTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(HITS_FILE, JSON.stringify(hits, null, 2));
    } catch (err) {
      console.error('Error saving hits:', err);
    }
  }, 5000); // Batch writes every 5 seconds
}

// Middleware to extract IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip;
}

// Middleware to parse user agent
function parseUserAgent(req) {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  return {
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    device: result.device.type || 'desktop'
  };
}

// Track a hit
function trackHit(type, slug, req) {
  const ip = getClientIP(req);
  const ua = parseUserAgent(req);
  const hit = {
    type, // 'redirect' or 'pixel'
    slug,
    ip,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'Unknown',
    browser: ua.browser,
    os: ua.os,
    device: ua.device,
    referer: req.headers['referer'] || req.headers['referrer'] || 'Direct',
    acceptLanguage: req.headers['accept-language'] || 'Unknown'
  };
  
  hits.push(hit);
  saveHits();
  
  // Log to console
  console.log(`[${type.toUpperCase()}] ${slug} - ${ip} - ${ua.browser} on ${ua.os} - Referer: ${hit.referer}`);
  
  return hit;
}

// Authentication middleware for admin routes
function authAdmin(req, res, next) {
  const ip = getClientIP(req);
  
  // Check IP whitelist
  if (!ALLOWED_ADMIN_IPS.includes(ip) && !ALLOWED_ADMIN_IPS.includes('*')) {
    return res.status(403).json({ error: 'IP not allowed' });
  }
  
  // Check password
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const password = auth.substring(7);
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  next();
}

// Load data on startup
loadLinks();
loadHits();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', links: links.size, hits: hits.length });
});

// Redirect endpoint - main link shortener
app.get('/l/:slug', (req, res) => {
  const { slug } = req.params;
  const destination = links.get(slug);
  
  if (!destination) {
    return res.status(404).send('Link not found');
  }
  
  trackHit('redirect', slug, req);
  res.redirect(302, destination);
});

// Pixel tracking endpoint
app.get('/p/:slug', (req, res) => {
  const { slug } = req.params;
  
  trackHit('pixel', slug, req);
  
  // Serve 1x1 transparent PNG
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Expires': '0',
    'Pragma': 'no-cache'
  });
  
  res.send(pixel);
});

// Admin API - Add link
app.post('/admin/links', authAdmin, (req, res) => {
  const { slug, destination } = req.body;
  
  if (!slug || !destination) {
    return res.status(400).json({ error: 'slug and destination are required' });
  }
  
  links.set(slug, destination);
  saveLinks();
  
  res.json({ success: true, slug, destination });
});

// Admin API - Remove link
app.delete('/admin/links/:slug', authAdmin, (req, res) => {
  const { slug } = req.params;
  
  if (!links.has(slug)) {
    return res.status(404).json({ error: 'Link not found' });
  }
  
  links.delete(slug);
  saveLinks();
  
  res.json({ success: true, slug });
});

// Admin API - List links
app.get('/admin/links', authAdmin, (req, res) => {
  const linksList = Array.from(links.entries()).map(([slug, destination]) => ({
    slug,
    destination,
    hits: hits.filter(h => h.slug === slug && h.type === 'redirect').length
  }));
  
  res.json({ links: linksList });
});

// Admin API - Get stats
app.get('/admin/stats', authAdmin, (req, res) => {
  const { slug, type } = req.query;
  
  let filteredHits = hits;
  
  if (slug) {
    filteredHits = filteredHits.filter(h => h.slug === slug);
  }
  
  if (type) {
    filteredHits = filteredHits.filter(h => h.type === type);
  }
  
  // Aggregate stats
  const stats = {
    total: filteredHits.length,
    byType: {},
    bySlug: {},
    byIP: {},
    byBrowser: {},
    byOS: {},
    byDevice: {},
    recent: filteredHits.slice(-100).reverse()
  };
  
  filteredHits.forEach(hit => {
    stats.byType[hit.type] = (stats.byType[hit.type] || 0) + 1;
    stats.bySlug[hit.slug] = (stats.bySlug[hit.slug] || 0) + 1;
    stats.byIP[hit.ip] = (stats.byIP[hit.ip] || 0) + 1;
    stats.byBrowser[hit.browser] = (stats.byBrowser[hit.browser] || 0) + 1;
    stats.byOS[hit.os] = (stats.byOS[hit.os] || 0) + 1;
    stats.byDevice[hit.device] = (stats.byDevice[hit.device] || 0) + 1;
  });
  
  res.json(stats);
});

// Admin API - Export hits as CSV
app.get('/admin/export/csv', authAdmin, (req, res) => {
  const { slug, type } = req.query;
  
  let filteredHits = hits;
  
  if (slug) {
    filteredHits = filteredHits.filter(h => h.slug === slug);
  }
  
  if (type) {
    filteredHits = filteredHits.filter(h => h.type === type);
  }
  
  // Generate CSV
  const headers = ['Type', 'Slug', 'IP', 'Timestamp', 'Browser', 'OS', 'Device', 'Referer', 'Language'];
  const rows = filteredHits.map(h => [
    h.type,
    h.slug,
    h.ip,
    h.timestamp,
    h.browser,
    h.os,
    h.device,
    h.referer,
    h.acceptLanguage
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="hits-${Date.now()}.csv"`
  });
  
  res.send(csv);
});

// Start server
app.listen(PORT, () => {
  console.log(`Link shortener running on port ${PORT}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  console.log(`Allowed admin IPs: ${ALLOWED_ADMIN_IPS.join(', ')}`);
});
