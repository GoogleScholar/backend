import { buildApp } from './app.js';
import { PORT, HOST } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
