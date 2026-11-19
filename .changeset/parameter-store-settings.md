---
'@fingerprint/aws-cloudfront-proxy': major
---

Read integration settings and the management token from SSM Parameter Store instead of Secrets Manager. The proxy now loads every parameter under the path given in the `FPJS_PARAMETER_PATH` origin header; the pre-shared secret is stored as a `SecureString`.
