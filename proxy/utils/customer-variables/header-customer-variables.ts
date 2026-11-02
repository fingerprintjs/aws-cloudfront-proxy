import type { CustomerVariableProvider, CustomerVariableName } from './types.ts'
import type { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../headers.ts'

export class HeaderCustomerVariables implements CustomerVariableProvider {
  readonly name = 'HeaderCustomerVariables'

  constructor(private readonly request: CloudFrontRequest) {}

  getVariable(variable: CustomerVariableName): Promise<string | null> {
    return Promise.resolve(getHeaderValue(this.request, variable))
  }
}
