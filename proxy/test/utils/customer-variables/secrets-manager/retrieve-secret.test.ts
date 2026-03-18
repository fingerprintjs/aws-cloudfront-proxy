import { mockClient } from 'aws-sdk-client-mock'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { clearSecretsCache, retrieveSecret } from '../../../../utils/customer-variables/secrets-manager/retrieve-secret'
import 'aws-sdk-client-mock-jest'

const secretName = 'test'
const mock = mockClient(SecretsManagerClient)
const client = new SecretsManagerClient({})

describe('retrieve secret', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    clearSecretsCache()

    mock.reset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('caches result even if it is null', async () => {
    mock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({})

    await retrieveSecret(client, secretName)
    await retrieveSecret(client, secretName)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })

  it('refetches secret after cache expires', async () => {
    mock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .resolves({})

    await retrieveSecret(client, secretName)
    await retrieveSecret(client, secretName)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)

    jest.advanceTimersByTime(500_001)

    await retrieveSecret(client, secretName)
    await retrieveSecret(client, secretName)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 2)
  })

  it('caches result even if it secrets manager throws', async () => {
    mock
      .on(GetSecretValueCommand, {
        SecretId: secretName,
      })
      .rejects('mocked rejection')

    await retrieveSecret(client, secretName)
    await retrieveSecret(client, secretName)

    expect(mock).toHaveReceivedCommandTimes(GetSecretValueCommand, 1)
  })
})
