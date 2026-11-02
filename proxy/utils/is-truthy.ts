export function isTruthy<T>(value: T | undefined | null | '' | 0): value is T {
  return Boolean(value)
}
