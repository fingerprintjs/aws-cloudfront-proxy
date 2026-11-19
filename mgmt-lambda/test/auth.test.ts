import { mockClient } from 'aws-sdk-client-mock'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import type {
  APIGatewayProxyEventV2WithRequestContext,
  APIGatewayEventRequestContextV2,
  APIGatewayProxyEventHeaders,
} from 'aws-lambda'
import { getAuthSettings, retrieveAuthToken } from '../auth.ts'

const ssmMock = mockClient(SSMClient)
const ssmClient = new SSMClient({})
const parameterName = '/fingerprint-pro-mgmt-settings/abc/token'

describe('auth test', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    ssmMock.reset()
    process.env = { ...OLD_ENV }
  })

  it('SecureString parameter is available', async () => {
    process.env.SettingsParameterName = parameterName
    ssmMock
      .on(GetParameterCommand, {
        Name: parameterName,
        WithDecryption: true,
      })
      .resolves({
        Parameter: { Value: '4uxgk6nlew', Type: 'SecureString' },
      })

    const settings = await getAuthSettings(ssmClient)
    expect(settings.token).toBe('4uxgk6nlew')
    expect(ssmMock).toHaveReceivedCommandTimes(GetParameterCommand, 1)
  })

  it('parameter is available, but empty', async () => {
    process.env.SettingsParameterName = parameterName
    ssmMock.on(GetParameterCommand, { Name: parameterName }).resolves({})

    await expect(getAuthSettings(ssmClient)).rejects.toThrow('Unable to retrieve parameter. Error: parameter is empty')
  })

  it('No env var with parameter name', async () => {
    await expect(getAuthSettings(ssmClient)).rejects.toThrow(
      'Unable to retrieve parameter. Error: environment variable SettingsParameterName not found'
    )
  })
})

describe('test token retrieving', () => {
  it('correct scheme', () => {
    const event = generateRequestEvent({
      authorization: 'mgmt-token token-value',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('token-value')
  })

  it('correct scheme without value', () => {
    const event = generateRequestEvent({
      authorization: 'mgmt-token',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('wrong scheme', () => {
    const event = generateRequestEvent({
      authorization: 'basic token-value',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('no scheme', () => {
    const event = generateRequestEvent({
      authorization: 'some-string',
    })

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })

  it('no header', () => {
    const event = generateRequestEvent({})

    const token = retrieveAuthToken(event)
    expect(token).toBe('')
  })
})

function generateRequestEvent(
  headers: APIGatewayProxyEventHeaders
): APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2> {
  const requestContext: APIGatewayEventRequestContextV2 = {
    accountId: '1234567890',
    apiId: 'v3',
    domainName: 'aws-lambda.amazonaws.com',
    domainPrefix: 'xyz123-qwerttuii-fsfds',
    http: {
      method: 'GET',
      path: 'status',
      protocol: 'https',
      sourceIp: '192.168.1.2',
      userAgent: 'backend-app',
    },
    requestId: 'a70a6921-959a-40ea-8e2e-f5343b08588a',
    routeKey: '',
    stage: '',
    time: '2023-12-18T15:57:15+0000',
    timeEpoch: 1702915035000,
  }

  return {
    version: 'v2',
    routeKey: '',
    rawPath: '',
    rawQueryString: '',
    headers: headers,
    requestContext: requestContext,
    isBase64Encoded: false,
  }
}
