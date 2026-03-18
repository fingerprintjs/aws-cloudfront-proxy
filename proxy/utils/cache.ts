interface CacheItem<T> {
  value: T
  expiresAt: number
}

export class TTLCache<K, V> {
  private cache: Map<K, CacheItem<V>>
  private readonly ttlMs: number

  constructor(ttlMs: number) {
    this.cache = new Map()
    this.ttlMs = ttlMs
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key)
    if (item === undefined) {
      return undefined
    }

    if (Date.now() >= item.expiresAt) {
      this.cache.delete(key)
      return undefined
    }

    return item.value
  }

  set(key: K, value: V, customTtlMs?: number): void {
    const ttlMsToUse =
      typeof customTtlMs === 'number' && Number.isFinite(customTtlMs) && customTtlMs >= 0 ? customTtlMs : this.ttlMs

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMsToUse,
    })
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }
}
