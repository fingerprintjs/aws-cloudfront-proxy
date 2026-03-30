import { CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda'

import { createRoute, generateRandom, getAgentUri, getResultUri, getStatusUri, setLogLevel } from './utils'
import { CustomerVariables } from './utils/customer-variables/customer-variables'
import { HeaderCustomerVariables } from './utils/customer-variables/header-customer-variables'
import { SecretsManagerVariables } from './utils/customer-variables/secrets-manager/secrets-manager-variables'
import type { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { createIngressHandler } from './handlers/handleIngress'
import { handleStatus } from './handlers/handleStatus'
import { V4_INGRESS_PATH } from './utils/paths'
import { getSecretCacheTtlMs } from './utils/headers'

export type Route = {
  pathPattern: RegExp
  handler: (
    request: CloudFrontRequest,
    customerVariables: CustomerVariables,
    routeMatchArray: RegExpMatchArray | undefined
  ) => Promise<CloudFrontResultResponse>
}

async function createRoutes(customerVariables: CustomerVariables): Promise<Route[]> {
  const routes: Route[] = []

  const agentUri = await getAgentUri(customerVariables)
  if (agentUri) {
    routes.push({
      pathPattern: createRoute(agentUri),
      handler: createIngressHandler('agentV3'),
    })
  }

  const resultUri = await getResultUri(customerVariables)
  if (resultUri) {
    routes.push({
      pathPattern: createRoute(resultUri),
      handler: createIngressHandler('ingressV3'),
    })
  }

  const statusRoute: Route = {
    pathPattern: createRoute(getStatusUri()),
    handler: (request, env) => handleStatusPage(request, env),
  }

  routes.push(statusRoute)
  // For V4, proxy all remaining routes through Warden (CDN + Ingress)
  routes.push({
    pathPattern: createRoute(V4_INGRESS_PATH),
    handler: createIngressHandler('v4'),
  })

  return routes
}

function handleStatusPage(
  _: CloudFrontRequest,
  customerVariables: CustomerVariables
): Promise<CloudFrontResultResponse> {
  return handleStatus(customerVariables, generateRandom())
}

export const handler = async (event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> => {
  const request = event.Records[0].cf.request
  setLogLevel(request)

  const customerVariables = new CustomerVariables([
    new SecretsManagerVariables(request, getSecretCacheTtlMs(request)),
    new HeaderCustomerVariables(request),
  ])

  console.debug('Handling request', request)

  const routes = await createRoutes(customerVariables)
  return handleRequestWithRoutes(request, customerVariables, routes)
}

export function handleRequestWithRoutes(
  request: CloudFrontRequest,
  customerVariables: CustomerVariables,
  routes: Route[]
): Promise<CloudFrontResultResponse> {
  for (const route of routes) {
    const matches = request.uri.match(route.pathPattern)
    if (matches) {
      return route.handler(request, customerVariables, matches)
    }
  }

  return handleNoMatch()
}

function handleNoMatch(): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) =>
    resolve({
      status: '404',
    })
  )
}
