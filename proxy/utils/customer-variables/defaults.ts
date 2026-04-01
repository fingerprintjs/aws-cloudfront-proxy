import { CustomerVariableName, CustomerVariablesRecord, CustomerVariableType } from './types'

const defaultCustomerVariables = {
  [CustomerVariableName.GetResultPath]: null,
  [CustomerVariableName.PreSharedSecret]: null,
  [CustomerVariableName.AgentDownloadPath]: null,
  [CustomerVariableName.FpCdnUrl]: '__FPCDN__',
  [CustomerVariableName.FpIngressBaseHost]: '__INGRESS_API__',
  [CustomerVariableName.BehaviorPathNestLevel]: 1,
} satisfies CustomerVariablesRecord

export function getDefaultCustomerVariable<T extends CustomerVariableName>(variable: T): CustomerVariableType<T> {
  return defaultCustomerVariables[variable] as CustomerVariableType<T>
}

export const DEFAULT_REGION = 'us-east-1'
export const SECRET_NAME_HEADER_KEY = 'fpjs_secret_name'
