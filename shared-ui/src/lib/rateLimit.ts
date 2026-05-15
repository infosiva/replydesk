/**
 * Edge-compatible in-memory rate limiter for Next.js API routes.
 * Uses a sliding window per IP.
 *
 * Usage (in route.ts):
 *   import { rateLimit } from '@siva/shared-ui/lib/rateLimit'
 *   const limiter = rateLimit({ windowMs: 60_000, max: 10 })
 *
 *   export async function POST(req: NextRequest) {
 *     const limited = limiter.check(req)
 *     if (limited) return limited   // returns 429 Response
 *     ...
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'

interface Options {
  /** Window in ms. Default 60_000 (1 min) */
  windowMs?: number
  /** Max requests per window per IP. Default 20 */
  max?: number
  /** Error message. Default "Too many requests" */
  message?: string
}

interface Entry {
  count: number
  resetAt: number
}

// In-process store — works for single-instance deployments (VPS, Vercel single region)
// For multi-region Vercel, replace with KV/Redis but this is fine for hobby tier
const store = new Map<string, Entry>()

// Cleanup stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

export function rateLimit(opts: Options = {}) {
  const windowMs = opts.windowMs ?? 60_000
  const max      = opts.max ?? 20
  const message  = opts.message ?? 'Too many requests, please try again later.'

  return {
    /** Returns a 429 NextResponse if rate-limited, or null if OK. */
    check(req: NextRequest): NextResponse | null {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        req.headers.get('x-real-ip') ??
        'unknown'

      const now = Date.now()
      const entry = store.get(ip)

      if (!entry || entry.resetAt < now) {
        store.set(ip, { count: 1, resetAt: now + windowMs })
        return null
      }

      entry.count++
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return NextResponse.json(
          { error: message },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
            },
          }
        )
      }
      return null
    },
  }
}

/** Pre-built limiters for common use-cases */
export const AI_LIMITER   = rateLimit({ windowMs: 60_000, max: 10, message: 'AI quota exceeded — max 10 requests/min.' })
export const AUTH_LIMITER = rateLimit({ windowMs: 60_000, max: 5,  message: 'Too many auth attempts — try again in a minute.' })
export const API_LIMITER  = rateLimit({ windowMs: 60_000, max: 30, message: 'Too many requests.' })
