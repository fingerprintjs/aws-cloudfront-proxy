import { addTrafficMonitoringSearchParamsForIngressRequest } from '../../utils'

test('test ingress call', () => {
  const url = new URL('https://foo.bar/visitorId?smth')
  addTrafficMonitoringSearchParamsForIngressRequest(url)

  const param = url.searchParams.get('ii')
  expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
})
