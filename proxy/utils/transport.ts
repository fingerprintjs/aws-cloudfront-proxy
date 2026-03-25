import https, { RequestOptions } from 'https'
import { updateResponseHeaders } from './index'
import { generateErrorResponse } from './generateErrorResponse'
import { CloudFrontRequest } from 'aws-lambda/common/cloudfront'
import { IncomingMessage, OutgoingHttpHeaders } from 'http'
import { CloudFrontResultResponse } from 'aws-lambda'

type SendHttpRequestResult = {
  response: IncomingMessage
  data: Buffer
}

/**
 * Sends an HTTP request to the specified URL with the given options and data.
 *
 * @param {URL} url - The URL to send the request to.
 * @param {Object} options - The request options.
 * @param {string | undefined} options.data - The base64 encoded string to be sent as the request body.
 * @param {Object} [options.headers] - Additional HTTP headers for the request.
 * @param {string} [options.method] - The HTTP method to use (e.g., "GET", "POST").
 * @return {Promise<SendHttpRequestResult>} A promise that resolves with the result of the HTTP request, including the response and the response data.
 */
function sendHttpRequest(
  url: URL,
  { data, ...options }: RequestOptions & { data: string | undefined }
): Promise<SendHttpRequestResult> {
  return new Promise<SendHttpRequestResult>((resolve, reject) => {
    const request = https.request(url.toString(), options, (response) => {
      const chunks: Buffer[] = []
      const isBinary = Boolean(response.headers['content-encoding'])

      if (isBinary) {
        response.setEncoding('binary')
      }

      response.on('data', (data) => {
        const encoding = isBinary ? 'binary' : undefined
        const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding)

        chunks.push(chunk)
      })

      response.on('error', reject)

      response.on('end', () => {
        const payload = Buffer.concat(chunks)

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

/**
 * Sends an ingress request to the specified URL with the provided request details and headers,
 * processes the response, and returns a formatted CloudFront result.
 *
 * @param {CloudFrontRequest} incomingRequest - The original CloudFront request object containing method, headers, and body.
 * @param {OutgoingHttpHeaders} requestHeaders - The headers to be sent with the HTTP request.
 * @param {URL} requestUrl - The URL endpoint where the request will be sent.
 * @return {Promise<CloudFrontResultResponse>} A promise that resolves to a CloudFront result object containing the response status,
 *                                            headers, body, and encoding.
 */
export async function sendIngressRequest(
  incomingRequest: CloudFrontRequest,
  requestHeaders: OutgoingHttpHeaders,
  requestUrl: URL
): Promise<CloudFrontResultResponse> {
  try {
    console.debug('Sending request to Ingress API', {
      method: incomingRequest.method,
      url: requestUrl.toString(),
      body: incomingRequest.body?.data,
    })

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
