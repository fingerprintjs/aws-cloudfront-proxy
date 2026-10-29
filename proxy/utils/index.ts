import { filterRequestHeaders, getHost, prepareHeadersForIngressRequest, updateResponseHeaders } from './headers'
import { getApiKey, getLoaderVersion, getRegion, getVersion } from './request'
import { addTrafficMonitoring } from './traffic'
import { getAgentUri, getResultUri, getStatusUri } from './customer-variables/selectors'
import {
  addEndingTrailingSlashToRoute,
  addPathnameMatchBeforeRoute,
  addTrailingWildcard,
  createRoute,
  removeTrailingSlashesAndMultiSlashes,
  replaceDot,
} from './routing'
import { setLogLevel } from './log'
import { generateRandom } from './string'

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
