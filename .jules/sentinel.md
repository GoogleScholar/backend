## 2026-06-16 - Unbounded Outbound Request Concurrency
**Vulnerability:** Denial of Service (DoS) vulnerability via memory and connection exhaustion. The `pendingRequests` Map tracked concurrent outbound requests to the Google Scholar origin without any upper limit.
**Learning:** Even with caching in place, uncached or unique endpoints can cause unmitigated request bursts, leading to unbounded memory growth on the server and upstream IP blocks.
**Prevention:** Always set an explicit concurrency limit or queue for upstream outbound requests to fail securely (e.g., throwing a 429 status code) when the limit is exceeded.
