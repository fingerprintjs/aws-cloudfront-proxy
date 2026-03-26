import { CloudFrontHeaders, CloudFrontRequest } from 'aws-lambda'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { filterCookie } from './cookie'
import { updateCacheControlHeader } from './cache-control'
import { CustomerVariables } from './customer-variables/customer-variables'
import { getPreSharedSecret } from './customer-variables/selectors'
import { TTLCache } from './cache'

export const BLACKLISTED_HEADERS = new Set([
  'age',
  'connection',
  'expect',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'trailer',
  'upgrade',
  'x-accel-buffering',
  'x-accel-charset',
  'x-accel-limit-rate',
  'x-accel-redirect',
  'x-amzn-auth',
  'x-amzn-cf-billing',
  'x-amzn-cf-id',
  'x-amzn-cf-xff',
  'x-amzn-errortype',
  'x-amzn-fle-profile',
  'x-amzn-header-count',
  'x-amzn-header-order',
  'x-amzn-lambda-integration-tag',
  'x-amzn-requestid',
  'x-cache',
  'x-forwarded-proto',
  'x-real-ip',
  'strict-transport-security',
])

export const BLACKLISTED_HEADERS_PREFIXES = ['x-edge-', 'x-amz-cf-']

const READ_ONLY_RESPONSE_HEADERS = new Set([
  'accept-encoding',
  'content-length',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'if-unmodified-since',
  'transfer-encoding',
  'via',
])

const READ_ONLY_REQUEST_HEADERS = new Set(['content-length', 'host', 'transfer-encoding', 'via'])

export const CACHE_CONTROL_HEADER_NAME = 'cache-control'

/**
 * Prepares the headers for an ingress request by filtering incoming request headers
 * and appending necessary custom headers based on the provided parameters.
 *
 * @param {CloudFrontRequest} request - The incoming request object from CloudFront, containing headers and client-related information.
 * @param {CustomerVariables} variables - The customer-specific variables required for fetching the pre-shared secret.
 * @param {boolean} isAuthorisedMethodCall - A flag indicating whether the request method is for authorised request (only POST for now).
 * @return {Promise<OutgoingHttpHeaders>} A promise that resolves to an object containing the modified headers for the request.
 */
export async function prepareHeadersForIngressRequest(
  request: CloudFrontRequest,
  variables: CustomerVariables,
  isAuthorisedMethodCall: boolean
): Promise<OutgoingHttpHeaders> {
  if (!isAuthorisedMethodCall) {
    return filterRequestHeaders(request, true)
  }
  const headers = filterRequestHeaders(request)

  headers['fpjs-proxy-client-ip'] = request.clientIp
  const preSharedSecret = await getPreSharedSecret(variables)
  if (preSharedSecret) {
    headers['fpjs-proxy-secret'] = preSharedSecret
  }
  headers['fpjs-proxy-forwarded-host'] = getHost(request)

  return headers
}

export const getHost = (request: CloudFrontRequest) => request.headers['host'][0].value

/**
 * Filters request headers to allow only permitted headers for outgoing requests.
 * Optionally drops all cookies or filters specific cookies based on a condition.
 *
 * @param {CloudFrontRequest} request - The original CloudFront request containing headers.
 * @param {boolean} [dropCookies=false] - A flag to determine whether to remove all cookies from the headers.
 * @return {OutgoingHttpHeaders} An object containing the filtered headers to be sent with the outgoing request.
 */
export function filterRequestHeaders(request: CloudFrontRequest, dropCookies: boolean = false): OutgoingHttpHeaders {
  return Object.entries(request.headers).reduce((result: { [key: string]: string }, [name, value]) => {
    const headerName = name.toLowerCase()
    if (dropCookies) {
      if (headerName === 'cookie') {
        return result
      }
    }

    // Lambda@Edge function can't add read-only headers from a client request to Ingress API request
    if (isHeaderAllowedForRequest(headerName)) {
      let headerValue = value[0].value
      if (headerName === 'cookie') {
        headerValue = headerValue.split(/; */).join('; ')
        headerValue = filterCookie(headerValue, (key) => key === '_iidt')
      }

      result[headerName] = headerValue
    }
    return result
  }, {})
}

/**
 * Updates the response headers based on the provided headers object and an optional flag to override the Cache-Control header.
 *
 * @param {IncomingHttpHeaders} headers - The incoming HTTP headers from the request. These are processed to generate the response headers.
 * @param {boolean} [overrideCacheControl=false] - A flag indicating whether to override the Cache-Control header if it exists. Defaults to `false`.
 * @return {CloudFrontHeaders} The updated headers formatted as CloudFront-compatible response headers.
 */
export function updateResponseHeaders(
  headers: IncomingHttpHeaders,
  overrideCacheControl: boolean = false
): CloudFrontHeaders {
  const resultHeaders: CloudFrontHeaders = {}

  for (const [key, value] of Object.entries(headers)) {
    // Lambda@Edge function can't add read-only headers to response to CloudFront
    // So, such headers from IngressAPI response are filtered out before return the response to CloudFront
    if (!isHeaderAllowedForResponse(key)) {
      continue
    }

    if (overrideCacheControl && key == CACHE_CONTROL_HEADER_NAME && typeof value === 'string') {
      resultHeaders[CACHE_CONTROL_HEADER_NAME] = [
        {
          key: CACHE_CONTROL_HEADER_NAME,
          value: updateCacheControlHeader(value),
        },
      ]
    } else if (value) {
      resultHeaders[key] = [
        {
          key: key,
          value: value.toString(),
        },
      ]
    }
  }

  return resultHeaders
}

/**
 * Determines whether a given header is allowed to be used in a request.
 * Checks against a list of read-only headers, blacklisted headers,
 * as well as headers with specific blacklisted prefixes.
 *
 * @param {string} headerName - The name of the header to check.
 * @return {boolean} Returns true if the header is allowed, otherwise false.
 */
function isHeaderAllowedForRequest(headerName: string): boolean {
  if (READ_ONLY_REQUEST_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
    return false
  }
  for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
    if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
      return false
    }
  }
  return true
}

/**
 * Determines whether a given header name is allowed to be included in the response.
 *
 * The method checks against a set of read-only or blacklisted headers, as well as headers
 * that start with specific blacklisted prefixes, to decide if the header is permitted.
 *
 * @param {string} headerName - The name of the header to be checked.
 * @return {boolean} Returns true if the header is allowed, otherwise false.
 */
export function isHeaderAllowedForResponse(headerName: string): boolean {
  if (READ_ONLY_RESPONSE_HEADERS.has(headerName) || BLACKLISTED_HEADERS.has(headerName)) {
    return false
  }
  for (let i = 0; i < BLACKLISTED_HEADERS_PREFIXES.length; i++) {
    if (headerName.startsWith(BLACKLISTED_HEADERS_PREFIXES[i])) {
      return false
    }
  }
  return true
}

/**
 * Extracts the origin information from the CloudFront request headers.
 *
 * @param {Object} params - The parameters object.
 * @param {CloudFrontRequest} params.origin - The origin information from the CloudFront request.
 */
export function getOriginForHeaders({ origin }: CloudFrontRequest) {
  if (origin?.s3) {
    return origin.s3
  }

  return origin?.custom
}

/**
 * Retrieves the value of a specified header from the custom headers of a CloudFront request.
 *
 * @param {CloudFrontRequest} request - The CloudFront request object containing the headers.
 * @param {string} name - The name of the header to retrieve the value for.
 * @return {string|null} The value of the specified header if it exists, or null if the header is not found.
 */
export function getHeaderValue(request: CloudFrontRequest, name: string): string | null {
  const origin = getOriginForHeaders(request)
  const headers = origin?.customHeaders

  if (!headers?.[name]) {
    return null
  }
  return headers[name][0].value
}

/**
 * Retrieves the secret cache time-to-live (TTL) value in milliseconds from the request headers.
 *
 * @param {CloudFrontRequest} request - The CloudFront request object containing headers.
 * @return {number|undefined} The parsed TTL value in milliseconds if present and valid; otherwise, undefined.
 */
export function getSecretCacheTtlMs(request: CloudFrontRequest): number | undefined {
  const value = getHeaderValue(request, 'fpjs_proxy_secret_cache_ttl_ms')

  if (value) {
    const parsedValue = parseInt(value, 10)
    if (TTLCache.isValidTTL(parsedValue)) {
      return parsedValue
    }
  }

  return undefined
}
