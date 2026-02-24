import { Region } from '../model'

// In V4, the ingress path is the root path
export const V4_INGRESS_PATH = '/.*'

// Path used for CDN request in ingress
export const INGRESS_CDN_PATH = 'web'

/**
 * Constructs the endpoint URL for the agent based on the provided query parameters.
 *
 * @param {URLSearchParams} params - The query parameters containing information such as `apiKey`, `loaderVersion`, and `version`.
 *                                  - `apiKey`: The API key used to identify the agent (default is an empty string if not provided).
 *                                  - `loaderVersion`: The version of the loader, if provided, it is included in the endpoint path.
 *                                  - `version`: The API version to use; defaults to '3' if not specified.
 * @return {string} The constructed URL for the agent endpoint.
 */
export function getV3AgentPath(params: URLSearchParams): string {
  const apiKey = params.get('apiKey') ?? ''
  const loaderVersion = params.get('loaderVersion')
  const version = params.get('version') ?? '3'

  const lv: string = loaderVersion ? `/loader_v${loaderVersion}.js` : ''
  return `/v${version}/${apiKey}${lv}`
}

/**
 * Constructs the full ingress API host URL based on the specified region and base host.
 *
 * @param {Region} region - The region to determine the appropriate API host prefix.
 * @param {string} baseHost - The base host domain of the API.
 * @return {string} The constructed API host URL.
 */
export function getIngressAPIHost(region: Region, baseHost: string): string {
  const prefix = region === Region.us ? '' : `${region}.`
  return `https://${prefix}${baseHost}`
}

/**
 * Splits a given URI into its individual path segments, excluding empty segments.
 *
 * @param {string} uri - The URI to be split into segments.
 * @return {string[]} An array of non-empty path segments derived from the URI.
 */
export function getPathSegments(uri: string): string[] {
  return uri.split('/').filter(Boolean)
}

/**
 * Extracts the ingress path from the given URI by removing a specified number of path segments from the start.
 *
 * @param {string} uri - The input URI from which the ingress path is extracted.
 * @param {number} behaviorPathNestLevel - The number of nesting levels to remove from the beginning of the path.
 * @return {string} The resulting ingress path segments after removing the specified number of path segments.
 */
export function extractIngressPath(uri: string, behaviorPathNestLevel: number): string[] {
  return getPathSegments(uri).slice(behaviorPathNestLevel)
}
