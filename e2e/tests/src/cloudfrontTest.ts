import { test } from '@playwright/test'
import { extractUrlTypeFromProjectName } from './project'
import type { CloudfrontUrls } from './utils/cloudfront'
import { urlTypeCustomerVariableSourceMap } from './utils/cloudfront'

export const cloudfrontTest = test.extend<{
  urlType: keyof CloudfrontUrls
  customerVariableSource: string | null
}>({
  urlType: async ({}, use, testInfo) => {
    const urlType = extractUrlTypeFromProjectName(testInfo.project.name)

    await use(urlType)
  },
  customerVariableSource: async ({ urlType }, use) => {
    await use(urlTypeCustomerVariableSourceMap[urlType])
  },
})
