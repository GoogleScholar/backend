import { fetchScholarHtml } from '../utils/http.js';
import { parseProfileHtml, parseCitationHtml, parseCitedByHtml } from '../utils/parser.js';
import { buildProfileUrl, generateBibtex } from '../utils/formatters.js';
import { cachedJson } from './cache.service.js';
import { SCHOLAR_ORIGIN, CONCURRENCY_LIMIT } from '../config.js';

async function mapConcurrent(items, limit, asyncFn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await asyncFn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function getProfile(user, { hl = 'en', pagesize = 100, sortby = 'pubdate', isTrending = false }) {
  const url = buildProfileUrl({ user, hl, pagesize, sortby: isTrending ? '' : sortby });

  const data = await cachedJson(`profile:${url}`, async () => {
    const html = await fetchScholarHtml(url);
    const profile = parseProfileHtml(html, { user, url, fetchedAt: new Date().toISOString() });

    if (profile.publications && profile.publications.length > 0) {
      await mapConcurrent(profile.publications, CONCURRENCY_LIMIT, async (pub) => {
        if (!pub.id) return;
        const citationUrl = new URL('/citations', SCHOLAR_ORIGIN);
        citationUrl.searchParams.set('view_op', 'view_citation');
        citationUrl.searchParams.set('hl', hl);
        citationUrl.searchParams.set('user', user);
        citationUrl.searchParams.set('citation_for_view', pub.id);
        
        try {
          const fullHtml = await fetchScholarHtml(citationUrl.toString());
          const fullInfo = parseCitationHtml(fullHtml);
          
          // Merge full data directly with the entry
          Object.assign(pub, fullInfo);
          // Regenerate bibtex with the full journal name
          pub.bibtex = generateBibtex(pub);
        } catch (err) {
          console.warn(`Failed to fetch full info for ${pub.id}: ${err.message}`);
        }
      });
    }

    return profile;
  });

  if (isTrending) {
    return {
      ...data,
      publications: [...(data.publications || [])].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
    };
  }

  return data;
}

export async function getBibtex(user, { hl = 'en', pagesize = 100, sortby = 'pubdate' }) {
  const data = await getProfile(user, { hl, pagesize, sortby });
  return (data.publications || [])
    .map(pub => pub.bibtex)
    .filter(Boolean)
    .join('\n\n');
}

export async function getCitedBy(url, limit = 100) {
  return await cachedJson(`cited-by:${url}:limit:${limit}`, async () => {
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
}

export async function getRelatedPapers(url, limit = 100) {
  return await cachedJson(`related-papers:${url}:limit:${limit}`, async () => {
    const html = await fetchScholarHtml(url);
    return {
      source: {
        kind: 'google-scholar-related-papers-dom',
        url,
        fetchedAt: new Date().toISOString()
      },
      ...parseCitedByHtml(html, limit)
    };
  });
}
