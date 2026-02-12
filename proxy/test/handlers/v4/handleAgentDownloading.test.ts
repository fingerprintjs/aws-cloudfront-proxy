import { mockEvent, mockRequest } from '../../aws'
import { handler } from '../../../app'

describe('Download agent endpoint V4', () => {
  const origin: string = '__ingress_api__'

  let fetchSpy: jest.SpyInstance

  let mockFetchResponse: Response

  const agentScript =
    '/** FingerprintJS Pro - Copyright (c) FingerprintJS, Inc, 2022 (https://fingerprint.com) /** function hi() { console.log("hello world!!") }'

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch')

    mockFetchResponse = new Response(Buffer.from(agentScript).toString('binary'), {
      status: 200,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
      },
    })

    fetchSpy.mockImplementation(async () => {
      return mockFetchResponse
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Agent call to /web', async () => {
    const event = mockEvent(
      mockRequest({
        uri: '/behavior/web/v4/ujKG34hUYKLJKJ1F',
        querystring: 'ci=jsl/4.0.0-beta.3',
        method: 'GET',
      })
    )

    await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.url).toEqual(
      `https://${origin}/web/v4/ujKG34hUYKLJKJ1F?ci=jsl%2F4.0.0-beta.3&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Agent call to /web without params', async () => {
    const event = mockEvent(
      mockRequest({
        uri: '/behavior/web',
        querystring: '',
        method: 'GET',
      })
    )

    await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.url).toEqual(
      `https://${origin}/web?ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Call with a custom query', async () => {
    const request = mockRequest({
      uri: '/behavior/web/v4/ujKG34hUYKLJKJ1F',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5&someKey=someValue',
      method: 'GET',
    })

    const event = mockEvent(request)

    await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const fetchRequest = fetchSpy.mock.calls[0][0] as Request
    expect(fetchRequest.url).toEqual(
      `https://${origin}/web/v4/ujKG34hUYKLJKJ1F?apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5&someKey=someValue&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Browser cache set to an hour when original value is higher', async () => {
    const request = mockRequest({
      uri: '/behavior/web',
      querystring: '',
      method: 'GET',
    })

    mockFetchResponse.headers.set('cache-control', 'public, max-age=3613')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers).toEqual({
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=60',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
    })
  })

  test('Browser cache is the same when original value is lower than an hour', async () => {
    const request = mockRequest({ uri: '/behavior/web', method: 'GET' })

    mockFetchResponse.headers.set('cache-control', 'public, max-age=100')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers).toEqual({
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=100, s-maxage=60',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
    })
  })

  test('Proxy cache set to a minute when original value is higher', async () => {
    const request = mockRequest({ uri: '/behavior/web', method: 'GET' })

    mockFetchResponse.headers.set('cache-control', 'public, max-age=3613, s-maxage=575500')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers).toEqual({
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=60',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
    })
  })

  test('Proxy cache is the same when original value is lower than a minute', async () => {
    const request = mockRequest({ uri: '/behavior/web', method: 'GET' })

    mockFetchResponse.headers.set('cache-control', 'public, max-age=3613, s-maxage=10')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers).toEqual({
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=10',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
    })
  })

  test('Response headers are the same, but strict-transport-security is removed', async () => {
    const request = mockRequest({ uri: '/behavior/web', method: 'GET' })

    mockFetchResponse.headers.set('strict-transport-security', 'max-age=63072000')
    mockFetchResponse.headers.set('some-header', 'some-value')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(response.headers).toEqual({
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'some-header': [
        {
          key: 'some-header',
          value: 'some-value',
        },
      ],
    })
  })

  test('Req body and headers are the same, except cookies, which should be dropped', async () => {
    const request = mockRequest({ uri: '/behavior/web', method: 'GET' })

    Object.assign(request.headers, {
      cookie: [
        {
          key: 'cookie',
          value:
            '_iidt=GlMQaHMfzYvomxCuA7Uymy7ArmjH04jPkT+enN7j/Xk8tJG+UYcQV+Qw60Ry4huw9bmDoO/smyjQp5vLCuSf8t4Jow==; auth_token=123456',
        },
      ],
      'cache-control': [
        {
          key: 'cache-control',
          value: 'no-cache',
        },
      ],
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'accept-language': [
        {
          key: 'accept-language',
          value: 'en-US',
        },
      ],
      'user-agent': [
        {
          key: 'user-agent',
          value: 'Mozilla/5.0',
        },
      ],
      'x-some-header': [
        {
          key: 'x-some-header',
          value: 'some value',
        },
      ],
    })

    const event = mockEvent(request)

    const response = await handler(event)
    const body = Buffer.from(response.body as string, 'binary').toString('utf-8')
    const fetchRequest = fetchSpy.mock.calls[0][0] as Request

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(body).toEqual(agentScript)

    expect(fetchRequest.headers).toEqual(
      new Headers({
        'cache-control': 'no-cache',
        'accept-language': 'en-US',
        'user-agent': 'Mozilla/5.0',
        'x-some-header': 'some value',
        'content-type': 'text/javascript; charset=utf-8',
      })
    )
  })

  test('Response body for error', async () => {
    mockFetchResponse = new Response('error', {
      status: 500,
    })

    const request = mockRequest({ uri: '/behavior/web' })

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.body).toEqual('error')
    expect(response.status).toEqual('500')
  })
})
