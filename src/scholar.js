import * as cheerio from 'cheerio';

export const SCHOLAR_ORIGIN = 'https://scholar.google.com';

export function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[^\d-]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function toScholarUrl(href) {
  const value = cleanText(href);
  if (!value || value.startsWith('javascript:')) {
    return null;
  }

  try {
    return new URL(value, SCHOLAR_ORIGIN).toString();
  } catch {
    return null;
  }
}

export function slugKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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

export function isBlockedHtml(html) {
  const text = cleanText(html).toLowerCase();
  return (
    text.includes('our systems have detected unusual traffic') ||
    text.includes('to continue to google scholar citations') ||
    text.includes('please show you') ||
    text.includes('recaptcha')
  );
}

export function parseProfileHtml(html, options = {}) {
  const $ = cheerio.load(html);
  const profileName = cleanText($('#gsc_prf_in').text());
  const avatarUrl = toScholarUrl($('#gsc_prf_pup-img').attr('src')) || '';
  const profileLines = $('.gsc_prf_il')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);

  const summary = {};
  $('#gsc_rsb_st tr').each((_, row) => {
    const label = cleanText($(row).find('.gsc_rsb_sc1').first().text());
    const cells = $(row)
      .find('.gsc_rsb_std')
      .map((__, cell) => parseNumber($(cell).text()))
      .get();

    if (label && cells.length > 0) {
      summary[slugKey(label)] = {
        all: cells[0] ?? 0,
        recent: cells[1] ?? 0
      };
    }
  });

  const citationYears = $('.gsc_g_t')
    .map((_, element) => cleanText($(element).text()))
    .get();
  const citationScores = $('.gsc_g_al')
    .map((_, element) => parseNumber($(element).text()))
    .get();
  const citationsPerYear = {};
  citationYears.forEach((year, index) => {
    if (year) {
      citationsPerYear[year] = citationScores[index] ?? 0;
    }
  });

  const publications = [];
  $('#gsc_a_t .gsc_a_tr, tr.gsc_a_tr').each((index, row) => {
    const titleNode = $(row).find('.gsc_a_at').first();
    const title = cleanText(titleNode.text());
    if (!title) {
      return;
    }

    const grayLines = $(row)
      .find('.gs_gray')
      .map((_, element) => cleanText($(element).text()))
      .get();
    const citationNode = $(row).find('.gsc_a_ac').first();
    const year = parseNumber($(row).find('.gsc_a_y .gsc_a_h, .gsc_a_h').first().text());
    const scholarUrl = toScholarUrl(titleNode.attr('href'));
    const citedByUrl = toScholarUrl(citationNode.attr('href'));
    const id = extractCitationId(scholarUrl) || slugKey(`${title}-${year}-${index}`);

    const currentYear = new Date().getFullYear();
    const paperYear = year ? Number(year) : currentYear;
    const age = Math.max(currentYear - paperYear + 1, 1);
    const trendingScore = Number((parseNumber(citationNode.text()) / age).toFixed(2));

    const publication = {
      id,
      title,
      authors: grayLines[0] || '',
      venue: grayLines[1] || '',
      citations: parseNumber(citationNode.text()),
      trendingScore,
      year,
      links: {
        scholar: scholarUrl,
        citedBy: citedByUrl
      },
      relatedPapers: []
    };
    publication.bibtex = generateBibtex(publication);
    publications.push(publication);
  });

  return {
    source: {
      kind: 'google-scholar-dom',
      user: options.user || '',
      url: options.url || '',
      fetchedAt: options.fetchedAt || new Date().toISOString(),
      profileName,
      affiliation: profileLines[0] || '',
      verifiedEmail: profileLines.find((line) => /verified email/i.test(line)) || '',
      avatarUrl
    },
    metrics: {
      totalCitations: summary.citations?.all ?? 0,
      hIndex: summary.h_index?.all ?? 0,
      i10Index: summary.i10_index?.all ?? 0,
      summary,
      citationsPerYear
    },
    publications
  };
}

export function parseCitedByHtml(html, limit = 10) {
  const $ = cheerio.load(html);
  const papers = [];
  const resultNodes = $('.gs_r.gs_or.gs_scl').length > 0 ? $('.gs_r.gs_or.gs_scl') : $('.gs_ri');

  resultNodes.each((_, element) => {
    if (papers.length >= limit) {
      return false;
    }

    const root = $(element).hasClass('gs_ri') ? $(element) : $(element).find('.gs_ri').first();
    const titleNode = root.find('h3.gs_rt a').first();
    const title = cleanText(titleNode.text() || root.find('h3.gs_rt').first().text());
    if (!title) {
      return;
    }

    const authorsText = cleanText(root.find('.gs_a').first().text());
    let year = '';
    const yearMatch = authorsText.match(/\b(19|20)\d{2}\b/g);
    if (yearMatch && yearMatch.length > 0) {
      year = yearMatch[yearMatch.length - 1];
    }
    
    let citations = 0;
    root.find('.gs_fl a').each((_, el) => {
      const text = $(el).text();
      if (/Cited by\s+\d+/i.test(text)) {
        citations = parseInt(text.replace(/[^\d]/g, ''), 10) || 0;
      }
    });

    const currentYear = new Date().getFullYear();
    const paperYear = year ? Number(year) : currentYear;
    const age = Math.max(currentYear - paperYear + 1, 1);
    const trendingScore = Number((citations / age).toFixed(2));

    papers.push({
      title,
      authors: authorsText,
      year,
      citations,
      trendingScore,
      snippet: cleanText(root.find('.gs_rs').first().text()),
      url: titleNode.attr('href') || ''
    });
  });

  const nextHref = $('#gs_n a')
    .filter((_, element) => /next/i.test($(element).text()))
    .first()
    .attr('href');

  return {
    items: papers,
    nextPage: toScholarUrl(nextHref)
  };
}

export function generateBibtex(publication) {
  const fields = {
    title: publication.title,
    author: cleanText(publication.authors).replace(/,\s+/g, ' and '),
    journal: publication.venue,
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

function extractCitationId(url) {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('citation_for_view') || '';
  } catch {
    return '';
  }
}
