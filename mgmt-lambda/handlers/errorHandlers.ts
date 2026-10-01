import { APIGatewayProxyResult } from 'aws-lambda'
import { ErrorCode } from '../exceptions'
import { ResourceNotFoundException } from '@aws-sdk/client-lambda'

export function handleNoAuthentication(): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Token is not specified or not valid',
  }
  return Promise.resolve({
    statusCode: 401,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  })
}

export function handleWrongConfiguration(error: unknown): Promise<APIGatewayProxyResult> {
  const body = {
    status:
      'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id',
    error: error instanceof Error ? error.message : error,
  }
  return Promise.resolve({
    statusCode: 500,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  })
}

type ErrorWithCode = Partial<Error> & {
  code?: ErrorCode
}

export function handleError(error: unknown): APIGatewayProxyResult {
  const errorWithCode: ErrorWithCode = error instanceof Error ? error : {}

  if (errorWithCode.name?.includes('AccessDenied') === true) {
    errorWithCode.code = ErrorCode.AWSAccessDenied
  } else if (errorWithCode.name === ResourceNotFoundException.name) {
    errorWithCode.code = ErrorCode.AWSResourceNotFound
  }
  return {
    statusCode: 500,
    body: JSON.stringify({ status: 'Error occurred', errorCode: errorWithCode.code ?? ErrorCode.UnknownError }),
    headers: {
      'content-type': 'application/json',
    },
  }
}

export function handleNotFound(): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Path not found',
  }
  return Promise.resolve({
    statusCode: 404,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  })
}
