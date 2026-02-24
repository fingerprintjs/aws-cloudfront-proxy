import https from 'https'
import { mockEvent, mockRequest } from '../aws'
import { handler } from '../../app'
import { EventEmitter } from 'events'

describe('Download agent endpoint', () => {
  const origin: string = '__ingress_api__'

  let requestSpy: jest.SpyInstance

  const setEncoding = jest.fn()

  let mockHttpResponse: EventEmitter & {
    setEncoding: jest.Mock
    headers: any
    statusCode: number
  }
  let mockHttpRequest: EventEmitter

  const agentScript =
    '/** FingerprintJS Pro - Copyright (c) FingerprintJS, Inc, 2022 (https://fingerprint.com) /** function hi() { console.log("hello world!!") }'

  beforeEach(() => {
    requestSpy = jest.spyOn(https, 'request')

    mockHttpResponse = new EventEmitter() as any
    mockHttpRequest = new EventEmitter()

    Object.assign(mockHttpRequest, {
      end: jest.fn(),
    })
    Object.assign(mockHttpResponse, {
      setEncoding,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
      },
      statusCode: 200,
    })

    requestSpy.mockImplementation((_url: any, _options: any, callback) => {
      callback(mockHttpResponse)

      mockHttpResponse.emit('data', Buffer.from(agentScript).toString('binary'))
      mockHttpResponse.emit('end')

      return mockHttpRequest
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('Call with no params', async () => {
    const event = mockEvent(
      mockRequest({ uri: '/behavior/greiodsfkljlds', querystring: 'apiKey=ujKG34hUYKLJKJ1F', method: 'GET' })
    )

    await handler(event)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(
      `https://${origin}/web/v3/ujKG34hUYKLJKJ1F?apiKey=ujKG34hUYKLJKJ1F&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Call with version', async () => {
    const request = mockRequest({
      uri: '/behavior/greiodsfkljlds',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=5',
      method: 'GET',
    })

    const event = mockEvent(request)

    await handler(event)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(
      `https://${origin}/web/v5/ujKG34hUYKLJKJ1F?apiKey=ujKG34hUYKLJKJ1F&version=5&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Call with version and loaderVersion', async () => {
    const request = mockRequest({
      uri: '/behavior/greiodsfkljlds',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5',
      method: 'GET',
    })

    const event = mockEvent(request)

    await handler(event)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(
      `https://${origin}/web/v5/ujKG34hUYKLJKJ1F/loader_v3.6.5.js?apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Call with a custom query', async () => {
    const request = mockRequest({
      uri: '/behavior/greiodsfkljlds',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5&someKey=someValue',
      method: 'GET',
    })

    const event = mockEvent(request)

    await handler(event)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(
      `https://${origin}/web/v5/ujKG34hUYKLJKJ1F/loader_v3.6.5.js?apiKey=ujKG34hUYKLJKJ1F&version=5&loaderVersion=3.6.5&someKey=someValue&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fprocdn`
    )
  })

  test('Browser cache set to an hour when original value is higher', async () => {
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

    Object.assign(mockHttpResponse.headers, {
      'cache-control': 'public, max-age=3613',
    })

    const event = mockEvent(request)

    const response = await handler(event)

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
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

    Object.assign(mockHttpResponse.headers, {
      'cache-control': 'public, max-age=100',
    })

    const event = mockEvent(request)

    const response = await handler(event)

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
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

    Object.assign(mockHttpResponse.headers, {
      'cache-control': 'public, max-age=3613, s-maxage=575500',
    })

    const event = mockEvent(request)

    const response = await handler(event)

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
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

    Object.assign(mockHttpResponse.headers, {
      'cache-control': 'public, max-age=3613, s-maxage=10',
    })

    const event = mockEvent(request)

    const response = await handler(event)

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
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

    Object.assign(mockHttpResponse.headers, {
      'content-type': 'text/javascript; charset=utf-8',
      'strict-transport-security': 'max-age=63072000',
      'some-header': 'some-value',
    })

    const event = mockEvent(request)

    const response = await handler(event)

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
    const request = mockRequest({ uri: '/behavior/greiodsfkljlds', method: 'GET' })

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
    const body = Buffer.from(response.body as string, 'base64').toString('utf-8')
    const [, options] = requestSpy.mock.calls[0]

    expect(body).toEqual(agentScript)

    expect(options.headers).toEqual({
      'cache-control': 'no-cache',
      'accept-language': 'en-US',
      'user-agent': 'Mozilla/5.0',
      'x-some-header': 'some value',
      'content-type': 'text/javascript; charset=utf-8',
    })
  })

  test('Req body for error', async () => {
    requestSpy.mockImplementation(() => {
      setTimeout(() => {
        mockHttpRequest.emit('error', new Error('Network error'))
      }, 1)

      return mockHttpRequest
    })

    const request = mockRequest({ uri: '/behavior/greiodsfkljlds' })

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.body).toEqual(
      JSON.stringify({
        v: '2',
        error: {
          code: 'Failed',
          message: 'An error occurred with Fingerprint Lambda function. Reason Error: Network error',
        },
        products: {},
      })
    )
    expect(response.status).toEqual('500')
  })
})
