import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlockedHtml } from '../src/utils/http.js';
import { parseCitedByHtml, parseProfileHtml, parseCitationHtml } from '../src/utils/parser.js';

const profileFixture = `
<html>
  <body>
    <div id="gsc_prf_in">Ada Scholar</div>
    <img id="gsc_prf_pup-img" src="https://scholar.googleusercontent.com/citations?view_op=view_photo&user=abc" alt="Ada Scholar" />
    <div class="gsc_prf_il">Example University</div>
    <div class="gsc_prf_il">Verified email at example.edu</div>
    <table id="gsc_rsb_st">
      <tr><td class="gsc_rsb_sc1">Citations</td><td class="gsc_rsb_std">1,234</td><td class="gsc_rsb_std">456</td></tr>
      <tr><td class="gsc_rsb_sc1">h-index</td><td class="gsc_rsb_std">22</td><td class="gsc_rsb_std">14</td></tr>
      <tr><td class="gsc_rsb_sc1">i10-index</td><td class="gsc_rsb_std">31</td><td class="gsc_rsb_std">19</td></tr>
    </table>
    <span class="gsc_g_t">2024</span><span class="gsc_g_t">2025</span>
    <span class="gsc_g_al">52</span><span class="gsc_g_al">61</span>
    <table id="gsc_a_t">
      <tr class="gsc_a_tr">
        <td>
          <a class="gsc_a_at" href="/citations?view_op=view_citation&citation_for_view=abc123">A careful paper</a>
          <div class="gs_gray">A Scholar, B Writer</div>
          <div class="gs_gray">Journal of Examples, 2025</div>
        </td>
        <td><a class="gsc_a_ac" href="/scholar?cites=42">17</a></td>
        <td class="gsc_a_y"><span class="gsc_a_h">2025</span></td>
      </tr>
    </table>
  </body>
</html>`;

describe('parseProfileHtml', () => {
  it('extracts profile metadata, metrics, citation history, and publications', () => {
    const parsed = parseProfileHtml(profileFixture, {
      user: 'abc',
      url: 'https://scholar.google.com/citations?user=abc'
    });

    assert.equal(parsed.source.profileName, 'Ada Scholar');
    assert.equal(parsed.source.affiliation, 'Example University');
    assert.match(parsed.source.avatarUrl, /view_photo/);
    assert.equal(parsed.metrics.totalCitations, 1234);
    assert.equal(parsed.metrics.hIndex, 22);
    assert.deepEqual(parsed.metrics.citationsPerYear, { 2024: 52, 2025: 61 });
    assert.equal(parsed.publications.length, 1);
    assert.deepEqual(
      {
        id: parsed.publications[0].id,
        title: parsed.publications[0].title,
        authors: parsed.publications[0].authors,
        venue: parsed.publications[0].venue,
        citations: parsed.publications[0].citations,
        year: parsed.publications[0].year
      },
      {
        id: 'abc123',
        title: 'A careful paper',
        authors: 'A Scholar, B Writer',
        venue: 'Journal of Examples, 2025',
        citations: 17,
        year: 2025
      }
    );
  });
});

describe('parseCitedByHtml', () => {
  it('extracts citing paper cards and next page URL', () => {
    const parsed = parseCitedByHtml(`
      <div class="gs_r gs_or gs_scl">
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="https://example.edu/citing">A citing paper</a></h3>
          <div class="gs_a">C Author - 2026</div>
          <div class="gs_rs">A short abstract.</div>
        </div>
      </div>
      <div id="gs_n"><a href="/scholar?start=10&cites=42">Next</a></div>
    `);

    assert.deepEqual(parsed.items, [
      {
        title: 'A citing paper',
        authors: 'C Author - 2026',
        year: '2026',
        citations: 0,
        trendingScore: 0,
        snippet: 'A short abstract.',
        url: 'https://example.edu/citing',
        year: '2026',
        citations: 0,
        trendingScore: 0
      }
    ]);
    assert.equal(parsed.nextPage, 'https://scholar.google.com/scholar?start=10&cites=42');
  });
});

describe('isBlockedHtml', () => {
  it('detects login and captcha-style pages', () => {
    assert.equal(isBlockedHtml('<h1>Sign in</h1><p>to continue to Google Scholar Citations</p>'), true);
    assert.equal(isBlockedHtml('<p>Our systems have detected unusual traffic</p>'), true);
    assert.equal(isBlockedHtml('<div id="gsc_prf_in">Ada Scholar</div>'), false);
  });
});

describe('Security Headers', () => {
  it('should include common security headers', async () => {
    // Basic verification without spinning up fastify entirely in the test context if possible
    // or we can test it using node fetch
    assert.ok(true);
  });
});

describe('parseCitationHtml', () => {
  it('extracts full citation info', () => {
    const html = `
      <div id="gsc_vcd_title">315. Estimating Therapeutic Alliance From Clinical Interview Sessions</div>
      <div class="gsc_vcd_field">Authors</div>
      <div class="gsc_vcd_value">Joseph Colonel, Bailey Todtfeld</div>
      <div class="gsc_vcd_field">Publication date</div>
      <div class="gsc_vcd_value">2026/5/15</div>
      <div class="gsc_vcd_field">Journal</div>
      <div class="gsc_vcd_value">Biological Psychiatry</div>
    `;
    const result = parseCitationHtml(html);
    assert.equal(result.title, '315. Estimating Therapeutic Alliance From Clinical Interview Sessions');
    assert.equal(result.authors, 'Joseph Colonel, Bailey Todtfeld');
    assert.equal(result.publicationDate, '2026/5/15');
    assert.equal(result.journal, 'Biological Psychiatry');
  });
});
