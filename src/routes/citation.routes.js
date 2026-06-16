import { validateScholarUser } from '../utils/formatters.js';
import { getBibtex, getCitedBy, getRelatedPapers } from '../services/scholar.service.js';
import { SCHOLAR_ORIGIN } from '../config.js';

function isAllowedScholarUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === SCHOLAR_ORIGIN && parsed.pathname === '/scholar';
  } catch {
    return false;
  }
}

export default async function citationRoutes(app) {
  app.get('/bibtex', async (request, reply) => {
    const user = String(request.query.user || '').trim();
    if (!validateScholarUser(user)) {
      return reply.code(400).send({
        error: 'Expected a Google Scholar user id in ?user=...'
      });
    }

    const hl = request.query.hl || 'en';
    const pagesize = request.query.pagesize || 100;
    const sortby = request.query.sortby || 'pubdate';

    const bibtexEntries = await getBibtex(user, { hl, pagesize, sortby });

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return reply.send(bibtexEntries);
  });

  app.get('/cited-by', async (request, reply) => {
    const url = String(request.query.url || '').trim();
    const limit = Math.min(Math.max(Number(request.query.limit || 100), 1), 100);

    if (!isAllowedScholarUrl(url)) {
      return reply.code(400).send({
        error: 'Expected a Google Scholar cited-by URL in ?url=...'
      });
    }

    return await getCitedBy(url, limit);
  });

  app.get('/related-papers', async (request, reply) => {
    const url = String(request.query.url || '').trim();
    const limit = Math.min(Math.max(Number(request.query.limit || 100), 1), 100);

    if (!isAllowedScholarUrl(url)) {
      return reply.code(400).send({
        error: 'Expected a Google Scholar related URL in ?url=...'
      });
    }

    return await getRelatedPapers(url, limit);
  });
}
