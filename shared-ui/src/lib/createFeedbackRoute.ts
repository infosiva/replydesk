/**
 * createFeedbackRoute — shared POST /api/feedback handler.
 * Stores feedback on VPS or logs to console in dev.
 * Rate-limited to 5/min per IP.
 *
 * Usage in app/api/feedback/route.ts:
 *   import { createFeedbackRoute } from '@infosiva/shared-ui/lib/createFeedbackRoute'
 *   export const POST = createFeedbackRoute({ siteName: 'Kwizzo' })
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from './rateLimit'

interface Options {
  siteName: string
  /** Webhook URL to POST feedback to (e.g. Telegram, Slack, n8n). Optional. */
  webhookUrl?: string
  /** Max submissions per IP per minute. Default: 5 */
  maxPerMin?: number
}

const _limiters = new Map<string, ReturnType<typeof rateLimit>>()

export function createFeedbackRoute({ siteName, webhookUrl, maxPerMin = 5 }: Options) {
  if (!_limiters.has(siteName)) {
    _limiters.set(siteName, rateLimit({ windowMs: 60_000, max: maxPerMin, message: 'Too many feedback submissions.' }))
  }

  return async function POST(req: NextRequest) {
    const limiter = _limiters.get(siteName)!
    const limited = limiter.check(req)
    if (limited) return limited

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const { type, rating, message, email, page, site } = body as {
      type?: string; rating?: number; message?: string; email?: string; page?: string; site?: string
    }

    if (!message || String(message).trim().length < 5) {
      return NextResponse.json({ error: 'Message too short.' }, { status: 422 })
    }

    const payload = {
      site:    site ?? siteName,
      type:    type    ?? 'General',
      rating:  rating  ?? 0,
      message: String(message).trim().slice(0, 500),
      email:   email   ? String(email).trim().slice(0, 120) : undefined,
      page:    page    ?? '/',
      ts:      new Date().toISOString(),
    }

    // Always log (Vercel logs → searchable)
    console.log('[feedback]', JSON.stringify(payload))

    // Optional webhook (Telegram, Slack, n8n)
    const url = webhookUrl ?? process.env.FEEDBACK_WEBHOOK_URL
    if (url) {
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        // webhook failure is non-fatal
      }
    }

    return NextResponse.json({ ok: true })
  }
}
