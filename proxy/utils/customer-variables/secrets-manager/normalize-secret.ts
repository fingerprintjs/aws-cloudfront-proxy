export function normalizeSecret(secret: string): unknown {
  const parsed: unknown = JSON.parse(secret)

  if (parsed === null || typeof parsed !== 'object') {
    return parsed
  }

  const entries = Object.entries(parsed)

  return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), value]))
}
