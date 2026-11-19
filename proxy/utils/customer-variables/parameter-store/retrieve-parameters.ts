import type { CustomerVariablesRecord } from '../types.ts'
import type { Parameter, SSMClient } from '@aws-sdk/client-ssm'
import { GetParametersByPathCommand } from '@aws-sdk/client-ssm'
import { validateParameters } from './validate-parameters.ts'
import { TTLCache } from '../../cache.ts'

/**
 * Global cache for customer variables fetched from Parameter Store.
 * By default, the cache is set to expire after 5 minutes.
 * */
const cache = new TTLCache<string, CustomerVariablesRecord | null>(300_000)

/**
 * Failed fetches (e.g. throttling) are cached only briefly, so that a single error doesn't leave
 * a Lambda instance without its settings for the whole cache TTL, while still protecting
 * Parameter Store from a retry storm.
 * */
export const FAILURE_CACHE_TTL_MS = 5_000

/**
 * Retrieves all parameters under the given path from Parameter Store and caches them,
 * or returns them from cache if it's still valid.
 * */
export async function retrieveParameters(ssm: SSMClient, path: string, cacheTtlMs?: number) {
  const cached = cache.get(path)
  if (cached !== undefined) {
    return cached
  }

  try {
    const result = await fetchParameters(ssm, path)
    cache.set(path, result, cacheTtlMs)

    return result
  } catch (error) {
    console.error(`Failed to fetch parameters under ${path}`, { error })
    cache.set(path, null, Math.min(FAILURE_CACHE_TTL_MS, cacheTtlMs ?? FAILURE_CACHE_TTL_MS))

    return null
  }
}

/**
 * Turns `/some/path/FPJS_GET_RESULT_PATH` into `fpjs_get_result_path`.
 * */
function toVariableKey(parameterName: string): string {
  return (parameterName.split('/').pop() ?? '').toLowerCase()
}

async function fetchParameters(ssm: SSMClient, path: string): Promise<CustomerVariablesRecord | null> {
  const parameters: Parameter[] = []
  let nextToken: string | undefined

  do {
    const result = await ssm.send(
      new GetParametersByPathCommand({
        Path: path,
        Recursive: false,
        // SecureString values (e.g. the pre-shared secret) are decrypted, String values are returned as-is.
        WithDecryption: true,
        NextToken: nextToken,
      })
    )
    parameters.push(...(result.Parameters ?? []))
    nextToken = result.NextToken
  } while (nextToken !== undefined && nextToken !== '')

  if (parameters.length === 0) {
    return null
  }

  const record: Record<string, string | undefined> = {}
  for (const { Name, Value } of parameters) {
    if (Name !== undefined && Name !== '') {
      record[toVariableKey(Name)] = Value
    }
  }

  validateParameters(record)
  return record
}

export function clearParametersCache() {
  cache.clear()
}
