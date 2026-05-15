/**
 * Server-side API guard for Next.js route handlers.
 * Combines:
 *   1. IP rate limiting
 *   2. JWT auth check (registered users skip quota)
 *   3. Guest quota enforcement (via fingerprint header)
 *
 * Usage:
 *   import { apiGuard } from '@siva/shared-ui/lib/apiGuard'
 *
 *   export async function POST(req: NextRequest) {
 *     const block = await apiGuard(req, { product: 'kwizzo', freeLimit: 3 })
 *     if (block) return block   // 401/429 Response
 *     // proceed with AI call
 *   }
 *
 * Client must send:
 *   Authorization: Bearer <jwt>     — for registered users
 *   X-Guest-FP: <fingerprint>       — for guests
 *   X-Product: kwizzo|tutiq|quizbites
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from './rateLimit'

interface GuardOptions {
  /** Product ID — must match what useGate sends */
  product: string
  /** Max free AI calls per guest fingerprint per window */
  freeLimit?: number
  /** Rate limit window in ms. Default 60_000 */
  windowMs?: number
  /** Hard IP rate limit (all users). Default 30/min */
  ipMax?: number
  /** Auth API base URL. Falls back to env var or VPS default */
  authApiUrl?: string
}

// Per-product IP limiters (lazy init)
const ipLimiters = new Map<string, ReturnType<typeof rateLimit>>()

function getIpLimiter(product: string, windowMs: number, max: number) {
  const key = `${product}:${windowMs}:${max}`
  if (!ipLimiters.has(key)) {
    ipLimiters.set(key, rateLimit({ windowMs, max }))
  }
  return ipLimiters.get(key)!
}

// In-process guest quota store (fingerprint → { count, resetAt })
// Same TTL as windowMs — resets every window
const guestStore = new Map<string, { count: number; resetAt: number }>()

export async function apiGuard(req: NextRequest, opts: GuardOptions): Promise<NextResponse | null> {
  const {
    product,
    freeLimit = 10,
    windowMs  = 60 * 60 * 1000, // 1 hour window for AI quota
    ipMax     = 30,
    authApiUrl = process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://31.97.56.148:3110',
  } = opts

  // 1. IP rate limit (hard cap, catches all traffic)
  const ipLimited = getIpLimiter(product, 60_000, ipMax).check(req)
  if (ipLimited) return ipLimited

  // 2. Check JWT — registered users get unlimited (within IP limit)
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    try {
      // Verify with auth-api /me endpoint (avoid duplicating JWT secret here)
      const meRes = await fetch(`${authApiUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      })
      if (meRes.ok) return null // registered + valid token → allow
    } catch {
      // Auth API unreachable — fall through to guest quota
    }
  }

  // 3. Guest quota — enforced server-side via fingerprint
  const fingerprint = req.headers.get('x-guest-fp')
  if (!fingerprint) {
    // No fingerprint + no valid JWT → reject
    return NextResponse.json(
      { error: 'Sign in to continue.', gated: true },
      { status: 401 }
    )
  }

  const fpKey = `${product}:${fingerprint}`
  const now   = Date.now()
  const entry = guestStore.get(fpKey)

  if (!entry || entry.resetAt < now) {
    guestStore.set(fpKey, { count: 1, resetAt: now + windowMs })
    return null // first request this window
  }

  entry.count++
  if (entry.count > freeLimit) {
    return NextResponse.json(
      { error: 'Free quota reached. Sign in for unlimited access.', gated: true },
      { status: 429, headers: { 'X-Gate': 'quota-exceeded' } }
    )
  }

  return null // within quota
}
