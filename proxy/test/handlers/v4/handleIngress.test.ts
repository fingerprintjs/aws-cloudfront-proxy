import { handler } from '../../../app'
import { V4 } from '../../../v4'
import { mockEvent, mockRequest } from '../../aws'
import * as utils from '../../../utils'

describe('Ingress Endpoint V4', () => {
  const origin: string = '__ingress_api__'
  const queryString: string =
    '?apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'

  const queryStringWithRegion = (region: string) =>
    `?apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&region=${region}&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress`

  const defaultExpectedHeaders = new Headers({
    cookie: '',
    'fpjs-proxy-client-ip': '1.1.1.1',
    'fpjs-proxy-secret': 'qwertyuio1356767',
    'fpjs-proxy-forwarded-host': 'adewe.cloudfront.net',
  })

  let fetchSpy: jest.SpyInstance

  beforeAll(() => {
    jest.spyOn(V4, 'handleIngress')
    jest.spyOn(utils, 'addTrafficMonitoringSearchParamsForProCDN')
    jest.spyOn(utils, 'addTrafficMonitoringSearchParamsForVisitorIdRequest')
    fetchSpy = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Successful call with different region', async () => {
    const request = mockRequest({ uri: '/behavior' })
    request.querystring = `${request.querystring}&region=eu`
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://eu.${origin}/${queryStringWithRegion('eu')}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Successful call', async () => {
    const request = mockRequest({ uri: '/behavior' })
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${queryString}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Call with wrong region', async () => {
    const queryString = 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2'
    const request = mockRequest({ uri: '/behavior', querystring: queryString })
    request.querystring = `${request.querystring}&region=bar.baz/foo`
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${queryStringWithRegion('us')}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Invalid query parameters', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: '/behavior', querystring: queryString })
    request.querystring = `${request.querystring}`
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${queryStringWithUSRegion}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Suffix with dot', async () => {
    const suffix = '.suffix/more/path'
    const iiParam = 'ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: `/behavior/${suffix}`, querystring: '' })
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${suffix}?${iiParam}`)
  })

  test('Invalid query parameters, GET request', async () => {
    const queryString = 'apiKey=foo.bar/baz&version=bar.foo/baz&loaderVersion=baz.bar/foo'
    const queryStringWithUSRegion =
      '?apiKey=foo.bar%2Fbaz&version=bar.foo%2Fbaz&loaderVersion=baz.bar%2Ffoo&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: '/behavior', querystring: queryString, method: 'GET' })
    request.querystring = `${request.querystring}`
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${queryStringWithUSRegion}`)
    expect(fetchRequest.headers).toEqual(new Headers({}))
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('GET')
  })

  test('Suffix with dot, GET request', async () => {
    const suffix = '.suffix/more/path'
    const iiParam = 'ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress'
    const request = mockRequest({ uri: `/behavior/${suffix}`, querystring: '', method: 'GET' })
    const event = mockEvent(request)

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${suffix}?${iiParam}`)
    expect(fetchRequest.headers).toEqual(new Headers({}))
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('GET')
  })

  test('Call without suffix', async () => {
    const event = mockEvent(mockRequest({ uri: '/behavior' }))
    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/${queryString}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Call with suffix', async () => {
    const event = mockEvent(mockRequest({ uri: '/behavior/with/suffix' }))
    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/with/suffix${queryString}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Call with suffix and nested behavior path', async () => {
    const request = mockRequest({ uri: '/nested/behavior/with/suffix' })
    request.origin.s3.customHeaders['fpjs_behavior_path_nest_level'] = [
      {
        key: 'fpjs_behavior_path_nest_level',
        value: '2',
      },
    ]
    const event = mockEvent(request)
    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://${origin}/with/suffix${queryString}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Call with suffix and region', async () => {
    const request = mockRequest({ uri: '/behavior/with/suffix' })
    const event = mockEvent(request)

    request.querystring = `${request.querystring}&region=eu`

    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.url).toEqual(`https://eu.${origin}/with/suffix${queryStringWithRegion('eu')}`)
    expect(fetchRequest.headers).toEqual(defaultExpectedHeaders)
    expect(fetchRequest.body).toBeNull()
    expect(fetchRequest.method).toEqual('POST')
  })

  test('Headers with proxy secret', async () => {
    const request = mockRequest({ uri: '/behavior' })
    const event = mockEvent(request)
    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)
    expect(fetchRequest.headers).toEqual(
      new Headers({
        cookie: '',
        'fpjs-proxy-secret': request.origin.s3.customHeaders.fpjs_pre_shared_secret[0].value,
        'fpjs-proxy-client-ip': request.clientIp,
        'fpjs-proxy-forwarded-host': request.headers['host'][0].value,
      })
    )
  })

  test('Includes only _iidt in cookies', async () => {
    const request = mockRequest({ uri: '/behavior' })
    request.headers.cookie[0].value =
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; auth_token=123456'
    const event = mockEvent(request)
    fetchSpy.mockResolvedValue(new Response())

    await handler(event)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest).toBeInstanceOf(Request)

    expect(fetchRequest.headers.get('cookie')).toEqual(
      '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow=='
    )
  })

  test('Request and response body is not modified', async () => {
    const request = mockRequest({
      uri: '/behavior',
      body: {
        action: 'read-only',
        data: 'request-data',
        encoding: 'text',
        inputTruncated: false,
      },
    })

    const event = mockEvent(request)
    fetchSpy.mockResolvedValue(
      new Response(Buffer.from('response-data', 'utf-8'), {
        headers: {
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': 'Retry-After',
          'content-type': 'text/plain',
        },
      })
    )

    const response = await handler(event)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(response.body).toEqual('response-data')
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

  test('Request and response body is not modified on error', async () => {
    const request = mockRequest({
      uri: '/behavior',
      body: {
        action: 'read-only',
        data: 'request-data',
        encoding: 'text',
        inputTruncated: false,
      },
    })

    const event = mockEvent(request)
    fetchSpy.mockResolvedValue(
      new Response(Buffer.from('response-data', 'utf-8'), {
        headers: {
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': 'Retry-After',
          'content-type': 'text/plain',
        },
        status: 500,
      })
    )

    const response = await handler(event)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(response.body).toEqual('response-data')
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
    fetchSpy.mockRejectedValue(new Error('Request timeout'))

    const request = mockRequest({ uri: '/behavior' })

    const event = mockEvent(request)
    const response = await handler(event)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    expect(response.status).toEqual('500')
    expect(JSON.parse(response.body as string)).toEqual({
      v: '2',
      error: {
        code: 'Failed',
        message: 'An error occurred with Fingerprint Pro Lambda function. Reason Error: Request timeout',
      },
      products: {},
    })
  })

  test('Response cookies are the same, strict-transport-security is removed', async () => {
    fetchSpy.mockResolvedValue(
      new Response('data', {
        headers: {
          'set-cookie':
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; Path=/; Domain=fpjs.io; Expires=Fri, 19 Jan 2024 08:54:36 GMT; HttpOnly; Secure; SameSite=None, anotherCookie=anotherValue; Domain=fpjs.io;',
          'strict-transport-security': 'max-age=63072000',
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': 'Retry-After',
        },
      })
    )

    const request = mockRequest({ uri: '/behavior' })

    const event = mockEvent(request)
    const response = await handler(event)
    expect(fetchSpy).toHaveBeenCalledTimes(1)

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
      'content-type': [
        {
          key: 'content-type',
          value: 'text/plain;charset=UTF-8',
        },
      ],
    })
  })
})
