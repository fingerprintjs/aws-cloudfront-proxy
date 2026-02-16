import { CloudFrontRequest, CloudFrontResultResponse } from 'aws-lambda'
import { getBehaviorPathNestLevel, getFpIngressBaseHost } from '../utils/customer-variables/selectors'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import {
  addTrafficMonitoringSearchParamsForProCDN,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  prepareHeadersForIngressAPI,
} from '../utils'
import { getValidRegion } from '../utils/request'
import { getIngressAPIHost } from '../handlers/handleResult'
import { CDN_PATH } from './paths'
import { sendIngressRequest } from './transport'

function extractIngressPath(uri: string, behaviorPathNestLevel: number) {
  return uri.split('/').filter(Boolean).slice(behaviorPathNestLevel).join('/')
}

function handleTrafficMonitoring(requestUrl: URL, requestMethod: string) {
  if (requestUrl.pathname.includes(CDN_PATH)) {
    addTrafficMonitoringSearchParamsForProCDN(requestUrl)
    // Add traffic monitoring only for POST ingress, skip browser cache
  } else if (requestMethod === 'POST') {
    addTrafficMonitoringSearchParamsForVisitorIdRequest(requestUrl)
  }
}

export async function handleIngress(
  incomingRequest: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  const behaviorPathNestLevel = await getBehaviorPathNestLevel(customerVariables)

  const wardenBaseHost = await getFpIngressBaseHost(customerVariables)
  if (!wardenBaseHost) {
    return {
      status: '500',
    }
  }

  const requestUrlParams = new URLSearchParams(incomingRequest.querystring)
  const region = getValidRegion(requestUrlParams.get('region'))

  const requestPath = extractIngressPath(incomingRequest.uri, behaviorPathNestLevel)

  const isIngressCall = incomingRequest.method === 'POST'

  const requestHeaders = await prepareHeadersForIngressAPI(incomingRequest, customerVariables, isIngressCall)

  const requestUrl = new URL(getIngressAPIHost(region, wardenBaseHost))
  requestUrl.pathname = requestPath
  requestUrl.search = incomingRequest.querystring
  // Ensure valid region in query params
  if (requestUrl.searchParams.has('region')) {
    requestUrl.searchParams.set('region', region)
  }

  handleTrafficMonitoring(requestUrl, incomingRequest.method)

  return sendIngressRequest(incomingRequest, requestHeaders, requestUrl)
}
