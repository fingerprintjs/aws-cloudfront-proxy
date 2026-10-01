import { CustomerVariablesRecord, CustomerVariableName, CustomerVariableReturn } from '../types'

const allowedKeys = Object.values<string>(CustomerVariableName)

function assertIsCustomerVariableValue(value: unknown, key: string): asserts value is CustomerVariableReturn {
  if (typeof value !== 'string' && value !== null && value !== undefined) {
    throw new TypeError(`Secrets Manager secret contains an invalid value ${key}: ${JSON.stringify(value)}`)
  }
}

function isCustomerVariableName(key: string): key is CustomerVariableName {
  return allowedKeys.includes(key)
}

export function validateSecret(obj: unknown): asserts obj is CustomerVariablesRecord {
  if (obj === null || typeof obj !== 'object') {
    throw new TypeError('Secrets Manager secret is not an object')
  }

  for (const [key, value] of Object.entries(obj)) {
    if (!isCustomerVariableName(key)) {
      console.warn(`Secrets Manager secret contains an invalid key: ${key}`)
      continue
    }

    assertIsCustomerVariableValue(value, key)
  }
}
