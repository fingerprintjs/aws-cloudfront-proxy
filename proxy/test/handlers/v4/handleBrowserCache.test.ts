import { handler } from '../../../app'
import { mockEvent, mockRequest } from '../../aws'

describe('Browser caching endpoint v4', () => {
  let fetchSpy: jest.SpyInstance
  const cacheControlValue = 'max-age=31536000, immutable, private'

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch')
    fetchSpy.mockResolvedValue(
      new Response('data', {
        headers: {
          'cache-control': cacheControlValue,
        },
      })
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  test('cache-control header is returned as is', async () => {
    const reqEvent = mockEvent(mockRequest({ uri: '/behavior/random/path', querystring: '', method: 'GET' }))
    const response = await handler(reqEvent)
    expect(response?.headers?.['cache-control']?.[0]?.['value']).toBe(cacheControlValue)
  })

  test('Req headers are the same, except cookies, which should be dropped', async () => {
    const request = mockRequest({ uri: '/behavior/random/some/suffix', querystring: '', method: 'GET' })

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
    const fetchRequest = fetchSpy.mock.calls[0][0] as Request

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
})
