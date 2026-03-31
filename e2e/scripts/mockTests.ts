import { execSync } from 'child_process'
import { getCloudfrontUrls } from '../tests/src/utils/cloudfront'
import { version } from '../../package.json'

function getEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not set`)
  }

  return value
}

async function main() {
  let hasError = false

  const cloudfrontUrls = getCloudfrontUrls()

  const isV4Only = process.env.V4_ONLY === 'true'

  const apiUrl = getEnv('API_URL')
  const behaviorPath = getEnv('FPJS_BEHAVIOR_PATH')
  const agentPath = getEnv('FPJS_AGENT_DOWNLOAD_PATH')
  const ingressPath = getEnv('FPJS_GET_RESULT_PATH')

  console.info('Agent download path:', agentPath)
  console.info('Get result path:', ingressPath)

  const cloudfrontUrlsArray = Object.entries(cloudfrontUrls).filter(
    ([name]) => !isV4Only || name === 'cloudfrontWithSecretsV4Url'
  )
  for (const [name, url] of cloudfrontUrlsArray) {
    if (name === 'cloudfrontWithoutVariables') {
      continue
    }

    const integrationUrl = new URL(url)
    integrationUrl.pathname = behaviorPath

    console.info(`Running mock e2e tests for ${name}`, integrationUrl.toString())

    try {
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

      execSync(
        `npm exec -y "git+https://github.com/fingerprintjs/dx-team-mock-for-proxy-integrations-e2e-tests.git" -- ${argsString}`,
        {
          stdio: 'inherit',
        }
      )
    } catch (e) {
      console.error(`Test for ${name} failed`, e)

      hasError = true
    }
  }

  if (hasError) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
