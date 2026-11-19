import type { CloudFrontRequest } from 'aws-lambda'
import { CustomerVariables } from '../../../utils/customer-variables/customer-variables.ts'
import { HeaderCustomerVariables } from '../../../utils/customer-variables/header-customer-variables.ts'
import { getAgentUri, getResultUri, getStatusUri } from '../../../utils/index.ts'
import { ParameterStoreVariables } from '../../../utils/customer-variables/parameter-store/parameter-store-variables.ts'
import { CustomerVariableName } from '../../../utils/customer-variables/types.ts'
import { clearParametersCache } from '../../../utils/customer-variables/parameter-store/retrieve-parameters.ts'
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'
import { getAgentDownloadPath } from '../../../utils/customer-variables/selectors.ts'

describe('customer variables selectors', () => {
  describe('from headers', () => {
    const getHeaderCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new HeaderCustomerVariables(request)])

    test('positive scenario for custom origin', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          custom: {
            domainName: 'adewe.cloudfront.net',
            keepaliveTimeout: 60,
            path: '/',
            port: 443,
            protocol: 'https',
            readTimeout: 60,
            sslProtocols: ['TLSv2'],
            customHeaders: {
              fpjs_pre_shared_secret: [
                {
                  key: 'fpjs_pre_shared_secret',
                  value: 'qwertyuio1356767',
                },
              ],
              fpjs_agent_download_path: [
                {
                  key: 'fpjs_agent_download_path',
                  value: 'greiodsfkljlds',
                },
              ],
              fpjs_get_result_path: [
                {
                  key: 'fpjs_get_result_path',
                  value: 'eiwflsdkadlsjdsa',
                },
              ],
            },
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBe('/greiodsfkljlds')
      expect(await getResultUri(customerVariables)).toBe('/eiwflsdkadlsjdsa(/.*)?')
      expect(getStatusUri()).toBe('/status')
    })

    test('positive scenario for s3 origin', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          s3: {
            domainName: 'adewe.cloudfront.net',
            path: '/',
            region: 'us',
            authMethod: 'origin-access-identity',
            customHeaders: {
              fpjs_pre_shared_secret: [
                {
                  key: 'fpjs_pre_shared_secret',
                  value: 'qwertyuio1356767',
                },
              ],
              fpjs_agent_download_path: [
                {
                  key: 'fpjs_agent_download_path',
                  value: 'greiodsfkljlds',
                },
              ],
              fpjs_get_result_path: [
                {
                  key: 'fpjs_get_result_path',
                  value: 'eiwflsdkadlsjdsa',
                },
              ],
            },
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBe('/greiodsfkljlds')
      expect(await getResultUri(customerVariables)).toBe('/eiwflsdkadlsjdsa(/.*)?')
      expect(getStatusUri()).toBe('/status')
    })

    test('no headers', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          custom: {
            domainName: 'adewe.cloudfront.net',
            keepaliveTimeout: 60,
            path: '/',
            port: 443,
            protocol: 'https',
            readTimeout: 60,
            sslProtocols: ['TLSv2'],
            customHeaders: {},
          },
        },
      }

      const customerVariables = getHeaderCustomerVariables(req)

      expect(await getAgentUri(customerVariables)).toBeNull()
      expect(await getResultUri(customerVariables)).toBeNull()
      expect(getStatusUri()).toBe('/status')
    })
  })

  describe('from parameter store', () => {
    const mock = mockClient(SSMClient)

    const getParameterStoreCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new ParameterStoreVariables(request)])

    const parameterPath = '/fingerprint/my-integration'

    const parameterHeaders = {
      fpjs_parameter_path: [
        {
          key: 'fpjs_parameter_path',
          value: parameterPath,
        },
      ],
    }

    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {},
      origin: {
        custom: {
          domainName: 'adewe.cloudfront.net',
          keepaliveTimeout: 60,
          path: '/',
          port: 443,
          protocol: 'https',
          readTimeout: 60,
          sslProtocols: ['TLSv2'],
          customHeaders: parameterHeaders,
        },
      },
    }

    const runAssertions = async (request = req) => {
      const customerVariables = getParameterStoreCustomerVariables(request)

      const checkVariables = async () => {
        expect(await getAgentUri(customerVariables)).toBe('/download')
        expect(await getResultUri(customerVariables)).toBe('/result(/.*)?')
        expect(getStatusUri()).toBe('/status')
      }

      await checkVariables()

      expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)
      expect(mock).toHaveReceivedCommandWith(GetParametersByPathCommand, {
        Path: parameterPath,
        WithDecryption: true,
      })

      await checkVariables()

      // Ensure that the parameters are only fetched once
      expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)
    }

    beforeEach(() => {
      clearParametersCache()

      mock.reset()
      mock.on(GetParametersByPathCommand, { Path: parameterPath }).resolves({
        Parameters: [
          { Name: `${parameterPath}/${CustomerVariableName.AgentDownloadPath}`, Value: 'download', Type: 'String' },
          { Name: `${parameterPath}/${CustomerVariableName.GetResultPath}`, Value: 'result', Type: 'String' },
          { Name: `${parameterPath}/${CustomerVariableName.PreSharedSecret}`, Value: 'abcd', Type: 'SecureString' },
        ],
      })
    })

    test('positive scenario for custom origin', async () => {
      await runAssertions()
    })

    test('normalizes path without leading slash and with trailing slash', async () => {
      const request: CloudFrontRequest = {
        ...req,
        origin: {
          custom: {
            ...req.origin!.custom!,
            customHeaders: {
              fpjs_parameter_path: [{ key: 'fpjs_parameter_path', value: `${parameterPath.slice(1)}/` }],
            },
          },
        },
      }

      await runAssertions(request)
    })

    test('positive scenario for s3 origin', async () => {
      const req: CloudFrontRequest = {
        clientIp: '1.1.1.1',
        method: 'GET',
        uri: 'fpjs/agent',
        querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
        headers: {},
        origin: {
          s3: {
            domainName: 'adewe.cloudfront.net',
            path: '/',
            region: 'us',
            authMethod: 'origin-access-identity',
            customHeaders: parameterHeaders,
          },
        },
      }

      await runAssertions(req)
    })
  })

  describe('from parameter store and headers', () => {
    const mock = mockClient(SSMClient)

    const getCustomerVariables = (request: CloudFrontRequest) =>
      new CustomerVariables([new ParameterStoreVariables(request), new HeaderCustomerVariables(request)])

    const variableHeaders = {
      fpjs_pre_shared_secret: [
        {
          key: 'fpjs_pre_shared_secret',
          value: 'qwertyuio1356767',
        },
      ],
      fpjs_agent_download_path: [
        {
          key: 'fpjs_agent_download_path',
          value: 'greiodsfkljlds',
        },
      ],
      fpjs_get_result_path: [
        {
          key: 'fpjs_get_result_path',
          value: 'eiwflsdkadlsjdsa',
        },
      ],
    }

    const buildRequest = (customHeaders: Record<string, { key: string; value: string }[]>): CloudFrontRequest => ({
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {},
      origin: {
        custom: {
          domainName: 'adewe.cloudfront.net',
          keepaliveTimeout: 60,
          path: '/',
          port: 443,
          protocol: 'https',
          readTimeout: 60,
          sslProtocols: ['TLSv2'],
          customHeaders,
        },
      },
    })

    const req = buildRequest({
      ...variableHeaders,
      fpjs_parameter_path: [{ key: 'fpjs_parameter_path', value: '/my/path' }],
    })

    beforeEach(() => {
      clearParametersCache()

      mock.reset()
    })

    it('should fallback to headers if parameter store has no parameters', async () => {
      mock.on(GetParametersByPathCommand, { Path: '/my/path' }).resolves({})

      const result = await getAgentDownloadPath(getCustomerVariables(req))

      expect(result).toBe('greiodsfkljlds')
      expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)
    })

    it('should fallback to headers if parameter store throws', async () => {
      mock.on(GetParametersByPathCommand, { Path: '/my/path' }).rejects({})

      const result = await getAgentDownloadPath(getCustomerVariables(req))

      expect(result).toBe('greiodsfkljlds')
      expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 1)
    })

    it('should fallback to headers if parameter path header is empty', async () => {
      mock.on(GetParametersByPathCommand).resolves({})

      const result = await getAgentDownloadPath(getCustomerVariables(buildRequest(variableHeaders)))

      expect(result).toBe('greiodsfkljlds')
      expect(mock).toHaveReceivedCommandTimes(GetParametersByPathCommand, 0)
    })
  })
})
