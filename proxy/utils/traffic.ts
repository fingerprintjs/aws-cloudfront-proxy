import { INGRESS_CDN_PATH } from './paths'

// This is replaced during build with the actual lambda version
const LAMBDA_FUNC_VERSION = '__lambda_func_version__'
const PARAM_NAME = 'ii'

/**
 * Appends traffic monitoring search parameters specific to ProCDN to a given URL.
 *
 * @param {URL} url - The URL object to which the traffic monitoring parameters will be added.
 */
export function addTrafficMonitoringSearchParamsForProCDN(url: URL) {
  url.searchParams.append(PARAM_NAME, getTrafficMonitoringValue('procdn'))
}

/**
 * Appends traffic monitoring search parameters to the given URL for a visitor's ID.
 *
 * @param {URL} url - The URL object to which the traffic monitoring search parameters will be added.
 */
export function addTrafficMonitoringSearchParamsForVisitorIdRequest(url: URL) {
  url.searchParams.append(PARAM_NAME, getTrafficMonitoringValue('ingress'))
}

/**
 * Generates a traffic monitoring value based on the provided type.
 *
 * @param {('procdn' | 'ingress')} type - The type of traffic source for which the value is generated.
 * @return {string} The formatted traffic monitoring value specific to the given type.
 */
function getTrafficMonitoringValue(type: 'procdn' | 'ingress'): string {
  return `fingerprintjs-pro-cloudfront/${LAMBDA_FUNC_VERSION}/${type}`
}
/**
 * Handles traffic monitoring by appending appropriate search parameters to the provided URL
 * based on the request's path and method.
 *
 * @param {URL} requestUrl - The URL of the incoming request to be monitored.
 * @param {string} requestMethod - The HTTP method of the request, such as 'GET' or 'POST'.
 */
export function handleTrafficMonitoring(requestUrl: URL, requestMethod: string) {
  if (requestUrl.pathname.includes(INGRESS_CDN_PATH)) {
    addTrafficMonitoringSearchParamsForProCDN(requestUrl)
    // Add traffic monitoring only for POST ingress, skip browser cache
  } else if (requestMethod === 'POST') {
    addTrafficMonitoringSearchParamsForVisitorIdRequest(requestUrl)
  }
}
