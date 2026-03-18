import { CustomerVariablesRecord } from '../types'
import {
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import { arrayBufferToString } from '../../buffer'
import { validateSecret } from './validate-secret'
import { normalizeSecret } from './normalize-secret'
import { TTLCache } from '../../cache'

/**
 * Global cache for customer variables fetched from Secrets Manager.
 * By default, the cache is set to expire after 5 minutes.
 * */
const cache = new TTLCache<string, CustomerVariablesRecord | null>(300_000)

/**
 * Retrieves a secret from Secrets Manager and caches it or returns it from cache if it's still valid.
 * */
export async function retrieveSecret(secretsManager: SecretsManagerClient, key: string, cacheTtlMs?: number) {
  if (cache.has(key)) {
    return cache.get(key)!
  }

  const result = await fetchSecret(secretsManager, key)

  cache.set(key, result, cacheTtlMs)

  return result
}

function convertSecretToString(result: GetSecretValueCommandOutput): string {
  if (result.SecretBinary) {
    return arrayBufferToString(result.SecretBinary)
  } else {
    return result.SecretString || ''
  }
}

async function fetchSecret(secretsManager: SecretsManagerClient, key: string): Promise<CustomerVariablesRecord | null> {
  try {
    const command = new GetSecretValueCommand({
      SecretId: key,
    })
    const result = await secretsManager.send(command)

    const secretString = convertSecretToString(result)

    if (!secretString) {
      return null
    }

    const parsedSecret = normalizeSecret(secretString)
    validateSecret(parsedSecret)
    return parsedSecret
  } catch (error) {
    console.error(`Failed to fetch and parse secret ${key}`, { error })

    return null
  }
}

export function clearSecretsCache() {
  cache.clear()
}
