// Downloads the Lambda packages of the release that triggered the publish workflow and verifies them
// against a local build of the tagged commit. Fails closed on any missing or unexpected input.
//
// Required environment:
//   GITHUB_REPOSITORY - owner/repo of the current repository (set by GitHub Actions)
//   GITHUB_TOKEN      - token used to authenticate GitHub API requests
//   RELEASE_ID        - id of the release from the event payload (github.event.release.id)
//   TAG               - tag name from the event payload (github.event.release.tag_name)
// The `dist` directory must contain the output of `pnpm build` for the tagged commit.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Zip from 'adm-zip'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')

// Release asset name -> the single file the package must contain, as produced by `pnpm build`
const expectedAssets = {
  'lambda_latest.zip': 'fingerprintjs-pro-cloudfront-lambda-function.js',
  'mgmt_lambda_latest.zip': 'fingerprintjs-pro-cloudfront-mgmt-lambda-function.js',
}

// The license banner contains the build year, which may differ between the release build and this rebuild
const BANNER_YEAR_REGEX =
  /^( \* Fingerprint Pro CloudFront Lambda function v\S+ - Copyright \(c\) FingerprintJS, Inc, )\d{4}( )/m

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

async function githubGet(url, token, accept) {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'aws-cloudfront-proxy-publish',
    },
  })
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`)
  }
  return response
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function normalizeBundle(content) {
  return content.toString('utf8').replace(BANNER_YEAR_REGEX, '$1YYYY$2')
}

function verifyAgainstBuild(assetName, zipBuffer) {
  const expectedEntry = expectedAssets[assetName]
  const entries = new Zip(zipBuffer).getEntries().filter((entry) => !entry.isDirectory)

  if (entries.length !== 1 || entries[0].entryName !== expectedEntry) {
    const names = entries.map((entry) => entry.entryName).join(', ')
    throw new Error(`${assetName} must contain only ${expectedEntry}, got: ${names || 'nothing'}`)
  }

  const builtPath = path.join(distDir, expectedEntry)
  if (!fs.existsSync(builtPath)) {
    throw new Error(`${builtPath} not found, run \`pnpm build\` on the tagged commit first`)
  }

  if (normalizeBundle(entries[0].getData()) !== normalizeBundle(fs.readFileSync(builtPath))) {
    throw new Error(`${assetName} does not match the build of the tagged commit`)
  }
}

async function main() {
  const repository = requireEnv('GITHUB_REPOSITORY')
  const token = requireEnv('GITHUB_TOKEN')
  const releaseId = requireEnv('RELEASE_ID')
  const tag = requireEnv('TAG')

  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error(`Unexpected GITHUB_REPOSITORY: ${repository}`)
  }
  if (!/^\d+$/.test(releaseId)) {
    throw new Error(`Unexpected RELEASE_ID: ${releaseId}`)
  }

  const apiBase = `https://api.github.com/repos/${repository}`
  const release = await (
    await githubGet(`${apiBase}/releases/${releaseId}`, token, 'application/vnd.github+json')
  ).json()

  if (release.tag_name !== tag) {
    throw new Error(`Release ${releaseId} has tag ${release.tag_name}, expected ${tag}`)
  }
  if (release.draft) {
    throw new Error(`Release ${releaseId} is a draft`)
  }

  console.info(`Release ${tag} (${releaseId}) from ${repository}`)

  for (const assetName of Object.keys(expectedAssets)) {
    const matches = (release.assets ?? []).filter((asset) => asset.name === assetName)
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${assetName} asset, found ${matches.length}`)
    }
    const asset = matches[0]
    if (asset.state !== 'uploaded') {
      throw new Error(`${assetName} is in state ${asset.state}`)
    }

    const response = await githubGet(
      `${apiBase}/releases/assets/${encodeURIComponent(asset.id)}`,
      token,
      'application/octet-stream'
    )
    const zip = Buffer.from(await response.arrayBuffer())

    if (zip.length === 0 || zip.length !== asset.size) {
      throw new Error(`${assetName}: downloaded ${zip.length} bytes, expected ${asset.size}`)
    }

    const hash = sha256(zip)
    if (asset.digest && asset.digest !== `sha256:${hash}`) {
      throw new Error(`${assetName}: digest mismatch, got sha256:${hash}, GitHub reports ${asset.digest}`)
    }

    verifyAgainstBuild(assetName, zip)

    fs.writeFileSync(path.join(rootDir, assetName), zip)
    console.info(`${assetName}: verified, sha256 ${hash}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
