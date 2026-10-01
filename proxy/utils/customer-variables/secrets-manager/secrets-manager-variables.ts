import { CustomerVariableProvider, CustomerVariableName, CustomerVariableReturn } from '../types'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from '../../headers'
import { retrieveSecret } from './retrieve-secret'
import { NonNullableObject } from '../../types'
import { DEFAULT_REGION, SECRET_NAME_HEADER_KEY } from '../defaults'

interface SecretsInfo {
  secretName: string | null
  secretRegion: string | null
}

export class SecretsManagerVariables implements CustomerVariableProvider {
  readonly name = 'SecretsManagerVariables'

  private secretsInfo?: SecretsInfo

  private validSecretsInfo?: NonNullableObject<SecretsInfo>

  private readonly secretsManager?: SecretsManagerClient

  constructor(
    private readonly request: CloudFrontRequest,
    private readonly cacheTtlMs?: number
  ) {
    this.readSecretsInfoFromHeaders()

    if (SecretsManagerVariables.isValidSecretInfo(this.secretsInfo)) {
      this.validSecretsInfo = this.secretsInfo

      try {
        this.secretsManager = new SecretsManagerClient({ region: this.secretsInfo.secretRegion })
      } catch (error) {
        console.error('Failed to create secrets manager', {
          error,
          secretsInfo: this.secretsInfo,
        })
      }
    }
  }

  async getVariable(variable: CustomerVariableName): Promise<CustomerVariableReturn> {
    const secretsObject = await this.retrieveSecrets()

    if (secretsObject === null) {
      return null
    }

    const value = secretsObject[variable]

    return value === null || value === undefined ? null : value.toString()
  }

  private async retrieveSecrets() {
    if (!this.secretsManager || !this.validSecretsInfo) {
      return null
    }

    try {
      return await retrieveSecret(this.secretsManager, this.validSecretsInfo.secretName, this.cacheTtlMs)
    } catch (error) {
      console.error('Error retrieving secret from secrets manager', {
        error,
        secretsInfo: this.secretsInfo,
      })

      return null
    }
  }

  private readSecretsInfoFromHeaders() {
    this.secretsInfo ??= {
      secretName: getHeaderValue(this.request, SECRET_NAME_HEADER_KEY),
      secretRegion: DEFAULT_REGION,
    }
  }

  private static isValidSecretInfo(secretsInfo?: SecretsInfo): secretsInfo is NonNullableObject<SecretsInfo> {
    return (
      secretsInfo !== undefined &&
      secretsInfo.secretRegion !== null &&
      secretsInfo.secretRegion !== '' &&
      secretsInfo.secretName !== null &&
      secretsInfo.secretName !== ''
    )
  }
}
