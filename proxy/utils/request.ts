import { CloudFrontRequest } from 'aws-lambda'
import { Region } from '../model'

export const getApiKey = (request: CloudFrontRequest): string | undefined => getQueryParameter(request, 'apiKey')

export const getVersion = (request: CloudFrontRequest): string => {
  const version = getQueryParameter(request, 'version')
  return version ?? '3'
}

export const getLoaderVersion = (request: CloudFrontRequest): string | undefined =>
  getQueryParameter(request, 'loaderVersion')

export const getRegion = (request: CloudFrontRequest): Region => {
  const value = getQueryParameter(request, 'region')
  return getValidRegion(value)
}

export const getValidRegion = (value?: string | null): Region => {
  if (value === undefined || value === null || value === '' || !isRegion(value)) {
    return Region.us
  }

  return value
}

function isRegion(value: string): value is Region {
  return Object.values<string>(Region).includes(value)
}

function getQueryParameter(request: CloudFrontRequest, key: string): string | undefined {
  const params = request.querystring.split('&')

  console.debug(`Attempting to extract ${key} from ${params.join(', ')}. Query string: ${request.querystring}`)

  for (let i = 0; i < params.length; i++) {
    const kv = params[i].split('=')
    if (kv[0] === key) {
      console.debug(`Found ${key} in ${params.join(', ')}: ${kv[1]}`)

      return kv[1]
    }
  }
  return undefined
}

export function isMethodAuthorized(method: string) {
  return method === 'POST'
}
