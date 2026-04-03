import https from 'https'
import { EventEmitter } from 'events'
import { mockEvent, mockRequest } from '../../aws'
import { handler } from '../../../app'
import { generateErrorResponse } from '../../../utils/generateErrorResponse'
import { CustomerVariableName } from '../../../utils/customer-variables/types'

const requestUri = '/behavior/web/v4/ujKG34hUYKLJKJ1F'
describe('Download agent endpoint V4', () => {
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

  function addResponseHeader(key: string, value: string) {
    Object.assign(mockHttpResponse.headers, {
      [key]: value,
    })
  }

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

  test('Successful call', async () => {
    const event = mockEvent(mockRequest({ uri: requestUri, querystring: '', method: 'GET' }))

    await handler(event)

    expect(requestSpy).toHaveBeenCalledTimes(1)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(`https://${origin}/web/v4/ujKG34hUYKLJKJ1F`)
  })

  test('Successful call with nested behavior path', async () => {
    const event = mockEvent(mockRequest({ uri: `/nested${requestUri}`, querystring: '', method: 'GET' }))

    event.Records[0].cf.request.origin!.s3!.customHeaders[CustomerVariableName.BehaviorPathNestLevel] = [
      {
        key: CustomerVariableName.BehaviorPathNestLevel,
        value: '2',
      },
    ]

    await handler(event)

    expect(requestSpy).toHaveBeenCalledTimes(1)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(`https://${origin}/web/v4/ujKG34hUYKLJKJ1F`)
  })

  test('Call with a custom query', async () => {
    const request = mockRequest({
      uri: requestUri,
      querystring: 'someKey=someValue',
    })

    const event = mockEvent(request)

    await handler(event)

    const [url] = requestSpy.mock.calls[0]

    expect(url.toString()).toEqual(
      `https://${origin}/web/v4/ujKG34hUYKLJKJ1F?someKey=someValue&ii=fingerprintjs-pro-cloudfront%2F__lambda_func_version__%2Fingress`
    )
  })

  test('Browser cache set to an hour when original value is higher', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    addResponseHeader('cache-control', 'public, max-age=3613')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.headers).toEqual({
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=60',
        },
      ],
    })
  })

  test('Browser cache is the same when original value is lower than an hour', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    addResponseHeader('cache-control', 'public, max-age=100')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.headers).toEqual({
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=100, s-maxage=60',
        },
      ],
    })
  })

  test('Proxy cache set to a minute when original value is higher', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    addResponseHeader('cache-control', 'public, max-age=3613, s-maxage=575500')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.headers).toEqual({
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=60',
        },
      ],
    })
  })

  test('Proxy cache is the same when original value is lower than a minute', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    addResponseHeader('cache-control', 'public, max-age=3613, s-maxage=10')

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.headers).toEqual({
      'content-type': [
        {
          key: 'content-type',
          value: 'text/javascript; charset=utf-8',
        },
      ],
      'cache-control': [
        {
          key: 'cache-control',
          value: 'public, max-age=3600, s-maxage=10',
        },
      ],
    })
  })

  test('Response headers are the same, but strict-transport-security is removed', async () => {
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    addResponseHeader('strict-transport-security', 'max-age=63072000')
    addResponseHeader('some-header', 'some-value')

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
    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

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

    const request = mockRequest({ uri: requestUri, querystring: '', method: 'GET' })

    const event = mockEvent(request)

    const response = await handler(event)

    expect(response.body).toEqual(generateErrorResponse(new Error('Network error')))
    expect(response.status).toEqual('500')
  })
})
