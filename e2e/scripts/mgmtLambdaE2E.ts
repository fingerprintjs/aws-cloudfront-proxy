import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { setTimeout as sleep } from 'timers/promises'
import type { LambdaFunctionAssociation } from '@aws-sdk/client-cloudfront'
import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  waitUntilDistributionDeployed,
} from '@aws-sdk/client-cloudfront'
import type { FunctionConfiguration } from '@aws-sdk/client-lambda'
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  paginateListVersionsByFunction,
  UpdateFunctionCodeCommand,
  waitUntilFunctionUpdatedV2,
  waitUntilPublishedVersionActive,
} from '@aws-sdk/client-lambda'
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { defaults } from '../../mgmt-lambda/DefaultSettings.ts'
import { type GitHubRelease, parseStatusVersion, pickDowngradeRelease } from './mgmtLambdaE2EUtils.ts'

/**
 * E2E test of the mgmt-lambda upgrade flow against a deployed CloudFormation stack.
 * WARNING: it modifies the target stack (mgmt-lambda code, proxy Lambda code, CloudFront associations).
 */

const DEFAULT_STACK_NAME = 'fingerprint-mgmt-lambda-e2e'
const RELEASES_URL =
  'https://api.github.com/repos/fingerprintjs/fingerprint-pro-cloudfront-integration/releases?per_page=50'
const S3_PACKAGE_URL = `https://${defaults.LAMBDA_DISTRIBUTION_BUCKET}.s3.amazonaws.com/${defaults.LAMBDA_DISTRIBUTION_BUCKET_KEY}`
const ALL_VARIABLES_SET_TEXT = '✅ All required environment variables are set:'
// CloudFront propagation is slow, waiters get generous limits (seconds)
const DEPLOY_WAIT_SECONDS = 1800
const STATUS_POLL_TIMEOUT_MS = 15 * 60 * 1000
const STATUS_POLL_INTERVAL_MS = 20 * 1000

const region = defaults.AWS_REGION
const lambdaClient = new LambdaClient({ region })
const cloudFrontClient = new CloudFrontClient({ region })
const secretsClient = new SecretsManagerClient({ region })

interface StackOutputs {
  proxyFunctionName: string
  mgmtFunctionName: string
  distributionId: string
  mgmtFunctionUrl: string
  mgmtSettingsSecret: string
}

function getEnvOr(name: string, fallback: string) {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

function step(message: string) {
  console.info(`\n=== ${message} ===`)
}

function sha256Base64(data: Buffer) {
  // Lambda reports CodeSha256 as base64
  return createHash('sha256').update(data).digest('base64')
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function download(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

function getStackOutputs(stackName: string): StackOutputs {
  const json = execFileSync(
    'aws',
    [
      'cloudformation',
      'describe-stacks',
      '--region',
      region,
      '--stack-name',
      stackName,
      '--query',
      'Stacks[0].Outputs',
      '--output',
      'json',
    ],
    { encoding: 'utf8' }
  )
  const outputs = new Map(
    (JSON.parse(json) as Array<{ OutputKey: string; OutputValue: string }>).map((o) => [o.OutputKey, o.OutputValue])
  )
  const get = (key: string) => {
    const value = outputs.get(key)
    if (value === undefined || value === '') {
      throw new Error(`Stack ${stackName} has no ${key} output`)
    }
    return value
  }

  return {
    proxyFunctionName: get('LambdaFunctionName'),
    mgmtFunctionName: get('FingerprintProMgmtLambda'),
    distributionId: get('CloudFrontDistributionId'),
    mgmtFunctionUrl: get('MgmtLambdaFunctionUrl'),
    mgmtSettingsSecret: get('MgmtSettingsSecret'),
  }
}

function getProxyAssociations(associations: LambdaFunctionAssociation[] | undefined, proxyFunctionName: string) {
  return (associations ?? []).filter(
    (association) => association.LambdaFunctionARN?.includes(`:function:${proxyFunctionName}:`) === true
  )
}

async function getDistributionProxyAssociations(distributionId: string, proxyFunctionName: string) {
  const { DistributionConfig, ETag } = await cloudFrontClient.send(
    new GetDistributionConfigCommand({ Id: distributionId })
  )
  if (DistributionConfig === undefined || ETag === undefined) {
    throw new Error(`Distribution ${distributionId} not found`)
  }

  const associations = [DistributionConfig.DefaultCacheBehavior, ...(DistributionConfig.CacheBehaviors?.Items ?? [])]
    .filter((behavior) => behavior !== undefined)
    .flatMap((behavior) => getProxyAssociations(behavior.LambdaFunctionAssociations?.Items, proxyFunctionName))

  return { DistributionConfig, ETag, associations }
}

async function waitForDistributionDeployed(distributionId: string) {
  console.info(`Waiting for distribution ${distributionId} to be deployed...`)
  await waitUntilDistributionDeployed(
    { client: cloudFrontClient, maxWaitTime: DEPLOY_WAIT_SECONDS },
    { Id: distributionId }
  )
}

async function pollStatusPage(statusUrl: string, description: string, isDone: (html: string) => boolean) {
  const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS
  let lastHtml = ''

  while (Date.now() < deadline) {
    const response = await fetch(statusUrl, { headers: { 'cache-control': 'no-cache' } })
    lastHtml = await response.text()
    console.info(`Status page: HTTP ${response.status}, version ${parseStatusVersion(lastHtml) ?? '<none>'}`)
    if (response.ok && isDone(lastHtml)) {
      return lastHtml
    }
    await sleep(STATUS_POLL_INTERVAL_MS)
  }

  throw new Error(`Status page at ${statusUrl} never showed ${description}. Last response:\n${lastHtml}`)
}

async function getNewestPublishedVersion(functionName: string) {
  const versions: FunctionConfiguration[] = []
  for await (const page of paginateListVersionsByFunction({ client: lambdaClient }, { FunctionName: functionName })) {
    versions.push(...(page.Versions ?? []))
  }

  const published = versions.filter((version) => version.Version !== '$LATEST')
  assert(published.length > 0, `${functionName} has no published versions`)

  return published.reduce((newest, version) => (Number(version.Version) > Number(newest.Version) ? version : newest))
}

async function swapMgmtLambda({ mgmtFunctionName }: StackOutputs, zipPath: string) {
  step(`Swapping ${mgmtFunctionName} code with ${zipPath}`)
  await lambdaClient.send(
    new UpdateFunctionCodeCommand({ FunctionName: mgmtFunctionName, ZipFile: readFileSync(zipPath) })
  )
  await waitUntilFunctionUpdatedV2({ client: lambdaClient, maxWaitTime: 300 }, { FunctionName: mgmtFunctionName })
}

async function downgradeProxy(outputs: StackOutputs, s3Sha: string, statusUrl: string) {
  step('Picking downgrade target')
  const githubToken = process.env.GITHUB_TOKEN
  const releases = (await (
    await fetch(RELEASES_URL, {
      headers: githubToken !== undefined && githubToken !== '' ? { Authorization: `Bearer ${githubToken}` } : {},
    })
  ).json()) as GitHubRelease[]
  const zips = new Map<string, Buffer>()
  const target = await pickDowngradeRelease(releases, s3Sha, async (url) => {
    zips.set(url, await download(url))
    return sha256Base64(zips.get(url)!)
  })
  console.info(`Downgrade target: ${target.tag} (${target.version})`)

  step(`Downgrading ${outputs.proxyFunctionName} to ${target.version}`)
  const { FunctionArn: versionArn, Version } = await lambdaClient.send(
    new UpdateFunctionCodeCommand({
      FunctionName: outputs.proxyFunctionName,
      ZipFile: zips.get(target.downloadUrl),
      Publish: true,
    })
  )
  assert(versionArn !== undefined && Version !== undefined, 'downgrade did not publish a version')
  await waitUntilPublishedVersionActive(
    { client: lambdaClient, maxWaitTime: 300 },
    { FunctionName: outputs.proxyFunctionName, Qualifier: Version }
  )
  console.info(`Published ${versionArn}`)

  step('Pointing CloudFront associations at the downgraded version')
  const { DistributionConfig, ETag, associations } = await getDistributionProxyAssociations(
    outputs.distributionId,
    outputs.proxyFunctionName
  )
  assert(associations.length > 0, `distribution ${outputs.distributionId} has no proxy associations`)
  for (const association of associations) {
    association.LambdaFunctionARN = versionArn
  }
  await cloudFrontClient.send(
    new UpdateDistributionCommand({ Id: outputs.distributionId, IfMatch: ETag, DistributionConfig })
  )
  await waitForDistributionDeployed(outputs.distributionId)
  await cloudFrontClient.send(
    new CreateInvalidationCommand({
      DistributionId: outputs.distributionId,
      InvalidationBatch: { CallerReference: `mgmt-lambda-e2e-${Date.now()}`, Paths: { Quantity: 1, Items: ['/*'] } },
    })
  )

  step('Checking status page shows the downgraded version')
  await pollStatusPage(statusUrl, `version ${target.version}`, (html) => parseStatusVersion(html) === target.version)

  return target.version
}

async function triggerUpdate({ mgmtFunctionUrl, mgmtSettingsSecret }: StackOutputs) {
  step('Triggering mgmt-lambda update')
  const { SecretString } = await secretsClient.send(new GetSecretValueCommand({ SecretId: mgmtSettingsSecret }))
  const { token } = JSON.parse(SecretString ?? '{}') as { token?: string }
  assert(token !== undefined && token !== '', `secret ${mgmtSettingsSecret} has no token`)

  const response = await fetch(new URL('update', mgmtFunctionUrl), {
    method: 'POST',
    headers: { Authorization: `mgmt-token ${token}` },
  })
  const body = await response.text()
  console.info(`Update response: HTTP ${response.status} ${body}`)

  assert(response.status === 200, `update returned HTTP ${response.status}`)
  assert(
    (JSON.parse(body) as { status?: string }).status === 'Update completed',
    'update status is not "Update completed"'
  )
}

async function verifyUpgrade(outputs: StackOutputs, s3Sha: string, statusUrl: string, baselineVersion: string) {
  step('Verifying proxy code matches the S3 package')
  const latest = await lambdaClient.send(
    new GetFunctionConfigurationCommand({ FunctionName: outputs.proxyFunctionName })
  )
  assert(latest.CodeSha256 === s3Sha, `$LATEST CodeSha256 ${latest.CodeSha256} !== S3 package ${s3Sha}`)

  const newest = await getNewestPublishedVersion(outputs.proxyFunctionName)
  assert(newest.CodeSha256 === s3Sha, `version ${newest.Version} CodeSha256 ${newest.CodeSha256} !== S3 package`)

  step('Verifying CloudFront points at the newest proxy version')
  const { associations } = await getDistributionProxyAssociations(outputs.distributionId, outputs.proxyFunctionName)
  assert(associations.length > 0, 'distribution has no proxy associations')
  for (const association of associations) {
    assert(
      association.LambdaFunctionARN === newest.FunctionArn,
      `association ${association.LambdaFunctionARN} !== newest version ${newest.FunctionArn}`
    )
  }

  step('Verifying status page serves the upgraded proxy')
  await waitForDistributionDeployed(outputs.distributionId)
  await pollStatusPage(
    statusUrl,
    `a version other than ${baselineVersion} with all variables set`,
    (html) => parseStatusVersion(html) !== baselineVersion && html.includes(ALL_VARIABLES_SET_TEXT)
  )
}

async function main() {
  const stackName = getEnvOr('EXISTING_STACK_NAME', DEFAULT_STACK_NAME)
  const mgmtZipPath = getEnvOr('MGMT_LAMBDA_ZIP', 'mgmt_lambda_latest.zip')

  step(`Reading outputs of stack ${stackName}`)
  const outputs = getStackOutputs(stackName)
  console.info(outputs)

  const { Distribution } = await cloudFrontClient.send(new GetDistributionCommand({ Id: outputs.distributionId }))
  assert(Distribution?.DomainName !== undefined, `distribution ${outputs.distributionId} has no domain name`)
  // The CloudFormation distribution routes everything to the proxy, so the status page is at the root
  const statusUrl = `https://${Distribution.DomainName}/status`

  step(`Hashing S3 package ${S3_PACKAGE_URL}`)
  const s3Sha = sha256Base64(await download(S3_PACKAGE_URL))
  console.info(`S3 package SHA256 (base64): ${s3Sha}`)

  await swapMgmtLambda(outputs, mgmtZipPath)
  const baselineVersion = await downgradeProxy(outputs, s3Sha, statusUrl)
  await triggerUpdate(outputs)
  await verifyUpgrade(outputs, s3Sha, statusUrl, baselineVersion)

  step('mgmt-lambda E2E test passed')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
