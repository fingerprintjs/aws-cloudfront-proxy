import { CloudFrontRequest, CloudFrontResultResponse } from 'aws-lambda'
import { getBehaviorPathNestLevel, getFpIngressBaseHost } from '../utils/customer-variables/selectors'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { prepareHeadersForIngressRequest } from '../utils'
import { getValidRegion } from '../utils/request'
import { INGRESS_CDN_PATH, extractIngressPath, getV3AgentPath, getIngressAPIHost } from '../utils/paths'
import { sendIngressRequest } from '../utils/transport'
import { handleTrafficMonitoring } from '../utils/traffic'
import { Region } from '../model'

export type RequestType = 'agentV3' | 'ingressV3' | 'v4'

export function createIngressHandler(requestType: RequestType) {
  return (
    incomingRequest: CloudFrontRequest,
    customerVariables: CustomerVariables,
    pathMatches: RegExpMatchArray | undefined
  ) => handleIngress(incomingRequest, customerVariables, pathMatches, requestType)
}

/**
 * Processes a query string and appends the parameters to the URL's search params,
 * replacing the value of the "region" parameter if found.
 *
 * @param {string} queryString - The query string containing key-value pairs to be processed.
 * @param {URL} url - The URL object to which the search parameters will be appended.
 * @param {Region} region - The region value to insert or replace in the query string.
 */
function setupSearchParams(queryString: string, url: URL, region: Region) {
  decodeURIComponent(queryString)
    .split('&')
    .filter((it) => it.includes('='))
    .forEach((it) => {
      const kv = it.split('=')
      if (kv[0] === 'region') {
        kv[1] = region
      }
      url.searchParams.append(kv[0], kv[1])
    })
}

/**
 * Handles an ingress request by preparing the request's path, headers, and forwarding it to the appropriate API destination.
 *
 * @param {CloudFrontRequest} incomingRequest - The incoming request object provided by CloudFront, containing details such as URI, method, and query string.
 * @param {CustomerVariables} customerVariables - Configuration and settings specific to the customer, used to determine handling behavior.
 * @param {RegExpMatchArray | undefined} pathMatches - A regular expression match array for the request path, used to extract specific components of the path.
 * @param {RequestType} requestType - The type of request to handle, which governs behavior such as path handling and endpoint resolution.
 * @return {Promise<CloudFrontResultResponse>} A Promise resolving to the resulting CloudFront response after forwarding the request to the target API endpoint.
 */
async function handleIngress(
  incomingRequest: CloudFrontRequest,
  customerVariables: CustomerVariables,
  pathMatches: RegExpMatchArray | undefined,
  requestType: RequestType
): Promise<CloudFrontResultResponse> {
  // In V4, we need to leverage the new behavior path nest level variable to figure out the path for the ingress request
  const useBehaviorPathNestLevel = requestType === 'v4'
  const behaviorPathNestLevel = useBehaviorPathNestLevel ? await getBehaviorPathNestLevel(customerVariables) : 0

  const wardenBaseHost = await getFpIngressBaseHost(customerVariables)
  if (!wardenBaseHost) {
    return {
      status: '500',
    }
  }

  const requestUrlParams = new URLSearchParams(incomingRequest.querystring)
  const region = getValidRegion(requestUrlParams.get('region'))

  let suffix = ''

  switch (requestType) {
    // For V3 request, we need to prepend the INGRESS_CDN_PATH to the request path
    case 'agentV3':
      suffix = `${INGRESS_CDN_PATH}/${getV3AgentPath(requestUrlParams)}`
      break

    // For V4 request, we just use the path from incoming request and leverage the behavior path nest level
    case 'v4':
      suffix = incomingRequest.uri
      break

    default:
      // For the rest, so the "ingressV3" request, we'll extract path using path matches. It's an approach that was used in the old ingress handler.
      if (pathMatches && pathMatches.length >= 1) {
        suffix = pathMatches[1] ?? ''
      }
  }

  const requestPath = extractIngressPath(suffix, behaviorPathNestLevel)

  const isIngressCall = incomingRequest.method === 'POST'

  const requestHeaders = await prepareHeadersForIngressRequest(incomingRequest, customerVariables, isIngressCall)

  const requestUrl = new URL(getIngressAPIHost(region, wardenBaseHost))
  requestUrl.pathname = requestPath
  setupSearchParams(incomingRequest.querystring, requestUrl, region)
  handleTrafficMonitoring(requestUrl, incomingRequest.method)

  return sendIngressRequest(incomingRequest, requestHeaders, requestUrl)
}
