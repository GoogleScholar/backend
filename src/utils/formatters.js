import { SCHOLAR_ORIGIN } from '../config.js';

export function buildProfileUrl({ user, hl = 'en', pagesize = 100, sortby = 'pubdate' }) {
  const url = new URL('/citations', SCHOLAR_ORIGIN);
  url.searchParams.set('user', user);
  url.searchParams.set('hl', hl);
  url.searchParams.set('pagesize', String(Math.min(Math.max(Number(pagesize) || 100, 1), 100)));
  url.searchParams.set('view_op', 'list_works');
  url.searchParams.set('sortby', sortby);
  return url.toString();
}

export function validateScholarUser(user) {
  return /^[A-Za-z0-9_-]+$/.test(String(user || ''));
}

export function extractCitationId(url) {
  if (!url) return '';
  const match = url.match(/[?&]citation_for_view=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[^\d-]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function slugKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function toScholarUrl(href) {
  const value = cleanText(href);
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('/')) {
    return SCHOLAR_ORIGIN + value;
  }

  try {
    const url = new URL(value, SCHOLAR_ORIGIN);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function bibtexKey(publication) {
  const firstAuthor = cleanText(publication.authors).split(/,|\band\b/i)[0] || 'paper';
  const author = firstAuthor.replace(/[^A-Za-z0-9]+/g, '') || 'paper';
  const year = Number(publication.year) > 0 ? publication.year : 'nd';
  const firstTitleWord = cleanText(publication.title).split(/\s+/)[0] || 'untitled';
  const title = firstTitleWord.replace(/[^A-Za-z0-9]+/g, '') || 'untitled';
  return `${author}${year}${title}`.toLowerCase();
}

function bibtexEscape(value) {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

export function generateBibtex(publication) {
  const fields = {
    title: publication.title,
    author: cleanText(publication.authors).replace(/,\s+/g, ' and '),
    journal: publication.journal || publication.venue,
    year: Number(publication.year) > 0 ? String(publication.year) : '',
    url: publication.links?.external || publication.links?.scholar,
    note: `Cited by ${Number(publication.citations) || 0}`
  };

  const lines = [`@article{${bibtexKey(publication)},`];
  for (const [field, value] of Object.entries(fields)) {
    if (cleanText(value)) {
      lines.push(`  ${field} = {${bibtexEscape(value)}},`);
    }
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  lines.push('}');
  return lines.join('\n');
}
