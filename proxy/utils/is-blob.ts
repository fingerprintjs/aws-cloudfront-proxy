import type { Blob } from 'buffer'

/**
 * Special check for Blob in order to avoid doing "instanceof Blob" which breaks rollup build
 * */
export function isBlob(value: unknown): value is Blob {
  return (
    value !== null &&
    typeof value === 'object' &&
    // In our case we only care about .text() method
    'text' in value &&
    typeof value.text === 'function'
  )
}
