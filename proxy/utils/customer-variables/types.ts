export enum CustomerVariableName {
  GetResultPath = 'fpjs_get_result_path',
  BehaviorPathNestLevel = 'fpjs_behavior_path_nest_level',
  PreSharedSecret = 'fpjs_pre_shared_secret',
  AgentDownloadPath = 'fpjs_agent_download_path',
  FpCdnUrl = 'fpjs_cdn_url',
  FpIngressBaseHost = 'fpjs_ingress_base_host',
}

export const internalVariables: Set<CustomerVariableName> = new Set<CustomerVariableName>([
  CustomerVariableName.FpCdnUrl,
  CustomerVariableName.FpIngressBaseHost,
])

const stringParser = (value: string) => value

export const customerVariableParsers = {
  [CustomerVariableName.GetResultPath]: stringParser,
  [CustomerVariableName.BehaviorPathNestLevel]: parseInt,
  [CustomerVariableName.PreSharedSecret]: stringParser,
  [CustomerVariableName.AgentDownloadPath]: stringParser,
  [CustomerVariableName.FpCdnUrl]: stringParser,
  [CustomerVariableName.FpIngressBaseHost]: stringParser,
}

export function parseCustomerVariable<T extends CustomerVariableName>(variable: T, value: string) {
  return customerVariableParsers[variable](value) as CustomerVariableType<T>
}

export type CustomerVariableType<T extends CustomerVariableName> = ReturnType<(typeof customerVariableParsers)[T]>

export type CustomerVariableReturn = string | null | undefined

export type CustomerVariablesRecord = {
  [Key in CustomerVariableName]: CustomerVariableType<Key> | undefined | null
}

export interface CustomerVariableProvider {
  readonly name: string

  getVariable: (variable: CustomerVariableName) => Promise<CustomerVariableReturn>
}
