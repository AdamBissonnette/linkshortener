# Link Shortener & Pixel Tracking Service

A high-performance, lightweight link shortening and pixel tracking service built with Node.js and Express. Designed for speed with in-memory lookups and minimal overhead to avoid conversion loss.

## Features

- **Ultra-fast redirects** - In-memory Map storage for instant lookups
- **Link management** - Add/remove links while the service is running
- **Pixel tracking** - Serve 1x1 transparent PNGs for tracking
- **Comprehensive analytics** - Track IP, browser, OS, device, referrer, and language
- **Real-time logging** - Console logs for all hits
- **CSV export** - Download hit data for analysis
- **Password & IP protection** - Secure admin endpoints
- **Persistent storage** - JSON file backup with batched writes

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env
```

## Configuration

Edit `.env` to configure:

- `PORT` - Server port (default: 3000)
- `ADMIN_PASSWORD` - Password for admin API access
- `ALLOWED_ADMIN_IPS` - Comma-separated list of IPs allowed to access admin endpoints

## Usage

```bash
# Start the server
npm start

# Or use Node's watch mode for development
npm run dev
```

## Endpoints

### Public Endpoints

#### `GET /l/:slug`
Redirect to the destination URL for the given slug.

**Example:**
```
https://yourdomain.com/l/github
→ Redirects to configured destination
```

#### `GET /p/:slug`
Serve a 1x1 transparent tracking pixel.

**Example:**
```html
<img src="https://yourdomain.com/p/email-campaign-1" width="1" height="1" />
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "links": 5,
  "hits": 1234
}
```

### Admin Endpoints

All admin endpoints require:
- **Authorization header:** `Bearer YOUR_PASSWORD`
- **IP whitelist:** Request must come from allowed IP

#### `POST /admin/links`
Add a new link or update existing one.

**Request:**
```bash
curl -X POST http://localhost:3000/admin/links \
  -H "Authorization: Bearer changeme" \
  -H "Content-Type: application/json" \
  -d '{"slug": "github", "destination": "https://github.com"}'
```

**Response:**
```json
{
  "success": true,
  "slug": "github",
  "destination": "https://github.com"
}
```

#### `DELETE /admin/links/:slug`
Remove a link.

**Request:**
```bash
curl -X DELETE http://localhost:3000/admin/links/github \
  -H "Authorization: Bearer changeme"
```

**Response:**
```json
{
  "success": true,
  "slug": "github"
}
```

#### `GET /admin/links`
List all links with hit counts.

**Request:**
```bash
curl http://localhost:3000/admin/links \
  -H "Authorization: Bearer changeme"
```

**Response:**
```json
{
  "links": [
    {
      "slug": "github",
      "destination": "https://github.com",
      "hits": 42
    }
  ]
}
```

#### `GET /admin/stats`
Get aggregated statistics.

**Query Parameters:**
- `slug` (optional) - Filter by slug
- `type` (optional) - Filter by type (redirect/pixel)

**Request:**
```bash
curl "http://localhost:3000/admin/stats?slug=github" \
  -H "Authorization: Bearer changeme"
```

**Response:**
```json
{
  "total": 42,
  "byType": { "redirect": 42 },
  "bySlug": { "github": 42 },
  "byIP": { "192.168.1.1": 5 },
  "byBrowser": { "Chrome 120": 30 },
  "byOS": { "Mac OS 14": 25 },
  "byDevice": { "desktop": 40 },
  "recent": [...]
}
```

#### `GET /admin/export/csv`
Export hit data as CSV.

**Query Parameters:**
- `slug` (optional) - Filter by slug
- `type` (optional) - Filter by type (redirect/pixel)

**Request:**
```bash
curl "http://localhost:3000/admin/export/csv" \
  -H "Authorization: Bearer changeme" \
  -o hits.csv
```

## Deployment

### nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName yourdomain.com

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Port "80"
</VirtualHost>
```

### systemd Service

Create `/etc/systemd/system/link-shortener.service`:

```ini
[Unit]
Description=Link Shortener Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/link_shortener
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable link-shortener
sudo systemctl start link-shortener
```

## Data Storage

Data is stored in the `data/` directory:
- `links.json` - Link mappings (slug → destination)
- `hits.json` - All tracking data

Hits are batched and written to disk every 5 seconds to maintain performance.

## Security Notes

1. **Change the default password** in `.env`
2. **Restrict admin IPs** to trusted addresses only
3. **Use HTTPS** in production (configure in reverse proxy)
4. **Firewall** the Node.js port (only allow reverse proxy access)
5. **Regular backups** of the `data/` directory

## Performance

- In-memory Map for O(1) link lookups
- Batched disk writes to avoid I/O blocking
- Minimal dependencies
- No database overhead
- Typical redirect time: <5ms

## License

MIT
