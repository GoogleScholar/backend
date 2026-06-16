export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';
export const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 21600);
export const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
export const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'https://googlescholar.github.io,http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
export const SCHOLAR_ORIGIN = 'https://scholar.google.com';
export const CONCURRENCY_LIMIT = 3;
