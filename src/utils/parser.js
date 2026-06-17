import * as cheerio from 'cheerio';
import { SCHOLAR_ORIGIN } from '../config.js';
import {
  cleanText,
  parseNumber,
  toScholarUrl,
  slugKey,
  generateBibtex,
  extractCitationId
} from './formatters.js';

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

  $('.gsc_a_tr').each((index, row) => {
    const $row = $(row);
    const titleNode = $row.find('.gsc_a_at');
    const title = cleanText(titleNode.text());
    if (!title) {
      return;
    }

    const grayLines = $row.find('.gs_gray');
    const citationNode = $row.find('.gsc_a_ac');
    const yearNode = $row.find('.gsc_a_h');

    const authorsStr = cleanText(grayLines.eq(0).text());
    const venueStr = cleanText(grayLines.eq(1).text());
    const yearText = yearNode.text();
    const year = parseNumber(yearText);

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
      authors: authorsStr || '',
      venue: venueStr || '',
      citations: parseNumber(citationNode.text()),
      trendingScore,
      year,
      links: {
        scholar: scholarUrl,
        citedBy: citedByUrl
      }
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

export function parseCitationHtml(html) {
  const $ = cheerio.load(html);
  const title = cleanText($('#gsc_vcd_title').text() || $('#gsc_oci_title').text() || $('.gsc_vcd_title a').text() || $('.gsc_oci_title a').text() || $('.gsc_vcd_title').text() || $('.gsc_oci_title').text());
  
  const fields = {};
  $('.gsc_vcd_field, .gsc_oci_field').each((_, el) => {
    const field = slugKey($(el).text());
    const value = cleanText($(el).next('.gsc_vcd_value, .gsc_oci_value').text());
    if (field && value) {
      fields[field] = value;
    }
  });

  let relatedUrl = '';
  $('a').each((_, el) => {
    const text = $(el).text();
    if (text.toLowerCase().includes('related')) {
      const href = $(el).attr('href');
      if (href) {
        relatedUrl = new URL(href, SCHOLAR_ORIGIN).toString();
      }
    }
  });

  return {
    title: title || '',
    authors: fields.authors || '',
    publicationDate: fields.publication_date || '',
    journal: fields.journal || fields.source || '',
    venue: fields.journal || fields.source || '',
    volume: fields.volume || '',
    issue: fields.issue || '',
    pages: fields.pages || '',
    publisher: fields.publisher || '',
    abstract: fields.description || '',
    relatedUrl
  };
}
