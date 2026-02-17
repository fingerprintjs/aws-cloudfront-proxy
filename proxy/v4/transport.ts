import https, { RequestOptions } from 'https'
import { updateResponseHeaders } from '../utils'
import { generateErrorResponse } from '../utils/generateErrorResponse'
import { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { IncomingMessage, OutgoingHttpHeaders } from 'http'
import { CloudFrontResultResponse } from 'aws-lambda'

type SendHttpRequestResult = {
  response: IncomingMessage
  data: Buffer
}

function sendHttpRequest(
  url: URL,
  { data, ...options }: RequestOptions & { data: string | undefined }
): Promise<SendHttpRequestResult> {
  return new Promise<SendHttpRequestResult>((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      const data: Buffer[] = []
      const isBinary = Boolean(response.headers['content-encoding'])

      response.setEncoding(isBinary ? 'binary' : 'utf8')

      response.on('data', (chunk) => {
        data.push(Buffer.from(chunk, isBinary ? 'binary' : 'utf8'))
      })

      response.on('error', reject)

      response.on('end', () => {
        const payload = Buffer.concat(data)

        resolve({
          response,
          data: payload,
        })
      })
    })

    request.on('error', reject)

    if (data) {
      request.write(Buffer.from(data, 'base64'))
    }
    request.end()
  })
}

export async function sendIngressRequest(
  incomingRequest: CloudFrontRequest,
  requestHeaders: OutgoingHttpHeaders,
  requestUrl: URL
): Promise<CloudFrontResultResponse> {
  try {
    const { response, data } = await sendHttpRequest(requestUrl, {
      method: incomingRequest.method,
      data: incomingRequest.body?.data,
      headers: requestHeaders,
    })
    const isJavascript = response.headers['content-type']?.includes('text/javascript')

    console.debug('Response from Ingress API', {
      statusCode: response.statusCode,
      payload: data.toString('utf-8'),
      isJavascript,
    })

    return {
      status: response.statusCode?.toString() ?? '500',
      statusDescription: response.statusMessage,
      headers: updateResponseHeaders(response.headers, isJavascript),
      bodyEncoding: 'base64',
      body: data.toString('base64'),
    }
  } catch (error) {
    return {
      status: '500',
      statusDescription: 'Bad request',
      headers: {},
      bodyEncoding: 'text',
      body: generateErrorResponse(error as Error),
    }
  }
}
