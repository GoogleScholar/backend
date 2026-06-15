## 2026-06-15 - Add Defense-in-Depth Security Headers
**Vulnerability:** Missing security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS). The application was potentially vulnerable to clickjacking, MIME sniffing, and insecure connections.
**Learning:** Fastify applications need explicit hook implementations (or dedicated plugins like @fastify/helmet) to add essential security headers, as they are not included by default.
**Prevention:** Always implement an `onRequest` hook or use standard middleware/plugins to inject `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, and `Strict-Transport-Security` headers to all responses.
