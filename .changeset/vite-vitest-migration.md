---
'@fingerprint/aws-cloudfront-proxy': patch
---

Migrate the build from Rollup to Vite and the test runner from Jest to Vitest. No functional or behavioral change; the shipped Lambda bundles keep the same CJS shape, named exports, and build-time constant substitution
