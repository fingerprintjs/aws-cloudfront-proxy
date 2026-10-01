import { CustomerVariableName, CustomerVariablesRecord, CustomerVariableType } from './types'

const defaultCustomerVariables = {
  [CustomerVariableName.GetResultPath]: null,
  [CustomerVariableName.PreSharedSecret]: null,
  [CustomerVariableName.AgentDownloadPath]: null,
  [CustomerVariableName.FpCdnUrl]: '__FPCDN__',
  [CustomerVariableName.FpIngressBaseHost]: '__INGRESS_API__',
  [CustomerVariableName.BehaviorPathNestLevel]: 1,
} satisfies CustomerVariablesRecord

export function getDefaultCustomerVariable<T extends CustomerVariableName>(
  variable: T
): CustomerVariableType<T> | null {
  // TS can't narrow the return type of a dynamically-indexed lookup across a union-keyed record.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return defaultCustomerVariables[variable] as CustomerVariableType<T> | null
}

export const DEFAULT_REGION = 'us-east-1'
export const SECRET_NAME_HEADER_KEY = 'fpjs_secret_name'
