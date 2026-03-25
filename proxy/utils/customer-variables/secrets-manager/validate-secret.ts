import { CustomerVariablesRecord, CustomerVariableName, CustomerVariableReturn } from '../types'

const allowedKeys = Object.values(CustomerVariableName)

function assertIsCustomerVariableValue(value: unknown, key: string): asserts value is CustomerVariableReturn {
  if (typeof value !== 'string' && value !== null && value !== undefined) {
    throw new TypeError(`Secrets Manager secret contains an invalid value ${key}: ${value}`)
  }
}

export function validateSecret(obj: unknown): asserts obj is CustomerVariablesRecord {
  if (!obj || typeof obj !== 'object') {
    throw new TypeError('Secrets Manager secret is not an object')
  }

  const secret = obj as Record<CustomerVariableName, CustomerVariableReturn>

  for (const [key, value] of Object.entries(secret)) {
    if (!allowedKeys.includes(key as CustomerVariableName)) {
      console.warn(`Secrets Manager secret contains an invalid key: ${key}`)
      continue
    }

    assertIsCustomerVariableValue(value, key)
  }
}
