## 2024-05-18 - Fix XSS vulnerability in URL parsing
**Vulnerability:** A weak `.startsWith("javascript:")` check was used to sanitize URLs. This can be easily bypassed by using mixed casing (e.g., `jAvAsCrIpT:alert(1)`) or other schemes like `data:text/html,...`.
**Learning:** Checking for specific disallowed patterns (denylist) is generally flawed and prone to bypasses, especially in URLs where the browser parsing engine normalizes inputs differently.
**Prevention:** Always use a robust, allowlist-based approach using the native `URL` parser and explicitly check `url.protocol` against safe protocols (`http:`, `https:`).

## 2026-06-13 - Prevent SSRF in fetch requests
**Vulnerability:** fetch requests that allow following redirects can be vulnerable to Server-Side Request Forgery (SSRF) if the target server has an open redirect vulnerability that can target internal network endpoints.
**Learning:** Default behavior of fetch is to follow redirects transparently, making it a powerful tool for attackers to bypass network boundaries.
**Prevention:** Explicitly set `redirect: 'error'` or `redirect: 'manual'` in fetch options when making requests to untrusted or potentially compromised servers to prevent automated redirection.
