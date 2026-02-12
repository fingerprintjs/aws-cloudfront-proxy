import { CustomerVariableProvider, CustomerVariableName } from './types'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../headers'

export class HeaderCustomerVariables implements CustomerVariableProvider {
  readonly name = 'HeaderCustomerVariables'

  constructor(private readonly request: CloudFrontRequest) {}

  async getVariable(variable: CustomerVariableName): Promise<string | null> {
    return getHeaderValue(this.request, variable)
  }
}
