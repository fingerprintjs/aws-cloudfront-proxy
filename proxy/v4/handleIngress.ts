import { CloudFrontRequest, CloudFrontResultResponse } from 'aws-lambda'
import { getBehaviorPathNestLevel, getFpIngressBaseHost } from '../utils/customer-variables/selectors'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import {
  addTrafficMonitoringSearchParamsForProCDN,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
  prepareHeadersForIngressAPI,
} from '../utils'
import { updateResponseHeaders } from './headers'
import { getValidRegion } from '../utils/request'
import { getIngressAPIHost } from '../handlers/handleResult'
import { CDN_PATH } from './paths'
import { generateErrorResponse } from '../utils/generateErrorResponse'

function extractIngressPath(uri: string, behaviorPathNestLevel: number) {
  return uri.split('/').filter(Boolean).slice(behaviorPathNestLevel).join('/')
}

function getRequestBody(incomingRequest: CloudFrontRequest) {
  return incomingRequest.body?.data ? Buffer.from(incomingRequest.body.data, 'base64') : null
}

function handleTrafficMonitoring(requestUrl: URL) {
  if (requestUrl.pathname.includes(CDN_PATH)) {
    addTrafficMonitoringSearchParamsForProCDN(requestUrl)
  } else {
    addTrafficMonitoringSearchParamsForVisitorIdRequest(requestUrl)
  }
}

export async function handleIngress(
  incomingRequest: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  const behaviorPathNestLevel = await getBehaviorPathNestLevel(customerVariables)
  if (!behaviorPathNestLevel) {
    return {
      status: '500',
    }
  }

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

  const requestHeaders = (await prepareHeadersForIngressAPI(
    incomingRequest,
    customerVariables,
    isIngressCall
  )) as HeadersInit

  const requestUrl = new URL(getIngressAPIHost(region, wardenBaseHost))
  requestUrl.pathname = requestPath
  requestUrl.search = incomingRequest.querystring
  // Ensure valid region in query params
  if (requestUrl.searchParams.has('region')) {
    requestUrl.searchParams.set('region', region)
  }

  handleTrafficMonitoring(requestUrl)

  const requestBody = getRequestBody(incomingRequest)

  const ingressRequest = new Request(requestUrl.toString(), {
    method: incomingRequest.method,
    headers: requestHeaders,
    body: requestBody,
  })
  console.debug('Prepared ingress request', {
    requestUrl: ingressRequest.url,
    hasBody: Boolean(requestBody),
    method: ingressRequest.method,
  })

  try {
    const response = await fetch(ingressRequest)

    const contentType = response.headers.get('content-type')
    const isJavascript = contentType?.includes('text/javascript')

    const updatedResponseHeaders = updateResponseHeaders(response.headers, isJavascript)

    const responseBody = await response.text()

    console.debug('Ingress response', {
      status: response.status,
      statusText: response.statusText,
      rawHeaders: response.headers,
      headers: updatedResponseHeaders,
      body: responseBody,
      isJavascript,
    })

    return {
      status: response.status.toString(),
      statusDescription: response.statusText,
      headers: updatedResponseHeaders,
      bodyEncoding: 'text',
      body: responseBody,
    }
  } catch (error) {
    // This should be triggered only on network or timeout errors
    // `fetch` doesn't throw errors based on response status code
    return {
      status: '500',
      statusDescription: 'Bad request',
      headers: {},
      bodyEncoding: 'text',
      body: generateErrorResponse(error instanceof Error ? error : new Error(String(error))),
    }
  }
}
