import { wait } from './wait'
import { readTerraformOutput } from './terraform'
import { PlaywrightTestConfig } from '@playwright/test'

export type CloudfrontUrls = {
  cloudfrontWithHeadersUrl: string
  cloudfrontWithSecretsUrl: string
  cloudfrontWithSecretsUrlV4: string
}

export const testMatches = {
  cloudfrontWithHeadersUrl: '**/*.test.ts',
  cloudfrontWithSecretsUrl: '**/*.test.ts',
  cloudfrontWithSecretsUrlV4: ['statusCheck.test.ts', 'v4/**/*.test.ts'],
} satisfies Record<keyof CloudfrontUrls, PlaywrightTestConfig['testMatch']>

export const urlTypeCustomerVariableSourceMap: Record<keyof CloudfrontUrls, string> = {
  cloudfrontWithHeadersUrl: 'HeaderCustomerVariables',
  cloudfrontWithSecretsUrl: 'SecretsManagerVariables',
  cloudfrontWithSecretsUrlV4: 'SecretsManagerVariables',
}

let cache: CloudfrontUrls | undefined

function getCloudfrontUrlsFromEnv(): Partial<CloudfrontUrls> {
  return {
    cloudfrontWithHeadersUrl: process.env.CLOUDFRONT_WITH_HEADERS_URL,
    cloudfrontWithSecretsUrl: process.env.CLOUDFRONT_WITH_SECRETS_URL,
    cloudfrontWithSecretsUrlV4: process.env.CLOUDFRONT_WITH_SECRETS_URL_V4,
  }
}

export function getCloudfrontUrls(): CloudfrontUrls {
  if (!cache) {
    const fromEnv = getCloudfrontUrlsFromEnv()
    if (fromEnv.cloudfrontWithHeadersUrl && fromEnv.cloudfrontWithSecretsUrl) {
      cache = {
        cloudfrontWithHeadersUrl: `https://${fromEnv.cloudfrontWithHeadersUrl}`,
        cloudfrontWithSecretsUrl: `https://${fromEnv.cloudfrontWithSecretsUrl}`,
        cloudfrontWithSecretsUrlV4: `https://${fromEnv.cloudfrontWithSecretsUrlV4}`,
      }
      console.info('Using cloudfront urls from env', cache)
    } else {
      const contents = readTerraformOutput()

      cache = {
        cloudfrontWithHeadersUrl: `https://${contents.cloudfront_with_headers_url.value}`,
        cloudfrontWithSecretsUrl: `https://${contents.cloudfront_with_secret_url.value}`,
        cloudfrontWithSecretsUrlV4: `https://${contents.cloudfront_with_secret_url_v4_only.value}`,
      }

      console.info('Using cloudfront urls from terraform output', cache)
    }
  }

  return cache
}

export function getCloudfrontUrl(urlType: keyof CloudfrontUrls, path: string) {
  const urls = getCloudfrontUrls()

  const url = new URL(urls[urlType])
  url.pathname = path

  return url.toString()
}

export async function waitForCloudfront(waitMs = 1000) {
  const urls = Object.values(getCloudfrontUrls()).map((url) => {
    const urlObject = new URL(url)
    urlObject.pathname = `/${getBehaviourPath()}/status`

    return urlObject.toString()
  })

  await Promise.all(
    urls.map((url) => {
      return new Promise<void>(async (resolve) => {
        const response = await fetch(url).catch((error) => {
          console.error(`Failed to get response from ${url}`, error)

          return null
        })

        if (response?.ok) {
          return resolve()
        }

        await wait(waitMs)
      })
    })
  )
}

function getBehaviourPath() {
  return process.env.BEHAVIOUR_PATH ?? 'fpjs'
}
