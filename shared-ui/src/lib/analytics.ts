/**
 * Analytics — VPS visit tracker utilities.
 * Fetches real visitor counts from the VPS tracker API.
 * Server-side only (Next.js Server Components / API routes).
 *
 * VPS tracker: http://31.97.56.148:3098
 * Endpoints:
 *   GET /stats?site=<domain>  → { visitors: N, pageviews: N, today: N }
 */

const TRACKER_BASE = process.env.TRACKER_API_URL ?? 'http://31.97.56.148:3098'
const STATS_TTL = 120_000 // 2 min cache

const _cache: Record<string, { data: SiteStats; at: number }> = {}

export interface SiteStats {
  visitors: number
  pageviews: number
  today: number
}

/**
 * Fetch live visitor stats for a domain.
 * Returns zeros on failure (never throws).
 */
export async function getSiteStats(domain: string): Promise<SiteStats> {
  const now = Date.now()
  if (_cache[domain] && now - _cache[domain].at < STATS_TTL) {
    return _cache[domain].data
  }

  try {
    // next.revalidate is a Next.js extension to fetch — cast to bypass vanilla RequestInit types
    const fetchOpts = { signal: AbortSignal.timeout(3000), next: { revalidate: 120 } } as RequestInit
    const res = await fetch(`${TRACKER_BASE}/stats?site=${encodeURIComponent(domain)}`, fetchOpts)
    if (!res.ok) return zero()
    const data = await res.json()
    const stats: SiteStats = {
      visitors:  Number(data.visitors  ?? data.uniques ?? 0),
      pageviews: Number(data.pageviews ?? data.hits    ?? 0),
      today:     Number(data.today     ?? data.day     ?? 0),
    }
    _cache[domain] = { data: stats, at: now }
    return stats
  } catch {
    return zero()
  }
}

function zero(): SiteStats { return { visitors: 0, pageviews: 0, today: 0 } }
