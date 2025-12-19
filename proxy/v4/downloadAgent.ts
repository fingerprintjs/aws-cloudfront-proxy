import { CloudFrontResultResponse } from 'aws-lambda'
import { addTrafficMonitoringSearchParamsForProCDN, updateResponseHeadersForAgentDownload } from '../utils'
import https from 'https'
import { OutgoingHttpHeaders } from 'http'

type AgentOptionsV4 = {
  path: string
  querystring: string
  fpCdnUrl: string
  method: string
  headers: OutgoingHttpHeaders
}

export function downloadAgent(options: AgentOptionsV4): Promise<CloudFrontResultResponse> {
  return new Promise((resolve) => {
    const data: any[] = []

    const url = new URL(`https://${options.fpCdnUrl}`)

    if (options.path) {
      url.pathname = options.path
    }
    if (options.querystring) {
      url.search = options.querystring
    }
    addTrafficMonitoringSearchParamsForProCDN(url)

    console.debug(`Downloading agent from: ${url.toString()}`)

    const request = https.request(
      url,
      {
        method: options.method,
        headers: options.headers,
      },
      (response) => {
        let binary = false
        if (response.headers['content-encoding']) {
          binary = true
        }

        response.setEncoding(binary ? 'binary' : 'utf8')

        response.on('data', (chunk) => data.push(Buffer.from(chunk, 'binary')))

        response.on('end', () => {
          const body = Buffer.concat(data)
          resolve({
            status: response.statusCode ? response.statusCode.toString() : '500',
            statusDescription: response.statusMessage,
            headers: updateResponseHeadersForAgentDownload(response.headers),
            bodyEncoding: 'base64',
            body: body.toString('base64'),
          })
        })
      }
    )

    request.on('error', (error) => {
      console.error('unable to download agent', { error })
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: 'error',
      })
    })

    request.end()
  })
}
