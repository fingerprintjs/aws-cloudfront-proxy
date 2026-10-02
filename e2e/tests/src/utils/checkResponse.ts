import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { isRequestIdValid } from './areVisitorIdAndRequestIdValid.ts'

export async function checkResponse(page: Page) {
  const response = await page.waitForSelector('#response pre').then((element) => element.textContent())

  expect(response).toBeTruthy()

  const json = JSON.parse(response as string)

  expect(isRequestIdValid(json.requestId)).toBeTruthy()
}
