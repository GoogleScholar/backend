## 2024-05-18 - Fix XSS vulnerability in URL parsing
**Vulnerability:** A weak `.startsWith("javascript:")` check was used to sanitize URLs. This can be easily bypassed by using mixed casing (e.g., `jAvAsCrIpT:alert(1)`) or other schemes like `data:text/html,...`.
**Learning:** Checking for specific disallowed patterns (denylist) is generally flawed and prone to bypasses, especially in URLs where the browser parsing engine normalizes inputs differently.
**Prevention:** Always use a robust, allowlist-based approach using the native `URL` parser and explicitly check `url.protocol` against safe protocols (`http:`, `https:`).
