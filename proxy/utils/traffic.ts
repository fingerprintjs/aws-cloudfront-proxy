// This is replaced during build with the actual lambda version
const LAMBDA_FUNC_VERSION = '__lambda_func_version__'
const PARAM_NAME = 'ii'

/**
 * Appends traffic monitoring search parameters to the given URL.
 *
 * @param {URL} url - The URL object to which the traffic monitoring search parameters will be added.
 */
export function addTrafficMonitoring(url: URL) {
  url.searchParams.append(PARAM_NAME, getTrafficMonitoringValue())
}

/**
 * Generates a traffic monitoring value based on the provided type.
 *
 * @return {string} The formatted traffic monitoring value
 */
function getTrafficMonitoringValue(): string {
  return `fingerprintjs-pro-cloudfront/${LAMBDA_FUNC_VERSION}/ingress`
}
