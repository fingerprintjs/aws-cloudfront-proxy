import { mockClient } from 'aws-sdk-client-mock'
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'
import {
  clearParametersCache,
  FAILURE_CACHE_TTL_MS,
  retrieveParameters,
} from '../../../../utils/customer-variables/parameter-store/retrieve-parameters.ts'

const path = '/fingerprint/test'
const mock = mockClient(SSMClient)
const client = new SSMClient({})

describe('retrieve parameters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearParametersCache()

    mock.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps parameter names to lowercase variable keys', async () => {
    mock.on(GetParametersByPathCommand, { Path: path }).resolves({
      Parameters: [
        { Name: `${path}/FPJS_GET_RESULT_PATH`, Value: 'result' },
        { Name: `${path}/fpjs_pre_shared_secret`, Value: 'secret', Type: 'SecureString' },
      ],
    })

    const result = await retrieveParameters(client, path)

    expect(result).toEqual({ fpjs_get_result_path: 'result', fpjs_pre_shared_secret: 'secret' })
    expect(mock).toHaveReceivedCommandWith(GetParametersByPathCommand, { Path: path, WithDecryption: true })
  })

  it('follows pagination', async () => {
    mock
      .on(GetParametersByPathCommand, { Path: path, NextToken: undefined })
      .resolves({ Parameters: [{ Name: `${path}/fpjs_get_result_path`, Value: 'result' }], NextToken: 'next' })
      .on(GetParametersByPathCommand, { Path: path, NextToken: 'next' })
      .resolves({ Parameters: [{ Name: `${path}/fpjs_agent_download_path`, Value: 'agent' }] })

    const result = await retrieveParameters(client, path)

    expect(result).toEqual({ fpjs_get_result_path: 'result', fpjs_agent_download_path: 'agent' })
    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 2)
  })

  it('caches result even if it is null', async () => {
    mock.on(GetParametersByPathCommand, { Path: path }).resolves({})

    await retrieveParameters(client, path)
    await retrieveParameters(client, path)

    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)
  })

  it('refetches parameters after cache expires', async () => {
    mock.on(GetParametersByPathCommand, { Path: path }).resolves({})

    await retrieveParameters(client, path)
    await retrieveParameters(client, path)

    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)

    vi.advanceTimersByTime(500_001)

    await retrieveParameters(client, path)
    await retrieveParameters(client, path)

    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 2)
  })

  it('caches failures only briefly', async () => {
    mock.on(GetParametersByPathCommand, { Path: path }).rejects('mocked rejection')

    expect(await retrieveParameters(client, path)).toBeNull()
    await retrieveParameters(client, path)

    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)

    vi.advanceTimersByTime(FAILURE_CACHE_TTL_MS)
    mock.on(GetParametersByPathCommand, { Path: path }).resolves({
      Parameters: [{ Name: `${path}/fpjs_get_result_path`, Value: 'result' }],
    })

    expect(await retrieveParameters(client, path)).toEqual({ fpjs_get_result_path: 'result' })
    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 2)
  })

  it('does not cache failures longer than the configured TTL', async () => {
    mock.on(GetParametersByPathCommand, { Path: path }).rejects('mocked rejection')

    await retrieveParameters(client, path, 1_000)
    vi.advanceTimersByTime(1_000)
    await retrieveParameters(client, path, 1_000)

    expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 2)
  })
})
