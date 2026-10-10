---
'@fingerprint/aws-cloudfront-proxy': patch
---

Pass the origin's `Cache-Control` for the agent through as it is. The proxy no longer caps `max-age` at 3600 or injects `s-maxage=60`, so the browser cache lifetime follows the origin. CloudFront derives its edge TTL from the origin directives subject to the cache policy's limits, and uses the policy default when the origin sends no cache lifetime. Strip the upstream `Cache-Tag` header, which carries the upstream CDN's purge tag and an API-key-derived hash.
