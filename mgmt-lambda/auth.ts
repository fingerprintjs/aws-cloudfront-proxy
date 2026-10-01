import { APIGatewayProxyEventV2WithRequestContext, APIGatewayEventRequestContextV2 } from 'aws-lambda'
import type { AuthSettings } from './model/AuthSettings'
import { SecretsManagerClient, GetSecretValueCommand, GetSecretValueResponse } from '@aws-sdk/client-secrets-manager'

const MGMT_TOKEN_SCHEME = 'mgmt-token'
const EMPTY_TOKEN = ''

export async function getAuthSettings(secretManagerClient: SecretsManagerClient): Promise<AuthSettings> {
  const secretName = process.env.SettingsSecretName
  if (secretName === undefined || secretName === '') {
    throw new Error('Unable to retrieve secret. Error: environment variable SettingsSecretName not found')
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    })

    const response: GetSecretValueResponse = await secretManagerClient.send(command)

    if (response.SecretBinary) {
      // Secrets Manager payload isn't schema-validated at runtime; trust its shape here.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(Buffer.from(response.SecretBinary).toString('utf8')) as AuthSettings
    }
    if (response.SecretString !== undefined && response.SecretString !== '') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(response.SecretString) as AuthSettings
    }
    throw new Error('secret is empty')
  } catch (error) {
    throw new Error(`Unable to retrieve secret. ${String(error)}`)
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
