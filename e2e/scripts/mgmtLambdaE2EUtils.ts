// Matches both the current markup (`<h3>Lambda function version</h3> <p>X</p>`)
// and the legacy one (`Lambda function version: X`) served by older releases
const STATUS_VERSION_REGEX = /Lambda function version(?::|<\/h3>\s*<p>)\s*([^<\s]+)/

export function parseStatusVersion(html: string): string | undefined {
  return STATUS_VERSION_REGEX.exec(html)?.[1]
}

export interface GitHubReleaseAsset {
  name: string
  state: string
  content_type: string
  browser_download_url: string
}

export interface GitHubRelease {
  tag_name: string
  draft: boolean
  prerelease: boolean
  assets: GitHubReleaseAsset[]
}

export interface DowngradeTarget {
  tag: string
  version: string
  downloadUrl: string
}

// Same naming conventions as scripts/downloadGithubRelease.mjs, including the legacy package name
const PROXY_ASSET_NAMES = ['lambda_latest.zip', 'package.zip']

// Tags come as both `v2.1.1` and `@fingerprint/aws-cloudfront-proxy@2.2.0`
const TAG_VERSION_REGEX = /(\d+\.\d+\.\d+(?:-[\w.]+)?)$/

/**
 * Picks the newest stable release whose proxy package differs from the S3 package.
 * Releases are expected in GitHub API order (newest first).
 * `hashAsset` must return hashes in the same encoding as `s3Sha`.
 */
export async function pickDowngradeRelease(
  releases: GitHubRelease[],
  s3Sha: string,
  hashAsset: (url: string) => Promise<string>
): Promise<DowngradeTarget> {
  for (const release of releases) {
    if (release.draft || release.prerelease) {
      continue
    }

    const asset = release.assets.find(
      (asset) =>
        PROXY_ASSET_NAMES.includes(asset.name) && asset.state === 'uploaded' && asset.content_type === 'application/zip'
    )
    const version = TAG_VERSION_REGEX.exec(release.tag_name)?.[1]
    if (asset === undefined || version === undefined) {
      continue
    }

    if ((await hashAsset(asset.browser_download_url)) !== s3Sha) {
      return { tag: release.tag_name, version, downloadUrl: asset.browser_download_url }
    }
  }

  throw new Error(
    `No stable GitHub release with a proxy package different from the S3 package (checked ${releases.length} releases)`
  )
}
