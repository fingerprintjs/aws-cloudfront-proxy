import type { CustomerVariableProvider, CustomerVariableName, CustomerVariableReturn } from '../types.ts'
import { SSMClient } from '@aws-sdk/client-ssm'
import type { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../../headers.ts'
import { retrieveParameters } from './retrieve-parameters.ts'
import { DEFAULT_REGION, PARAMETER_PATH_HEADER_KEY } from '../defaults.ts'
import { isTruthy } from '../../is-truthy.ts'

/**
 * Resolves customer variables from AWS Systems Manager Parameter Store.
 *
 * Every variable is stored as its own parameter under a common path, e.g.:
 *  - `/fingerprint/<id>/fpjs_get_result_path` (String)
 *  - `/fingerprint/<id>/fpjs_agent_download_path` (String)
 *  - `/fingerprint/<id>/fpjs_pre_shared_secret` (SecureString)
 *
 * The path is passed to the Lambda@Edge function through the `FPJS_PARAMETER_PATH` origin custom header,
 * since Lambda@Edge functions do not support environment variables.
 * */
export class ParameterStoreVariables implements CustomerVariableProvider {
  readonly name = 'ParameterStoreVariables'

  private readonly parameterPath: string | null

  private readonly ssm?: SSMClient

  constructor(
    request: CloudFrontRequest,
    private readonly cacheTtlMs?: number
  ) {
    this.parameterPath = normalizePath(getHeaderValue(request, PARAMETER_PATH_HEADER_KEY))

    if (isTruthy(this.parameterPath)) {
      try {
        this.ssm = new SSMClient({ region: DEFAULT_REGION })
      } catch (error) {
        console.error('Failed to create SSM client', { error, parameterPath: this.parameterPath })
      }
    }
  }

  async getVariable(variable: CustomerVariableName): Promise<CustomerVariableReturn> {
    if (!this.ssm || !isTruthy(this.parameterPath)) {
      return null
    }

    try {
      const parameters = await retrieveParameters(this.ssm, this.parameterPath, this.cacheTtlMs)
      const value = parameters?.[variable]

      return value === null || value === undefined ? null : value.toString()
    } catch (error) {
      console.error('Error retrieving parameters from Parameter Store', { error, parameterPath: this.parameterPath })

      return null
    }
  }
}

function normalizePath(path: string | null): string | null {
  if (!isTruthy(path)) {
    return null
  }

  const trimmed = path.trim().replace(/\/+$/, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
