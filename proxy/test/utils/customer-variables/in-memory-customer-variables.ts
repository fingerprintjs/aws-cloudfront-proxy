import { CustomerVariableName, CustomerVariableProvider } from '../../../utils/customer-variables/types'
import { CustomerVariables } from '../../../utils/customer-variables/customer-variables'

export function getInMemoryCustomerVariables() {
  const variables = {
    [CustomerVariableName.AgentDownloadPath]: 'download',
    [CustomerVariableName.PreSharedSecret]: 'secret',
    [CustomerVariableName.GetResultPath]: 'result',
    [CustomerVariableName.FpCdnUrl]: 'fpcdn.io',
    [CustomerVariableName.FpIngressBaseHost]: 'api.fpjs.io',
    [CustomerVariableName.BehaviorPathNestLevel]: '1',
  } as Record<CustomerVariableName, string | null | undefined>
  const provider: CustomerVariableProvider = {
    name: 'test provider',
    getVariable: async (variable) => variables[variable],
  }
  const customerVariables = new CustomerVariables([provider])
  return { variables, customerVariables }
}
