import { CustomerVariables } from './customer-variables'
import { CustomerVariableName } from './types'

export const OBFUSCATED_VALUE = '********'

export async function maybeObfuscateVariable(customerVariables: CustomerVariables, variable: CustomerVariableName) {
  const result = await customerVariables.getVariable(variable)

  if (variable === CustomerVariableName.PreSharedSecret && result.value) {
    result.value = OBFUSCATED_VALUE
  }

  return result
}
