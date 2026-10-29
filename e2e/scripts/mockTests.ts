import { execSync } from 'child_process'
import { describe, it } from 'vitest'
import { type CloudfrontUrls, getCloudfrontUrls } from '../tests/src/utils/cloudfront'
import packageJson from '../../package.json' with { type: 'json' }

const version = packageJson.version

function getEnv(name: string) {
  const value = process.env[name]

  if (value === undefined || value === '') {
    throw new Error(`${name} is not set`)
  }

  return value
}

const v3Urls: Array<keyof CloudfrontUrls> = ['cloudfrontWithHeadersUrl', 'cloudfrontWithSecretsUrl']
const v4Urls: Array<keyof CloudfrontUrls> = ['cloudfrontWithSecretsV4Url']

const isV4Only = process.env.V4_ONLY === 'true'

const apiUrl = getEnv('API_URL')
const behaviorPath = getEnv('FPJS_BEHAVIOR_PATH')
const agentPath = getEnv('FPJS_AGENT_DOWNLOAD_PATH')
const ingressPath = getEnv('FPJS_GET_RESULT_PATH')

const cloudfrontUrls = getCloudfrontUrls()

const cases = Object.entries(cloudfrontUrls).filter(([name]) =>
  isV4Only ? v4Urls.includes(name as keyof CloudfrontUrls) : v3Urls.includes(name as keyof CloudfrontUrls)
)

describe('mock e2e', () => {
  it.each(cases)('runs mock e2e tests for %s', (_name, url) => {
    const integrationUrl = new URL(url)
    integrationUrl.pathname = behaviorPath

    const args = {
      'api-url': `https://${apiUrl}`,
      'integration-url': integrationUrl.toString(),
      'cdn-path': agentPath,
      'ingress-path': ingressPath,
      'traffic-name': 'fingerprintjs-pro-cloudfront',
      'integration-version': version,
      'enable-new-tests': 'true',
    } as Record<string, string | string[]>
    if (isV4Only) {
      args['include'] = ['v4 agent', 'v4 browser cache', 'v4 ingress']
    }

    const argsString = Object.entries(args)
      .flatMap(([key, value]) => {
        if (typeof value === 'string') {
          return `--${key}="${value}"`
        }

        return value.map((v) => `--${key}="${v}"`)
      })
      .join(' ')

    // Throwing here fails this case; vitest aggregates failures and exits non-zero.
    execSync(
      `npm exec -y "git+https://github.com/fingerprintjs/dx-team-mock-for-proxy-integrations-e2e-tests.git" -- ${argsString}`,
      {
        stdio: 'inherit',
      }
    )
  })
})
