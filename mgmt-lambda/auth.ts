import type { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import type { AuthSettings } from './model/AuthSettings.ts'
import type { SSMClient } from '@aws-sdk/client-ssm'
import { GetParameterCommand } from '@aws-sdk/client-ssm'

const MGMT_TOKEN_SCHEME = 'mgmt-token'
const EMPTY_TOKEN = ''

/**
 * Reads the management token from a SecureString parameter in Parameter Store.
 * The parameter name is passed via the `SettingsParameterName` environment variable.
 * */
export async function getAuthSettings(ssmClient: SSMClient): Promise<AuthSettings> {
  const parameterName = process.env.SettingsParameterName
  if (parameterName === undefined || parameterName === '') {
    throw new Error('Unable to retrieve parameter. Error: environment variable SettingsParameterName not found')
  }

  try {
    const response = await ssmClient.send(
      new GetParameterCommand({
        Name: parameterName,
        WithDecryption: true,
      })
    )

    const token = response.Parameter?.Value
    if (token === undefined || token === '') {
      throw new Error('parameter is empty')
    }

    return { token }
  } catch (error) {
    throw new Error(`Unable to retrieve parameter. ${String(error)}`)
  }
}

export function retrieveAuthToken(
  event: APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>
): string {
  const authorization = event.headers['authorization']
  if (authorization === undefined || authorization === '') {
    return EMPTY_TOKEN
  }

  const [type, token] = authorization.split(' ')
  if (type === MGMT_TOKEN_SCHEME) {
    // Without a space in the header, destructuring leaves token undefined at runtime even though
    // TS's array indexing (without noUncheckedIndexedAccess) assumes it's always string.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return token ?? EMPTY_TOKEN
  }
  return EMPTY_TOKEN
}
