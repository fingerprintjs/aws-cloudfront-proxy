import https from 'https'
import { updateResponseHeaders } from '../utils'
import { generateErrorResponse } from '../utils/generateErrorResponse'
import { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { OutgoingHttpHeaders } from 'http'
import { CloudFrontResultResponse } from 'aws-lambda'

export function sendIngressRequest(
  incomingRequest: CloudFrontRequest,
  requestHeaders: OutgoingHttpHeaders,
  requestUrl: URL
) {
  return new Promise<CloudFrontResultResponse>((resolve) => {
    const request = https.request(
      requestUrl,
      {
        method: incomingRequest.method,
        headers: requestHeaders,
      },
      (response) => {
        const data: Buffer[] = []
        const isBinary = Boolean(response.headers['content-encoding'])
        const isJavascript = response.headers['content-type']?.includes('text/javascript')

        response.setEncoding(isBinary ? 'binary' : 'utf8')

        response.on('data', (chunk) => {
          data.push(Buffer.from(chunk, isBinary ? 'binary' : 'utf8'))
        })

        response.on('end', () => {
          const payload = Buffer.concat(data)

          console.debug('Response from Ingress API', {
            statusCode: response.statusCode,
            payload: payload.toString('utf-8'),
            isBinary,
            isJavascript,
          })

          resolve({
            status: response.statusCode?.toString() ?? '500',
            statusDescription: response.statusMessage,
            headers: updateResponseHeaders(response.headers, isJavascript),
            bodyEncoding: 'base64',
            body: payload.toString('base64'),
          })
        })
      }
    )

    if (incomingRequest.body?.data) {
      request.write(Buffer.from(incomingRequest.body.data, 'base64'))
    }

    request.on('error', (error) => {
      console.error('ingress request error', { error })
      resolve({
        status: '500',
        statusDescription: 'Bad request',
        headers: {},
        bodyEncoding: 'text',
        body: generateErrorResponse(error),
      })
    })

    request.end()
  })
}
