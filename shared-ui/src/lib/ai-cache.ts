/**
 * createAICache — wraps any AI SDK LanguageModel with a KV-backed cache.
 * Identical prompts return cached responses, burning zero tokens.
 *
 * Usage (in your app's route.ts or lib/ai.ts):
 *   import { createAICache } from '@infosiva/shared-ui/lib/ai-cache'
 *   const cachedModel = createAICache(model, { store: kv, ttl: 3600 })
 *
 * KVStore interface is compatible with:
 *   - @vercel/kv
 *   - ioredis
 *   - node-cache (in-memory, for dev)
 *   - Any object with get(key)/set(key, value, ttl) methods
 */

export interface KVStore {
  get(key: string): Promise<string | null | undefined>
  set(key: string, value: string, ttl?: number): Promise<void>
}

export interface AICacheOptions {
  store: KVStore
  ttl?: number          // seconds, default 3600
  keyPrefix?: string    // default 'ai-cache:'
}

function hashPrompt(prompt: string): string {
  let h = 0
  for (let i = 0; i < prompt.length; i++) {
    h = (Math.imul(31, h) + prompt.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

/**
 * Wraps an AI model call function with caching.
 * Does NOT depend on @ai-sdk/core so it works without locking to a specific AI SDK version.
 *
 * Instead of wrapping the model object directly (which requires LanguageModelMiddleware),
 * wrap the call site:
 *
 *   const cache = createAICache({ store: kv, ttl: 3600 })
 *   const result = await cache.wrap(promptKey, () => generateText({ model, prompt }))
 */
export function createAICache(options: AICacheOptions) {
  const { store, ttl = 3600, keyPrefix = 'ai-cache:' } = options

  async function wrap<T>(
    prompt: string,
    fn: () => Promise<T>,
    serialise?: (v: T) => string,
    deserialise?: (s: string) => T,
  ): Promise<T> {
    const key = keyPrefix + hashPrompt(prompt)
    const ser = serialise ?? JSON.stringify
    const deser = (deserialise ?? JSON.parse) as (s: string) => T

    const cached = await store.get(key)
    if (cached) return deser(cached)

    const result = await fn()
    await store.set(key, ser(result), ttl)
    return result
  }

  return { wrap }
}

/**
 * Simple in-memory KV store for development/testing.
 * Does NOT persist across restarts.
 */
export function createMemoryStore(defaultTtl = 3600): KVStore {
  const map = new Map<string, { value: string; expires: number }>()

  return {
    async get(key) {
      const entry = map.get(key)
      if (!entry) return null
      if (Date.now() > entry.expires) { map.delete(key); return null }
      return entry.value
    },
    async set(key, value, ttl = defaultTtl) {
      map.set(key, { value, expires: Date.now() + ttl * 1000 })
    },
  }
}
