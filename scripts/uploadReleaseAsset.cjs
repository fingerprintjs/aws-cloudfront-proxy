const fs = require('fs')
const path = require('path')

module.exports = async ({ context, github }) => {
  const assetPaths = process.env.ASSET_PATH.split(',').map((p) => p.trim())

  if (assetPaths.some((p) => !fs.existsSync(p))) {
    throw new Error(`Asset not found: ${assetPaths}`)
  }

  const owner = context.repo.owner
  const repo = context.repo.repo
  const releaseId = context.payload.release.id
  const name = assetPaths.split('/').pop()

  for (const assetPath of assetPaths) {
    const data = fs.readFileSync(assetPath)
    const assetName = path.basename(assetPath)

    // Delete existing asset with the same name (if any)
    const { data: assets } = await github.request('GET /repos/{owner}/{repo}/releases/{release_id}/assets', {
      owner,
      repo,
      release_id: releaseId,
    })
    const existing = assets.find((a) => a.name === name)
    if (existing) {
      await github.request('DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}', {
        owner,
        repo,
        asset_id: existing.id,
      })
    }

    // Upload asset (use uploads.github.com via the provided upload_url)
    const uploadUrl = context.payload.release.upload_url // https://uploads.github.com/.../assets{?name,label}
    await github.request({
      method: 'POST',
      url: uploadUrl,
      headers: {
        'content-type': 'application/javascript',
        'content-length': data.length,
      },
      name: assetName,
      data,
    })
  }
}
