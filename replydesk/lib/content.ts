// lib/content.ts — fetch per-site content overrides from Edge Config (server-side only)
const SITE_ID = 'replydesk'
const EC_TTL  = 60_000

let _cache: Record<string, string> | null = null
let _cacheAt = 0

export interface ContentOverrides {
  headline?:    string
  subheadline?: string
  cta?:         string
  tagline?:     string
}

export async function getContentOverrides(): Promise<ContentOverrides> {
  if (_cache && Date.now() - _cacheAt < EC_TTL) return _cache as ContentOverrides
  const connStr = process.env.EDGE_CONFIG
  if (!connStr) return {}
  try {
    const url   = new URL(connStr)
    const ecId  = url.pathname.replace('/', '')
    const token = url.searchParams.get('token')
    const res = await fetch(
      `https://api.vercel.com/v1/edge-config/${ecId}/items`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 60 } } as RequestInit,
    )
    if (!res.ok) return {}
    const items: Array<{ key: string; value: unknown }> = await res.json()
    const prefix = `content_${SITE_ID}_`
    const overrides: Record<string, string> = {}
    for (const { key, value } of items) {
      if (key.startsWith(prefix) && typeof value === 'string' && value.trim()) {
        overrides[key.replace(prefix, '')] = value
      }
    }
    _cache   = overrides
    _cacheAt = Date.now()
    return overrides as ContentOverrides
  } catch {
    return {}
  }
}
