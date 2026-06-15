## 2024-05-24 - Thundering Herd Problem in External Scraping
**Learning:** When fetching data from an external source that blocks excessive requests (like Google Scholar), missing request collapsing (promise memoization) can lead to a thundering herd problem. If multiple users request the exact same uncached URL simultaneously, the backend will make multiple concurrent requests to the external service. This is especially risky and can quickly lead to an IP ban or CAPTCHA block from the scraper target.
**Action:** Always implement request collapsing (storing the active promise of a fetch in a `Map` by cache key) alongside traditional caching when scraping or calling rate-limited external APIs, so that concurrent requests for the same resource await the single in-flight promise rather than duplicating the external network call.

## 2024-06-13 - [Performance] Regex vs Full-String Operations on Large HTML
**Learning:** Performing full-string operations like `replace(/\s+/g, ' ')` and `toLowerCase()` on large HTML strings (e.g., 200KB-500KB scraper responses) before doing substring checks causes immense memory allocation and CPU overhead.
**Action:** Always use precompiled regular expressions (like `/substring/i`) for checking blocklists or keywords in raw HTTP responses rather than normalizing the entire string first. This resulted in a >10x speed improvement in scraper check operations.
## 2023-10-27 - Cheerio Array Allocation Overhead
**Learning:** In a hot loop extracting data from Cheerio DOM arrays (like `$('.gs_gray').map().get()`), the map/get combination creates unnecessary array allocations. Using direct `.eq(0)` and `.eq(1)` to fetch elements is consistently 10-15% faster for node access in repeated parsing tasks.
**Action:** Always prefer `.eq(index)` or direct selector narrowing over `.map().get()` when extracting a small, fixed number of elements inside a Cheerio loop.
