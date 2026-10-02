import type { CustomerVariableName, CustomerVariableProvider, CustomerVariableType } from './types.ts'
import { parseCustomerVariable } from './types.ts'
import { getDefaultCustomerVariable } from './defaults.ts'

export interface GetVariableResult<T extends CustomerVariableName> {
  // The customer variable's own type can never be null, but unset variables fall back to
  // their (sometimes null) default, so the resolved value can still be null here.
  value: CustomerVariableType<T> | null
  resolvedBy: string | null
}

/**
 * Allows access to customer defined variables using multiple providers.
 * Variables will be resolved in order in which providers are set.
 * */
export class CustomerVariables {
  constructor(private readonly providers: CustomerVariableProvider[]) {}

  /**
   * Attempts to resolve customer variable using providers.
   * If no provider can resolve the variable, the default value is returned.
   * */
  async getVariable<T extends CustomerVariableName>(variable: T): Promise<GetVariableResult<T>> {
    const providerResult = await this.getValueFromProviders(variable)

    if (providerResult) {
      return providerResult
    }

    const defaultValue = getDefaultCustomerVariable(variable)

    console.debug(`Resolved customer variable ${variable} with default value ${defaultValue}`)

    return {
      value: defaultValue,
      resolvedBy: null,
    }
  }

  private async getValueFromProviders<T extends CustomerVariableName>(
    variable: T
  ): Promise<GetVariableResult<T> | null> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getVariable(variable)

        if (result !== null && result !== undefined) {
          console.debug(`Resolved customer variable ${variable} with provider ${provider.name}`)

          return {
            value: parseCustomerVariable(variable, result),
            resolvedBy: provider.name,
          }
        }
      } catch (error) {
        console.error(`Error while resolving customer variable ${variable} with provider ${provider.name}`, {
          error,
        })
      }
    }

    return null
  }
}
