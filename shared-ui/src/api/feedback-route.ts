/**
 * Feedback API Route — copy this file to any project at:
 *   app/api/feedback/route.ts
 *
 * Stores feedback in Vercel KV (if available) or logs to console.
 * Optionally sends Telegram notification.
 *
 * Env vars (all optional):
 *   TELEGRAM_BOT_TOKEN  — bot token for notifications
 *   TELEGRAM_CHAT_ID    — chat ID for notifications
 *   KV_REST_API_URL     — Vercel KV (upstash) base URL
 *   KV_REST_API_TOKEN   — Vercel KV token
 *
 * Works without any env vars — just logs to console.
 */

import { NextRequest, NextResponse } from 'next/server'

interface FeedbackPayload {
  site?:    string
  type:     string
  rating:   number
  message:  string
  email?:   string
  page?:    string
}

export async function POST(req: NextRequest) {
  let body: FeedbackPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, rating, message, email, page, site } = body

  if (!message || message.trim().length < 5) {
    return NextResponse.json({ error: 'Message too short' }, { status: 400 })
  }
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 })
  }

  const entry = {
    id:        crypto.randomUUID(),
    site:      site ?? 'unknown',
    type:      type ?? 'General',
    rating,
    message:   message.trim(),
    email:     email?.trim() || null,
    page:      page ?? '/',
    ip:        req.headers.get('x-forwarded-for') ?? 'unknown',
    createdAt: new Date().toISOString(),
  }

  // ── 1. Log (always) ──────────────────────────────────────────────────────────
  console.log('[feedback]', JSON.stringify(entry))

  // ── 2. Telegram notification (optional) ─────────────────────────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId   = process.env.TELEGRAM_CHAT_ID
  if (botToken && chatId) {
    const stars  = '⭐'.repeat(rating)
    const text   = [
      `📣 *New Feedback — ${entry.site}*`,
      `${stars} ${rating}/5 · ${entry.type}`,
      `📄 ${entry.page}`,
      ``,
      entry.message,
      entry.email ? `\n📧 ${entry.email}` : '',
    ].filter(Boolean).join('\n')

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    }).catch(() => { /* non-critical */ })
  }

  // ── 3. Vercel KV / Upstash (optional) ────────────────────────────────────────
  const kvUrl   = process.env.KV_REST_API_URL
  const kvToken = process.env.KV_REST_API_TOKEN
  if (kvUrl && kvToken) {
    const key = `feedback:${entry.site}:${entry.id}`
    await fetch(`${kvUrl}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kvToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(entry),
    }).catch(() => { /* non-critical */ })
  }

  return NextResponse.json({ ok: true, id: entry.id })
}
