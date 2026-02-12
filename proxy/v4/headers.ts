import { CloudFrontHeaders } from 'aws-lambda'
import { updateCacheControlHeader } from '../utils/cache-control'
import { CACHE_CONTROL_HEADER_NAME, isHeaderAllowedForResponse } from '../utils/headers'

export function updateResponseHeaders(headers: Headers, overrideCacheControl = false): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {}

  for (const [key, value] of headers.entries()) {
    // Lambda@Edge function can't add read-only headers to response to CloudFront
    // So, such headers from IngressAPI response are filtered out before return the response to CloudFront
    if (!isHeaderAllowedForResponse(key)) {
      continue
    }

    if (overrideCacheControl && key == CACHE_CONTROL_HEADER_NAME) {
      resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
        {
          key: CACHE_CONTROL_HEADER_NAME,
          value: updateCacheControlHeader(value),
        },
      ]
    } else if (value) {
      resultHeaders[key] = [
        {
          key,
          value: value.toString(),
        },
      ]
    }
  }

  return resultHeaders
}
