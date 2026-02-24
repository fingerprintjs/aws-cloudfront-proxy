import {
  addTrafficMonitoringSearchParamsForProCDN,
  addTrafficMonitoringSearchParamsForVisitorIdRequest,
} from '../../utils'
import { handleTrafficMonitoring } from '../../utils/traffic'
import { getPathSegments } from '../../utils/paths'

describe('test procdn call', () => {
  test('test', () => {
    const url = new URL('https://foo.bar/agent?smth')
    addTrafficMonitoringSearchParamsForProCDN(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/procdn')
  })
})

describe('test visitor call', () => {
  test('test', () => {
    const url = new URL('https://foo.bar/visitorId?smth')
    addTrafficMonitoringSearchParamsForVisitorIdRequest(url)

    const param = url.searchParams.get('ii')
    expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })
})

describe('test handle traffic monitoring', () => {
  it('should ignore misleading path that mentions web', () => {
    const url = new URL('https://foo.bar/fingerprint-web-proxy/result')

    handleTrafficMonitoring(url, getPathSegments(url.pathname), 'GET')

    expect(url.searchParams.get('ii')).toBeNull()
  })

  it('should handle agent request', () => {
    const url = new URL('https://foo.bar/web/api_key')

    handleTrafficMonitoring(url, getPathSegments(url.pathname), 'GET')

    expect(url.searchParams.get('ii')).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/procdn')
  })

  it('should handle ingress request', () => {
    const url = new URL('https://foo.bar/')

    handleTrafficMonitoring(url, getPathSegments(url.pathname), 'POST')

    expect(url.searchParams.get('ii')).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
  })
})
