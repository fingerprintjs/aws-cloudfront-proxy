import { handler } from '../../../app'
import { mockEvent, mockRequest } from '../../aws'
import * as utils from '../../../utils'
import { addTrafficMonitoringSearchParamsForIngressRequest } from '../../../utils'
import https, { Agent } from 'https'
import { EventEmitter } from 'events'
import { ClientRequest, IncomingMessage } from 'http'
import { Socket } from 'net'

describe('Result Endpoint V4', () => {
  const requestUri = '/behavior'

  const origin: string = '__ingress_api__'
  const queryString: string = '?ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'

  const queryStringWithRegion = (region: string) =>
    `?region=${region}&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress`

  let requestSpy: jest.SpyInstance

  beforeAll(() => {
    jest.spyOn(utils, 'addTrafficMonitoringSearchParamsForIngressRequest')
    requestSpy = jest.spyOn(https, 'request')
    requestSpy.mockImplementation((...args) => {
      const [, options, cb] = args
      options.agent = new Agent()
      const responseStream = new IncomingMessage(new Socket())
      cb(responseStream)
      responseStream.emit('end')
      return Reflect.construct(ClientRequest, args)
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Call with region', async () => {
    const request = mockRequest({ uri: requestUri, querystring: 'region=eu' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://eu.${origin}/${queryStringWithRegion('eu')}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Call with wrong region', async () => {
    const request = mockRequest({ uri: requestUri, querystring: 'region=bar.baz/foo' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/${queryStringWithRegion('us')}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Invalid query parameters', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: requestUri, querystring: queryString })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/${queryStringWithUSRegion}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Suffix with dot', async () => {
    const suffix = '.suffix/more/path'
    const iiParam = 'ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: `/behavior/${suffix}`, querystring: '' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/${suffix}?${iiParam}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Invalid query parameters, GET request', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: requestUri, querystring: queryString, method: 'GET' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/${queryStringWithUSRegion}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Suffix with dot, GET request', async () => {
    const suffix = '.suffix/more/path'
    const request = mockRequest({ uri: `/behavior/${suffix}`, querystring: '', method: 'GET' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/${suffix}?ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Call without suffix', async () => {
    const event = mockEvent(mockRequest({ uri: requestUri, querystring: '' }))
    await handler(event)

    expect(https.request).toHaveBeenCalledWith(`https://${origin}/${queryString}`, expect.anything(), expect.anything())
  })

  test('Call with suffix', async () => {
    const event = mockEvent(mockRequest({ uri: '/behavior/with/suffix', querystring: '' }))
    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://${origin}/with/suffix${queryString}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Call with suffix and region', async () => {
    const request = mockRequest({ uri: '/behavior/with/suffix', querystring: 'region=eu' })
    const event = mockEvent(request)

    await handler(event)

    expect(https.request).toHaveBeenCalledWith(
      `https://eu.${origin}/with/suffix${queryStringWithRegion('eu')}`,
      expect.anything(),
      expect.anything()
    )
  })

  test('Traffic monitoring', async () => {
    const event = mockEvent(mockRequest({ uri: requestUri, querystring: '' }))
    await handler(event)

    const url = requestSpy.mock.calls[0][0]
    const iiParam = new URL(url).searchParams.get('ii')

    expect(iiParam).toEqual('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })

  // No longer relevant, as now traffic monitoring is always included in the request. Leaving this for awareness.
  test.skip('No traffic monitoring on cache endpoint', async () => {
    const event = mockEvent(
      mockRequest({
        uri: requestUri,
        querystring: '',
        method: 'GET',
      })
    )
    await handler(event)

    const url = requestSpy.mock.calls[0][0]
    const iiParam = new URL(url).searchParams.get('ii')

    expect(iiParam).toBeFalsy()

    expect(addTrafficMonitoringSearchParamsForIngressRequest).toHaveBeenCalledTimes(0)
  })

  test('Headers with proxy secret', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '' })
    const event = mockEvent(request)
    await handler(event)

    const options = requestSpy.mock.calls[0][1]

    expect(options.headers).toEqual({
      cookie: '',
      'fpjs-proxy-secret': request.origin.s3.customHeaders.fpjs_pre_shared_secret[0].value,
      'fpjs-proxy-client-ip': request.clientIp,
      'fpjs-proxy-forwarded-host': request.headers['host'][0].value,
    })
  })

  test('Includes only _iidt in cookies', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '' })

    request.headers.cookie[0].value =
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; auth_token=123456'

    const event = mockEvent(request)
    await handler(event)

    const options = requestSpy.mock.calls[0][1]
    expect(options.headers.cookie).toEqual(
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow=='
    )
  })

  test('Request body is not modified', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        setEncoding: jest.fn(),
        headers: {
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
          'content-type': ['text/plain'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest({ uri: requestUri, querystring: '' })

    const event = mockEvent(request)
    const response = await handler(event)

    const body = Buffer.from(response.body as string, 'base64').toString('utf-8')

    expect(body).toEqual('data')

    expect(response.headers).toEqual({
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/plain',
        },
      ],
    })
  })

  test('Request body is not modified on error', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 500,
        setEncoding: jest.fn(),
        headers: {
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
          'content-type': ['text/plain'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('error'))

      emitter.emit('end')
    })

    const request = mockRequest({ uri: requestUri, querystring: '' })

    const event = mockEvent(request)
    const response = await handler(event)

    const body = Buffer.from(response.body as string, 'base64').toString('utf-8')

    expect(body).toEqual('error')

    expect(response.headers).toEqual({
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/plain',
        },
      ],
    })
  })

  test('Returns error response on lambda error', async () => {
    requestSpy.mockImplementation(() => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        write: jest.fn(),
        end: jest.fn(),
      })

      setTimeout(() => {
        emitter.emit('error', new Error('Request timeout'))
      }, 1)

      return emitter
    })

    const request = mockRequest({ uri: requestUri, querystring: '' })

    const event = mockEvent(request)
    const response = await handler(event)

    expect(response.status).toEqual('500')
    expect(JSON.parse(response.body as string)).toEqual({
      v: '2',
      error: {
        code: 'Failed',
        message: 'An error occurred with Fingerprint Lambda function. Reason Error: Request timeout',
      },
      products: {},
    })
  })

  test('Response cookies are the same, strict-transport-security is removed', async () => {
    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      const emitter = new EventEmitter()

      Object.assign(emitter, {
        statusCode: 200,
        setEncoding: jest.fn(),
        headers: {
          'set-cookie': [
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
          ],
          'strict-transport-security': ['max-age=63072000'],
          'access-control-allow-credentials': ['true'],
          'access-control-expose-headers': ['Retry-After'],
        },
      })

      callback(emitter)

      emitter.emit('data', Buffer.from('data'))

      emitter.emit('end')
    })

    const request = mockRequest({ uri: requestUri, querystring: '' })

    const event = mockEvent(request)
    const response = await handler(event)

    expect(response.headers).toEqual({
      'set-cookie': [
        {
          key: 'set-cookie',
          value:
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
        },
      ],
      'access-control-allow-credentials': [
        {
          key: 'access-control-allow-credentials',
          value: 'true',
        },
      ],
      'access-control-expose-headers': [
        {
          key: 'access-control-expose-headers',
          value: 'Retry-After',
        },
      ],
    })
  })
})
