import { CustomerVariableName } from '../../../utils/customer-variables/types.ts'
import { maybeObfuscateVariable, OBFUSCATED_VALUE } from '../../../utils/customer-variables/maybe-obfuscate-variable.ts'
import { getInMemoryCustomerVariables } from './in-memory-customer-variables.ts'

const { variables, customerVariables } = getInMemoryCustomerVariables()

describe('maybe obfuscate variable', () => {
  it('should obfuscate pre shared secret', async () => {
    const result = await maybeObfuscateVariable(customerVariables, CustomerVariableName.PreSharedSecret)

    expect(result.value).toBe(OBFUSCATED_VALUE)
  })

  it.each([CustomerVariableName.GetResultPath, CustomerVariableName.AgentDownloadPath])(
    'should not obfuscate other variables',
    async (variable) => {
      const result = await maybeObfuscateVariable(customerVariables, variable)

      expect(result.value).toBe(variables[variable])
    }
  )
})
