import { TTLCache } from '../../utils/cache'

describe('TTLCache', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should store and retrieve values', () => {
    const cache = new TTLCache<string, string>(1000)
    cache.set('key1', 'value1')

    expect(cache.get('key1')).toBe('value1')
    expect(cache.has('key1')).toBe(true)
  })

  test('should return undefined for missing keys', () => {
    const cache = new TTLCache<string, string>(1000)

    expect(cache.get('missingKey')).toBeUndefined()
    expect(cache.has('missingKey')).toBe(false)
  })

  test('should expire items after default TTL', () => {
    const cache = new TTLCache<string, string>(1000)
    cache.set('key1', 'value1')

    expect(cache.get('key1')).toBe('value1')

    // Advance time past TTL
    jest.advanceTimersByTime(1001)

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.has('key1')).toBe(false)
  })

  test('should expire items after default TTL for null values', () => {
    const cache = new TTLCache<string, string | null>(1000)
    cache.set('key1', null)

    expect(cache.get('key1')).toBeNull()
    expect(cache.has('key1')).toBe(true)

    // Advance time past TTL
    jest.advanceTimersByTime(1001)

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.has('key1')).toBe(false)
  })

  test('should respect custom TTL per item', () => {
    const cache = new TTLCache<string, string>(1000)

    // Item with shorter TTL
    cache.set('key1', 'value1', 500)
    // Item with longer TTL
    cache.set('key2', 'value2', 2000)

    // Advance past first item's TTL but before second item's TTL
    jest.advanceTimersByTime(1000)

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBe('value2')

    // Advance past second item's TTL
    jest.advanceTimersByTime(1001)

    expect(cache.get('key2')).toBeUndefined()
  })

  test('should delete items', () => {
    const cache = new TTLCache<string, string>(1000)
    cache.set('key1', 'value1')

    expect(cache.get('key1')).toBe('value1')

    cache.delete('key1')

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.has('key1')).toBe(false)
  })

  test('should clear all items', () => {
    const cache = new TTLCache<string, string>(1000)
    cache.set('key1', 'value1')
    cache.set('key2', 'value2')

    cache.clear()

    expect(cache.get('key1')).toBeUndefined()
    expect(cache.get('key2')).toBeUndefined()
  })

  test('has() should trigger eviction if item is expired', () => {
    const cache = new TTLCache<string, string>(1000)
    cache.set('key1', 'value1')

    jest.advanceTimersByTime(1001)

    expect(cache.has('key1')).toBe(false)
    // Underlying map should have been cleaned up by has() which calls get()
    expect(cache.get('key1')).toBeUndefined()
  })
})
