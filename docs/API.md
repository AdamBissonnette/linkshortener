# API Documentation

This document describes how to programmatically interact with the link shortener service using API tokens. This is ideal for integrating the service into other applications, automation scripts, or AI agents.

## Quick Start

### 1. Create an API Token

First, log into the admin panel and create an API token with the appropriate scopes:

1. Navigate to your admin URL (e.g., `https://goto.adamnant.com/derp/`)
2. Go to the **API Tokens** section
3. Click **Create Token**
4. Enter a name and select the required scopes:
   - `links` - Create, read, update, delete short links
   - `hits` - Read tracking data
   - `export` - Export tracking data as CSV
   - `blacklist` - Manage IP blacklist (optional)
5. Click **Generate Token** and copy the token immediately (it won't be shown again)

### 2. Test Your Token

```bash
# Replace YOUR_TOKEN and YOUR_DOMAIN with your actual values
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR_DOMAIN/api/links
```

## Authentication

All API endpoints require authentication using an API token. There are two ways to authenticate:

### Method 1: Bearer Token (Recommended)

Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/links
```

### Method 2: Query Parameter

Append the token as a query parameter (less secure, avoid in production):

```bash
curl https://goto.adamnant.com/api/links?access_token=YOUR_TOKEN
```

## API Endpoints

### Base URL

Replace `https://goto.adamnant.com` with your actual domain throughout these examples.

---

## Link Management

### List All Links

**Endpoint:** `GET /api/links`  
**Required Scope:** `links`

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/links
```

**Response:**
```json
{
  "links": [
    {
      "slug": "example",
      "destination": "https://example.com",
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

### Create or Update Link

**Endpoint:** `POST /api/links`  
**Required Scope:** `links`

**Request Body:**
```json
{
  "slug": "mylink",
  "destination": "https://example.com/page"
}
```

**Validation Rules:**
- `slug` must be alphanumeric with dashes and underscores only (max 100 chars)
- `slug` cannot contain suspicious patterns (`.env`, `wp-config`, etc.)
- `destination` must be a valid URL (max 2000 chars)

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"docs","destination":"https://docs.example.com"}' \
  https://goto.adamnant.com/api/links
```

**Response:**
```json
{
  "success": true
}
```

**Note:** If the slug already exists, this will update the destination.

---

### Delete Link

**Endpoint:** `DELETE /api/links/:slug`  
**Required Scope:** `links`

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/links/mylink
```

**Response:**
```json
{
  "success": true
}
```

---

## Analytics & Tracking

### Get Hits (Raw Data)

**Endpoint:** `GET /api/hits`  
**Required Scope:** `hits`

**Query Parameters:**
- `limit` (optional, default: 100) - Number of recent hits to return
- `slug` (optional) - Filter by specific slug
- `type` (optional) - Filter by type (`redirect`, `pixel`)

**Examples:**

```bash
# Get last 100 hits
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/hits

# Get last 50 hits
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/hits?limit=50

# Get hits for specific slug
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/hits?slug=example

# Get only redirect hits for a slug
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/hits?slug=example&type=redirect
```

**Response:**
```json
{
  "hits": [
    {
      "id": 123,
      "type": "redirect",
      "slug": "example",
      "ip": "192.168.1.1",
      "timestamp": "2024-01-01T12:00:00.000Z",
      "user_agent": "Mozilla/5.0...",
      "browser": "Chrome 120",
      "os": "Mac OS 14",
      "device": "desktop",
      "referer": "https://source.com",
      "accept_language": "en-US,en;q=0.9",
      "query_params": "{\"utm_source\":\"twitter\"}",
      "session_id": "abc123",
      "visitor_id": "xyz789",
      "extra": "{\"is_bot\":0}"
    }
  ]
}
```

---

### Get Aggregated Stats

**Endpoint:** `GET /api/stats`  
**Required Scope:** `hits`

**Query Parameters:**
- `slug` (optional) - Filter by specific slug
- `type` (optional) - Filter by type (`redirect`, `pixel`)

**Example:**

```bash
# Get overall stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/stats

# Get stats for specific slug
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/stats?slug=example
```

**Response:**
```json
{
  "total": 1234,
  "byType": {
    "redirect": 1000,
    "pixel": 234
  },
  "bySlug": {
    "example": 500,
    "docs": 734
  },
  "byIP": {
    "192.168.1.1": 10,
    "203.0.113.5": 25
  },
  "byBrowser": {
    "Chrome 120": 800,
    "Safari 17": 400
  },
  "byOS": {
    "Mac OS 14": 600,
    "Windows 11": 400
  },
  "byDevice": {
    "desktop": 900,
    "mobile": 334
  },
  "byReferer": {
    "Direct": 500,
    "https://twitter.com": 300
  }
}
```

---

### Export Hits as CSV

**Endpoint:** `GET /api/export/csv`  
**Required Scope:** `export`

**Query Parameters:**
- `slug` (optional) - Filter by specific slug
- `type` (optional) - Filter by type (`redirect`, `pixel`)

**Example:**

```bash
# Export all hits
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/export/csv \
  -o hits.csv

# Export hits for specific slug
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/export/csv?slug=example \
  -o example-hits.csv
```

**CSV Columns:**
```
ID, Type, Slug, IP, Timestamp, Browser, OS, Device, Referer, Language, Query Params, Session ID, Visitor ID, Extra
```

---

## IP Blacklist Management (Optional)

### List Blacklisted IPs

**Endpoint:** `GET /api/blacklist`  
**Required Scope:** `blacklist`

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/blacklist
```

**Response:**
```json
{
  "blacklist": [
    {
      "ip": "203.0.113.5",
      "reason": "Spam bot",
      "added_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

### Add IP to Blacklist

**Endpoint:** `POST /api/blacklist`  
**Required Scope:** `blacklist`

**Request Body:**
```json
{
  "ip": "203.0.113.5",
  "reason": "Spam bot"
}
```

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ip":"203.0.113.5","reason":"Spam bot"}' \
  https://goto.adamnant.com/api/blacklist
```

**Response:**
```json
{
  "success": true
}
```

---

### Remove IP from Blacklist

**Endpoint:** `DELETE /api/blacklist/:ip`  
**Required Scope:** `blacklist`

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://goto.adamnant.com/api/blacklist/203.0.113.5
```

**Response:**
```json
{
  "success": true
}
```

---

## Error Handling

All endpoints return JSON error responses with appropriate HTTP status codes:

### 400 Bad Request
```json
{
  "error": "slug and destination are required"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing token"
}
```
or
```json
{
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Missing scope: links"
}
```

### 404 Not Found
```json
{
  "error": "Link not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to save link"
}
```

---

## Example: Warp Agent Integration

Here's a complete example workflow for another Warp agent or automation script:

```bash
#!/bin/bash

# Configuration
API_URL="https://goto.adamnant.com"
API_TOKEN="your_token_here"

# Function to create/update a link
create_link() {
  local slug=$1
  local destination=$2
  
  curl -s -X POST \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"slug\":\"$slug\",\"destination\":\"$destination\"}" \
    "$API_URL/api/links"
}

# Function to get stats for a link
get_stats() {
  local slug=$1
  
  curl -s -H "Authorization: Bearer $API_TOKEN" \
    "$API_URL/api/stats?slug=$slug"
}

# Usage examples
create_link "myapp" "https://myapp.example.com"
get_stats "myapp"
```

### Python Example

```python
import requests

class LinkShortener:
    def __init__(self, base_url, token):
        self.base_url = base_url.rstrip('/')
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def create_link(self, slug, destination):
        url = f"{self.base_url}/api/links"
        data = {"slug": slug, "destination": destination}
        response = requests.post(url, json=data, headers=self.headers)
        return response.json()
    
    def get_stats(self, slug=None):
        url = f"{self.base_url}/api/stats"
        params = {"slug": slug} if slug else {}
        response = requests.get(url, params=params, headers=self.headers)
        return response.json()
    
    def delete_link(self, slug):
        url = f"{self.base_url}/api/links/{slug}"
        response = requests.delete(url, headers=self.headers)
        return response.json()

# Usage
ls = LinkShortener("https://goto.adamnant.com", "your_token_here")
ls.create_link("docs", "https://docs.example.com")
stats = ls.get_stats("docs")
print(f"Docs link has {stats['total']} hits")
```

---

## Rate Limits & Best Practices

- **No enforced rate limits** currently, but be respectful with API usage
- **Reuse connections** when making multiple requests
- **Cache results** when appropriate (e.g., link lists that don't change frequently)
- **Use filters** (slug, type) to reduce payload size when fetching hits
- **Store tokens securely** - never commit them to version control
- **Rotate tokens** periodically for security
- **Use specific scopes** - only grant the permissions your application needs

---

## Support

For issues or questions:
- Check the main [README.md](../README.md) for service information
- Review [SECURITY.md](SECURITY.md) for security considerations
- Check server logs for detailed error information
