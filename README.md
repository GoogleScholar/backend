# Google Scholar Backend

This is the backend API for the Google Scholar integration. It is built using [Fastify](https://fastify.dev/) and provides endpoints to fetch and scrape user profiles, citation data, and BibTeX entries directly from Google Scholar.

## Features

- Fetch complete Google Scholar user profiles and publication lists.
- Export all publications as a BibTeX string.
- Scrape "Cited By" data for specific publication URLs.
- Built-in caching to reduce the number of requests made to Google Scholar.

## Prerequisites

- Node.js `>= 22`

## Installation

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

## Usage

Start the development server with hot-reload:
```bash
npm run dev
```

Start the production server:
```bash
npm start
```

Run tests:
```bash
npm test
```

### Using Docker

To run the API locally using Docker (useful for bypassing cloud IP restrictions):
```bash
docker-compose up -d
```
The API will be available at `http://localhost:3000`.

## Example Usage

You can query the API using `curl` or from your frontend code.

**Using `curl`:**
```bash
curl "http://localhost:3000/profile?user=AREhBXYAAAAJ"
```

**Using JavaScript `fetch`:**
```javascript
async function getProfile() {
  const res = await fetch('http://localhost:3000/profile?user=AREhBXYAAAAJ');
  const data = await res.json();
  console.log(data.publications);
}
```

## Environment Variables

You can configure the backend via environment variables:

- `PORT`: The port the server should run on (default: `3000`).
- `HOST`: The host to bind to (default: `0.0.0.0`).
- `CACHE_TTL_SECONDS`: How long responses should be cached in memory (default: `21600` i.e. 6 hours).
- `CORS_ORIGIN`: Comma-separated list of allowed origins (default allows `https://googlescholar.github.io` and `http://localhost:5173`).

## API Endpoints

### `GET /`
Returns basic information about the API and available endpoints.

### `GET /health`
Returns the health status of the API.

### `GET /profile?user={id}`
Fetches profile data for a specific Google Scholar user.
- **Parameters:**
  - `user` (required): The Google Scholar user ID.
  - `hl`: Language code (default: `en`).
  - `pagesize`: Number of results to fetch per page (default: `100`).
  - `sortby`: Sorting mechanism (e.g. `pubdate` or `trending`).

### `GET /bibtex?user={id}`
Returns all BibTeX entries for a Google Scholar user as plain text.
- **Parameters:**
  - `user` (required): The Google Scholar user ID.
  - `hl`: Language code (default: `en`).
  - `pagesize`: Number of results to fetch per page (default: `100`).

### `GET /cited-by?url={url}`
Scrapes the "Cited By" data for a specific publication URL.
- **Parameters:**
  - `url` (required): The Google Scholar "Cited By" URL.
  - `limit`: The maximum number of cited-by entries to return (default: `100`).

## Notes
- Google Scholar aggressively blocks excessive automated scraping. The built-in in-memory cache aims to mitigate this by storing recent responses. Be mindful of rate limits when calling these endpoints.
