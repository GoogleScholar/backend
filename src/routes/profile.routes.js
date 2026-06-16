import { validateScholarUser } from '../utils/formatters.js';
import { getProfile } from '../services/scholar.service.js';

export default async function profileRoutes(app) {
  app.get('/profile', async (request, reply) => {
    const user = String(request.query.user || '').trim();
    if (!validateScholarUser(user)) {
      return reply.code(400).send({
        error: 'Expected a Google Scholar user id in ?user=...'
      });
    }

    const hl = request.query.hl || 'en';
    const pagesize = request.query.pagesize || 100;
    const isTrending = request.query.sortby === 'trending';
    const sortby = request.query.sortby || 'pubdate';

    return await getProfile(user, { hl, pagesize, sortby, isTrending });
  });
}
