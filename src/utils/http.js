export const blockedHtmlRegex = /our\s+systems\s+have\s+detected\s+unusual\s+traffic|to\s+continue\s+to\s+google\s+scholar\s+citations|please\s+show\s+you|recaptcha/i;

export function isBlockedHtml(html) {
  return blockedHtmlRegex.test(html);
}

export async function fetchScholarHtml(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (compatible; GoogleScholarBackend/1.0; +https://github.com/GoogleScholar/backend)'
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'manual'
    });
  } catch (err) {
    // Security: Do not leak specific network error details to the client
    const error = new Error('Failed to fetch from Google Scholar.');
    error.cause = err;
    error.statusCode = 502;
    error.stack = err.stack;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Google Scholar request failed with ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const html = await response.text();
  if (isBlockedHtml(html)) {
    const error = new Error('Google Scholar returned a login, captcha, or blocking page.');
    error.statusCode = 503;
    throw error;
  }

  return html;
}
