import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  buildProfileUrl,
  isBlockedHtml,
  parseCitedByHtml,
  parseProfileHtml,
  SCHOLAR_ORIGIN,
  validateScholarUser
} from './scholar.js';

const app = Fastify({
  logger: true
});

// Security: Add common security headers for defense-in-depth
app.addHook('onRequest', async (request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

const cache = new Map();
const pendingRequests = new Map();
const cacheTtlMs = Number(process.env.CACHE_TTL_SECONDS || 21600) * 1000;
const corsOrigins = (process.env.CORS_ORIGIN || 'https://googlescholar.github.io,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      callback(null, true);
      return;
    }
    // Security: Do not throw an error here to prevent log flooding / CPU DoS from arbitrary origins
    callback(null, false);
  }
});

app.get('/', async () => ({
  message: 'Welcome to the Google Scholar Backend API',
  endpoints: {
    '/health': 'Check API health status',
    '/profile?user={id}': 'Get profile data for a Google Scholar user',
    '/bibtex?user={id}': 'Get all bibtex entries for a Google Scholar user as plain text',
    '/cited-by?url={url}': 'Get cited-by data for a specific publication URL'
  }
}));

app.get('/health', async () => ({
  ok: true,
  service: 'googlescholar-backend'
}));

app.get('/bibtex', async (request, reply) => {
  const user = String(request.query.user || '').trim();
  if (!validateScholarUser(user)) {
    return reply.code(400).send({
      error: 'Expected a Google Scholar user id in ?user=...'
    });
  }

  const url = buildProfileUrl({
    user,
    hl: request.query.hl || 'en',
    pagesize: request.query.pagesize || 100,
    sortby: request.query.sortby || 'pubdate'
  });

  const data = await cachedJson(`profile:${url}`, async () => {
    const html = await fetchScholarHtml(url);
    return parseProfileHtml(html, {
      user,
      url,
      fetchedAt: new Date().toISOString()
    });
  });

  const bibtexEntries = (data.publications || [])
    .map(pub => pub.bibtex)
    .filter(Boolean)
    .join('\n\n');

  reply.header('Content-Type', 'text/plain; charset=utf-8');
  return reply.send(bibtexEntries);
});


app.get('/profile', async (request, reply) => {
  const user = String(request.query.user || '').trim();
  if (!validateScholarUser(user)) {
    return reply.code(400).send({
      error: 'Expected a Google Scholar user id in ?user=...'
    });
  }

  const isTrending = request.query.sortby === 'trending';
  const sortby = isTrending ? '' : (request.query.sortby || 'pubdate');

  const url = buildProfileUrl({
    user,
    hl: request.query.hl || 'en',
    pagesize: request.query.pagesize || 100,
    sortby
  });

  const data = await cachedJson(`profile:${url}`, async () => {
    const html = await fetchScholarHtml(url);
    return parseProfileHtml(html, {
      user,
      url,
      fetchedAt: new Date().toISOString()
    });
  });

  if (isTrending) {
    return {
      ...data,
      publications: [...(data.publications || [])].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
    };
  }

  return data;
});

app.get('/cited-by', async (request, reply) => {
  const url = String(request.query.url || '').trim();
  const limit = Math.min(Math.max(Number(request.query.limit || 100), 1), 100);

  if (!isAllowedScholarUrl(url)) {
    return reply.code(400).send({
      error: 'Expected a Google Scholar cited-by URL in ?url=...'
    });
  }

  const data = await cachedJson(`cited-by:${url}:limit:${limit}`, async () => {
    const html = await fetchScholarHtml(url);
    return {
      source: {
        kind: 'google-scholar-cited-by-dom',
        url,
        fetchedAt: new Date().toISOString()
      },
      ...parseCitedByHtml(html, limit)
    };
  });

  return data;
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode || 500;
  // Security: Do not expose internal server error messages to clients
  const errorMessage = statusCode >= 500 && statusCode !== 502 && statusCode !== 503
    ? 'Internal Server Error'
    : (error.message || 'Unexpected server error');

  reply.code(statusCode).send({
    error: errorMessage
  });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

async function fetchScholarHtml(url) {
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (compatible; GoogleScholarBackend/1.0; +https://github.com/GoogleScholar/backend)'
    },
    // Security: Prevent SSRF via open redirects on Google Scholar
    redirect: 'error',
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    const error = new Error(`Google Scholar request failed with ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const html = await response.text();
  if (isBlockedHtml(html)) {
    const error = new Error('Google Scholar returned a login, captcha, or blocking page.');
    error.statusCode = 503;
    throw error;
  }

  return html;
}

async function cachedJson(key, loader) {
  // Security: Prevent memory exhaustion DoS from unbounded cache growth
  if (cache.size > 2000) {
    cache.clear();
  }

  const hit = cache.get(key);
  if (hit && Date.now() - hit.createdAt < cacheTtlMs) {
    return {
      ...hit.value,
      cache: {
        hit: true,
        ttlSeconds: Math.max(0, Math.round((cacheTtlMs - (Date.now() - hit.createdAt)) / 1000))
      }
    };
  }

  if (pendingRequests.has(key)) {
    const value = await pendingRequests.get(key);
    return {
      ...value,
      cache: {
        hit: true, // We treat this as a cache hit, since the request was collapsed
        ttlSeconds: Math.round(cacheTtlMs / 1000), // Approximate TTL
      }
    };
  }

  const promise = loader().then(value => {
    cache.set(key, {
      createdAt: Date.now(),
      value
    });
    return value;
  }).finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  const value = await promise;

  return {
    ...value,
    cache: {
      hit: false,
      ttlSeconds: Math.round(cacheTtlMs / 1000)
    }
  };
}

function isAllowedScholarUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === SCHOLAR_ORIGIN && parsed.pathname === '/scholar';
  } catch {
    return false;
  }
}
