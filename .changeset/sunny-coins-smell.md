---
'@fingerprint/aws-cloudfront-proxy': minor
---

Add `lambda:InvokeFunction` to the management function.

Starting from October 2025, AWS requires new function URLs to have this permissions alongside the `lambda:InvokeFunctionUrl`.
See https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html to learn more.