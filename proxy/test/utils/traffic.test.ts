import { addTrafficMonitoring } from '../../utils'

test('test ingress call', () => {
  const url = new URL('https://foo.bar/visitorId?smth')
  addTrafficMonitoring(url)

  const param = url.searchParams.get('ii')
  expect(param).toBe('fingerprintjs-pro-cloudfront/__lambda_func_version__/ingress')
})
