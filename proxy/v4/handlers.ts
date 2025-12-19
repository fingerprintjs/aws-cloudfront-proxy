import type { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { CustomerVariables } from '../utils/customer-variables/customer-variables'
import { CloudFrontResultResponse } from 'aws-lambda'
import { getFpCdnUrl, getFpIngressBaseHost } from '../utils/customer-variables/selectors'
import { handleResult } from '../handlers'
import { filterRequestHeaders, getRegion, prepareHeadersForIngressAPI } from '../utils'
import { downloadAgent } from './downloadAgent'

export async function handleIngress(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  const uri = request.uri
  const segments = uri.split('/').filter((s) => s.length > 0)

  let suffix = ''

  // If there's more than one segment, join everything after the first
  // TODO This is not ideal, as it won't work for more complex behavior paths.
  // E.g, it will work for `/fpjs/0zDYhBT/o6Kgn` -> the extracted path will be `/0zDYhBT/o6Kgn`
  // But it won't work for `/my/behavior/path/0zDYhBT/o6Kgn -> it will extract `/behavior/path/0zDYhBT/o6Kgn`.
  // Possible solution: extracting only last two path segments that we know are used by browser cache endpoint, otherwise skipping path all-together for ingress endpoint?
  if (segments.length > 1) {
    suffix = '/' + segments.slice(1).join('/')
  }

  const fpIngressBaseHost = await getFpIngressBaseHost(customerVariables)

  if (!fpIngressBaseHost) {
    return {
      status: '500',
    }
  }

  const isIngressCall = !suffix.length

  return handleResult({
    fpIngressBaseHost,
    region: getRegion(request),
    querystring: request.querystring,
    method: request.method,
    headers: await prepareHeadersForIngressAPI(request, customerVariables, isIngressCall),
    body: request.body?.data || '',
    suffix,
  })
}

export async function handleCDN(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables,
  matches: RegExpMatchArray | undefined
): Promise<CloudFrontResultResponse> {
  const agentPath = matches?.[1] ?? ''
  const fpCdnUrl = await getFpCdnUrl(customerVariables)
  if (!fpCdnUrl) {
    return new Promise((resolve) =>
      resolve({
        status: '500',
      })
    )
  }

  return downloadAgent({
    fpCdnUrl,
    querystring: request.querystring,
    path: agentPath,
    method: request.method,
    headers: filterRequestHeaders(request, true),
  })
}
