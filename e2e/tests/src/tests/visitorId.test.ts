import { expect } from '@playwright/test'
import { waitForCloudfront } from '../utils/cloudfront.ts'
import { cloudfrontTest as test } from '../cloudfrontTest.ts'
import { trackRequests } from '../utils/playwright.ts'
import { checkResponse } from '../utils/checkResponse.ts'

test.describe('visitorId', () => {
  test.beforeEach(async () => {
    await waitForCloudfront()
  })

  test('should show correct visitorId using lambda endpoints', async ({ page, baseURL }) => {
    const rootUrl = new URL(baseURL as string)

    const { getRequests } = trackRequests(page)

    await page.goto('/', {
      waitUntil: 'networkidle',
    })

    await page.click('#getData')

    await checkResponse(page)

    const requests = getRequests()
    expect(requests.every((req) => req.url().includes(baseURL!))).toBe(true)
    expect(requests).toHaveLength(5)

    const [, , agentRequest, , apiRequest] = requests

    const agentRequestUrl = new URL(agentRequest.url())
    expect(agentRequestUrl.hostname).toBe(rootUrl.hostname)

    const apiRequestUrl = new URL(apiRequest.url())
    expect(apiRequestUrl.hostname).toBe(rootUrl.hostname)
  })
})
