import { wait } from './wait.ts'
import { readTerraformOutput } from './terraform.ts'
import type { PlaywrightTestConfig } from '@playwright/test'

export type CloudfrontUrls = {
  cloudfrontWithHeadersUrl: string
  cloudfrontWithSecretsUrl: string
  cloudfrontWithSecretsV4Url: string
}

export const testMatches = {
  cloudfrontWithHeadersUrl: '**/*.test.ts',
  cloudfrontWithSecretsUrl: '**/*.test.ts',
  cloudfrontWithSecretsV4Url: ['statusCheck.test.ts', 'v4/**/*.test.ts'],
} satisfies Record<keyof CloudfrontUrls, PlaywrightTestConfig['testMatch']>

export const urlTypeCustomerVariableSourceMap: Record<keyof CloudfrontUrls, string> = {
  cloudfrontWithHeadersUrl: 'HeaderCustomerVariables',
  cloudfrontWithSecretsUrl: 'SecretsManagerVariables',
  cloudfrontWithSecretsV4Url: 'SecretsManagerVariables',
}

let cache: CloudfrontUrls | undefined

function getCloudfrontUrlsFromEnv(): { [K in keyof CloudfrontUrls]: string | undefined } {
  return {
    cloudfrontWithHeadersUrl: process.env.CLOUDFRONT_WITH_HEADERS_URL,
    cloudfrontWithSecretsUrl: process.env.CLOUDFRONT_WITH_SECRETS_URL,
    cloudfrontWithSecretsV4Url: process.env.CLOUDFRONT_WITH_SECRETS_V4_URL,
  }
}

export function getCloudfrontUrls(): CloudfrontUrls {
  if (!cache) {
    const fromEnv = getCloudfrontUrlsFromEnv()
    if (
      fromEnv.cloudfrontWithHeadersUrl !== undefined &&
      fromEnv.cloudfrontWithSecretsUrl !== undefined &&
      fromEnv.cloudfrontWithSecretsV4Url !== undefined
    ) {
      cache = {
        cloudfrontWithHeadersUrl: `https://${fromEnv.cloudfrontWithHeadersUrl}`,
        cloudfrontWithSecretsUrl: `https://${fromEnv.cloudfrontWithSecretsUrl}`,
        cloudfrontWithSecretsV4Url: `https://${fromEnv.cloudfrontWithSecretsV4Url}`,
      }
      console.info('Using cloudfront urls from env', cache)
    } else {
      const contents = readTerraformOutput()

      cache = {
        cloudfrontWithHeadersUrl: `https://${contents.cloudfront_with_headers_url.value}`,
        cloudfrontWithSecretsUrl: `https://${contents.cloudfront_with_secret_url.value}`,
        cloudfrontWithSecretsV4Url: `https://${contents.cloudfront_with_secret_url_v4_only.value}`,
      }

      console.info('Using cloudfront urls from terraform output', cache)
    }
  }

  return cache
}

export async function waitForCloudfront(waitMs = 1000) {
  const urls = Object.values(getCloudfrontUrls()).map((url) => {
    const urlObject = new URL(url)
    urlObject.pathname = `/${getBehaviourPath()}/status`

    return urlObject.toString()
  })

  await Promise.all(
    urls.map(async (url) => {
      await doHealthCheck(url, waitMs)
    })
  )
}

async function doHealthCheck(url: string, waitMs: number) {
  let attempts = 0
  const maxAttempts = 5

  while (attempts <= maxAttempts) {
    const response = await fetch(url).catch((error: unknown) => {
      console.error(`Failed to get response from ${url}`, error)

      return null
    })

    if (response?.ok === true) {
      return
    }

    attempts++
    await wait(waitMs)
  }

  throw new Error(`Failed to get response from ${url} after ${maxAttempts} attempts`)
}

function getBehaviourPath() {
  return process.env.BEHAVIOUR_PATH ?? 'fpjs'
}
