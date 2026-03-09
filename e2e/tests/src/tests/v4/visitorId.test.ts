import { expect } from '@playwright/test'
import { waitForCloudfront } from '../../utils/cloudfront'
import { cloudfrontTest as test } from '../../cloudfrontTest'
import { trackRequests } from '../../utils/playwright'
import { checkResponse } from '../../utils/checkResponse'

test.describe('[v4] visitorId', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })

  test('should show correct visitorId using lambda endpoints', async ({ page, baseURL }) => {
    const rootUrl = new URL(baseURL as string)

    const { getRequests } = trackRequests(page)

    await page.goto('/', {
      waitUntil: 'networkidle',
    })

    const endpointUrl = new URL('/fpjs', rootUrl)

    await page.click('text=v4')
    await page.fill('#endpoint', endpointUrl.toString())

    await page.click('#getData')

    await checkResponse(page)

    const requests = getRequests()

    const requestsWithDifferentHost = requests.filter((req) => !req.url().includes(rootUrl.hostname))
    expect(
      requestsWithDifferentHost,
      `Following requests have invalid URL: ${requestsWithDifferentHost.map((it) => it.url())}`
    ).toHaveLength(0)

    const agentRequest = requests.find((req) => req.url().includes('/fpjs/web/v4'))
    expect(agentRequest).toBeTruthy()

    const apiRequest = requests.find((req) => req.url().includes('/fpjs?'))
    expect(apiRequest).toBeTruthy()
  })
})
