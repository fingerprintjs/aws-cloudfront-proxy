import { CustomerVariables, GetVariableResult } from './customer-variables'
import { CustomerVariableName } from './types'

const extractVariable = <T extends CustomerVariableName>(result: GetVariableResult<T>) => result.value

export const getAgentUri = async (variables: CustomerVariables) => {
  const agentDownloadPath = await getAgentDownloadPath(variables)

  return agentDownloadPath ? `/${agentDownloadPath}` : null
}

export const getResultUri = async (variables: CustomerVariables) => {
  const resultPath = await getResultPath(variables)

  return resultPath ? `/${resultPath}(/.*)?` : null
}

export const getStatusUri = () => `/status`

export const getAgentDownloadPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.AgentDownloadPath).then(extractVariable)

export const getResultPath = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.GetResultPath).then(extractVariable)

export const getPreSharedSecret = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.PreSharedSecret).then(extractVariable)

export const getFpCdnUrl = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.FpCdnUrl).then(extractVariable)

export const getFpIngressBaseHost = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.FpIngressBaseHost).then(extractVariable)

export const getBehaviorPathNestLevel = async (variables: CustomerVariables) =>
  variables.getVariable(CustomerVariableName.BehaviorPathNestLevel).then(extractVariable)
