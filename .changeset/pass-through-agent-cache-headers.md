---
'@fingerprint/aws-cloudfront-proxy': patch
---

Pass the origin's `Cache-Control` for the agent through as it is. The proxy no longer caps `max-age` at 3600 or injects `s-maxage=60`, so both the browser cache lifetime and the CloudFront edge TTL follow the origin. The edge TTL is now set by the CloudFront cache policy when the origin sends no `s-maxage`. Strip the upstream `Cache-Tag` header, which carries the upstream CDN's purge tag and an API-key-derived hash.
