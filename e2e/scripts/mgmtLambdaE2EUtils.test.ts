import { type GitHubRelease, parseStatusVersion, pickDowngradeRelease } from './mgmtLambdaE2EUtils.ts'

describe('parseStatusVersion', () => {
  it('reads the version from the current status page markup', () => {
    const html = `
      <div class="item">
          <h3>Lambda function version</h3> 
          <p>2.2.0</p>
      </div>`

    expect(parseStatusVersion(html)).toBe('2.2.0')
  })

  it('reads the version from the legacy status page markup', () => {
    const html = `
        <div>
          Lambda function version: 2.1.1
        </div>`

    expect(parseStatusVersion(html)).toBe('2.1.1')
  })

  it('returns undefined when the page has no version', () => {
    expect(parseStatusVersion('<html>Not found</html>')).toBeUndefined()
  })
})

describe('pickDowngradeRelease', () => {
  const S3_SHA = 'sha-of-2.2.0'

  function release(tag_name: string, assetName: string, overrides: Partial<GitHubRelease> = {}): GitHubRelease {
    return {
      tag_name,
      draft: false,
      prerelease: false,
      assets: [
        {
          name: 'mgmt_lambda_latest.zip',
          state: 'uploaded',
          content_type: 'application/zip',
          browser_download_url: `https://example.com/${tag_name}/mgmt_lambda_latest.zip`,
        },
        {
          name: assetName,
          state: 'uploaded',
          content_type: 'application/zip',
          browser_download_url: `https://example.com/${tag_name}/${assetName}`,
        },
      ],
      ...overrides,
    }
  }

  const shaByUrl: Record<string, string> = {
    'https://example.com/@fingerprint/aws-cloudfront-proxy@2.2.1-rc.0/lambda_latest.zip': 'sha-of-rc',
    'https://example.com/@fingerprint/aws-cloudfront-proxy@2.3.0/lambda_latest.zip': 'sha-of-draft',
    'https://example.com/@fingerprint/aws-cloudfront-proxy@2.2.0/lambda_latest.zip': S3_SHA,
    'https://example.com/v2.1.1/lambda_latest.zip': 'sha-of-2.1.1',
    'https://example.com/v1.0.0/package.zip': 'sha-of-1.0.0',
  }
  const hashAsset = (url: string) => Promise.resolve(shaByUrl[url])

  it('picks the newest stable release whose proxy package differs from S3', async () => {
    const releases = [
      release('@fingerprint/aws-cloudfront-proxy@2.3.0', 'lambda_latest.zip', { draft: true }),
      release('@fingerprint/aws-cloudfront-proxy@2.2.1-rc.0', 'lambda_latest.zip', { prerelease: true }),
      release('@fingerprint/aws-cloudfront-proxy@2.2.0', 'lambda_latest.zip'),
      release('v2.1.1', 'lambda_latest.zip'),
      release('v1.0.0', 'package.zip'),
    ]

    const picked = await pickDowngradeRelease(releases, S3_SHA, hashAsset)

    expect(picked).toEqual({
      tag: 'v2.1.1',
      version: '2.1.1',
      downloadUrl: 'https://example.com/v2.1.1/lambda_latest.zip',
    })
  })

  it('matches the legacy package.zip asset', async () => {
    const releases = [
      release('@fingerprint/aws-cloudfront-proxy@2.2.0', 'lambda_latest.zip'),
      release('v1.0.0', 'package.zip'),
    ]

    const picked = await pickDowngradeRelease(releases, S3_SHA, hashAsset)

    expect(picked.version).toBe('1.0.0')
  })

  it('fails with a descriptive error when no release differs from S3', async () => {
    const releases = [release('@fingerprint/aws-cloudfront-proxy@2.2.0', 'lambda_latest.zip')]

    await expect(pickDowngradeRelease(releases, S3_SHA, hashAsset)).rejects.toThrow(
      'No stable GitHub release with a proxy package different from the S3 package'
    )
  })
})
