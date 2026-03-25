import { handler } from '../../../app'
import { mockEvent, mockRequest } from '../../aws'
import { ClientRequest, IncomingMessage } from 'http'
import https, { Agent } from 'https'
import { Socket } from 'net'

describe('Browser caching endpoint V4', () => {
  const requestUri = '/behavior/some/suffix'

  let requestSpy: jest.MockInstance<ClientRequest, any>
  const cacheControlValue = 'max-age=31536000, immutable, private'

  beforeEach(() => {
    requestSpy = jest.spyOn(https, 'request')
    requestSpy.mockImplementation((...args) => {
      const [, options, cb] = args
      options.agent = new Agent()
      const responseStream = new IncomingMessage(new Socket())
      cb(responseStream)
      responseStream.headers['cache-control'] = cacheControlValue
      responseStream.emit('end')
      return Reflect.construct(ClientRequest, args)
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('cache-control header is returned as is', async () => {
    const reqEvent = mockEvent(mockRequest({ uri: requestUri, querystring: '', method: 'GET' }))
    const response = await handler(reqEvent)
    expect(response?.headers?.['cache-control']?.[0]?.['value']).toBe(cacheControlValue)
  })

  test('Req headers are the same, except cookies, which should be dropped', async () => {
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
    await handler(event)
    const [, options] = requestSpy.mock.calls[0]

    expect(options.headers).toEqual({
      'cache-control': 'no-cache',
      'accept-language': 'en-US',
      'user-agent': 'Mozilla/5.0',
      'x-some-header': 'some value',
      'content-type': 'text/javascript; charset=utf-8',
    })
  })
})
