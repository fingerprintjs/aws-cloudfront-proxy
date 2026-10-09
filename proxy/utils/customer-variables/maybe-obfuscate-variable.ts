import type { CustomerVariables } from './customer-variables.ts'
import { CustomerVariableName } from './types.ts'
import { isTruthy } from '../is-truthy.ts'

export const OBFUSCATED_VALUE = '********'

export async function maybeObfuscateVariable(customerVariables: CustomerVariables, variable: CustomerVariableName) {
  const result = await customerVariables.getVariable(variable)

  if (variable === CustomerVariableName.PreSharedSecret && isTruthy(result.value)) {
    result.value = OBFUSCATED_VALUE
  }

  return result
}
