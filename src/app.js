import Fastify from 'fastify';
import cors from '@fastify/cors';
import { CORS_ORIGIN } from './config.js';
import healthRoutes from './routes/health.routes.js';
import profileRoutes from './routes/profile.routes.js';
import citationRoutes from './routes/citation.routes.js';

export async function buildApp() {
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

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || CORS_ORIGIN.includes(origin) || CORS_ORIGIN.includes('*')) {
        callback(null, true);
        return;
      }
      // Security: Do not throw an error here to prevent log flooding / CPU DoS from arbitrary origins
      callback(null, false);
    }
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

  await app.register(healthRoutes);
  await app.register(profileRoutes);
  await app.register(citationRoutes);

  return app;
}
