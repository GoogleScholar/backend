## 2026-06-16 - Unbounded Outbound Request Concurrency
**Vulnerability:** Denial of Service (DoS) vulnerability via memory and connection exhaustion. The `pendingRequests` Map tracked concurrent outbound requests to the Google Scholar origin without any upper limit.
**Learning:** Even with caching in place, uncached or unique endpoints can cause unmitigated request bursts, leading to unbounded memory growth on the server and upstream IP blocks.
**Prevention:** Always set an explicit concurrency limit or queue for upstream outbound requests to fail securely (e.g., throwing a 429 status code) when the limit is exceeded.

## 2026-06-17 - Node.js Fetch Default Redirect Follow
**Vulnerability:** Server-Side Request Forgery (SSRF) and Information Disclosure risk. The native `fetch` API in Node.js follows redirects by default (`redirect: "follow"`). When fetching user-influenced URLs or domains that might return redirects, this can be exploited to access internal networks, bypass validation, or perform SSRF attacks. Additionally, the network error details were leaked to the client.
**Learning:** Even if a URL is strictly validated, the remote server might redirect to a malicious or internal destination. The native Node.js `fetch` behaves like browsers and follows these redirects transparently.
**Prevention:** Always explicitly set `redirect: "manual"` (or `"error"`) in `fetch` options when requesting resources from potentially untrusted endpoints or domains where open redirects may exist. Never leak low-level network errors to the client.
