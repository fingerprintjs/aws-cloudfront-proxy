import { filterRequestHeaders, getHost, prepareHeadersForIngressRequest, updateResponseHeaders } from './headers.ts'
import { getApiKey, getLoaderVersion, getRegion, getVersion } from './request.ts'
import { addTrafficMonitoring } from './traffic.ts'
import { getAgentUri, getResultUri, getStatusUri } from './customer-variables/selectors.ts'
import {
  addEndingTrailingSlashToRoute,
  addPathnameMatchBeforeRoute,
  addTrailingWildcard,
  createRoute,
  removeTrailingSlashesAndMultiSlashes,
  replaceDot,
} from './routing.ts'
import { setLogLevel } from './log.ts'
import { generateRandom } from './string.ts'

export {
  getAgentUri,
  getResultUri,
  getStatusUri,
  filterRequestHeaders,
  updateResponseHeaders,
  prepareHeadersForIngressRequest,
  getHost,
  getApiKey,
  getLoaderVersion,
  getVersion,
  getRegion,
  addTrafficMonitoring,
  removeTrailingSlashesAndMultiSlashes,
  addTrailingWildcard,
  replaceDot,
  createRoute,
  addPathnameMatchBeforeRoute,
  addEndingTrailingSlashToRoute,
  setLogLevel,
  generateRandom,
}
