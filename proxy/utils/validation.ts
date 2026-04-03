export function isNonNegativeInteger(value?: unknown): value is number {
  return Boolean(typeof value === 'number' && Number.isInteger(value) && value >= 0)
}
