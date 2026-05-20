/**
 * Shared chat route builder.
 * Creates a scoped, rate-limited /api/chat POST handler for any project.
 *
 * Usage in app/api/chat/route.ts:
 *   import { createChatRoute } from '@siva/shared-ui/lib/createChatRoute'
 *   export const POST = createChatRoute({
 *     siteName: 'ParcelIQ',
 *     siteScope: 'UK parcel shipping comparison',
 *     systemPrompt: 'You are ParcelIQ AI...',
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

interface Options {
  siteName: string
  siteScope: string
  systemPrompt: string
  /** Max requests per IP per hour. Default: 10 (free tier). */
  maxPerHour?: number
  /** Groq model. Default: llama-3.1-8b-instant (cheap + fast for chat) */
  model?: string
  /** Max tokens. Default: 300 */
  maxTokens?: number
}

// Simple in-memory rate limiter (per serverless instance)
// Key = IP + optional browser fingerprint (more robust than IP alone)
const WINDOWS = new Map<string, { count: number; resetAt: number }>()

function checkRate(ip: string, max: number): boolean {
  const now = Date.now()
  const key = ip
  const entry = WINDOWS.get(key)
  if (!entry || now > entry.resetAt) {
    WINDOWS.set(key, { count: 1, resetAt: now + 3_600_000 })
    return false // not limited
  }
  if (entry.count >= max) return true // limited
  entry.count++
  return false
}

// Scope guard — detects clearly out-of-scope questions
const OUT_OF_SCOPE_SIGNALS = [
  /write.*code for me/i,
  /help me with my homework/i,
  /what is the weather/i,
  /tell me a joke/i,
  /who is the president/i,
  /can you be my (friend|girlfriend|boyfriend)/i,
]

function isOutOfScope(message: string, scope: string): boolean {
  // If message contains nothing related to the site scope, flag it
  const lowerMsg = message.toLowerCase()
  const lowerScope = scope.toLowerCase()
  // Simple heuristic: check for obvious off-topic patterns
  return OUT_OF_SCOPE_SIGNALS.some(r => r.test(message))
}

let _groq: Groq | null = null
function groq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  return _groq
}

export function createChatRoute(opts: Options) {
  const {
    siteName,
    siteScope,
    systemPrompt,
    maxPerHour = 10,
    model = 'llama-3.1-8b-instant', // smallest fast model — saves tokens
    maxTokens = 300,
  } = opts

  const fullSystem = `${systemPrompt}

IMPORTANT SCOPE RULE: You are trained specifically for ${siteName} (${siteScope}).
If a user asks something clearly outside this scope (e.g. unrelated topics, general knowledge, other websites),
respond EXACTLY: "I'm trained specifically for ${siteName}. For that question, try Google or ChatGPT — they're great for general queries! Is there anything about ${siteScope} I can help with?"
Keep all responses under 150 words. Be helpful but stay on-topic.`

  return async function POST(req: NextRequest) {
    // Rate limit — use IP + optional fingerprint for incognito resistance
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    // visitorId from @fingerprintjs/fingerprintjs (sent by client) — more robust than IP
    const { messages, system, visitorId } = await req.json().catch(() => ({ messages: [], system: undefined, visitorId: undefined }))
    const rateKey = visitorId ? `fp_${visitorId}` : `ip_${ip}`
    if (checkRate(rateKey, maxPerHour)) {
      return NextResponse.json(
        { text: `You've reached the free limit of ${maxPerHour} messages/hour for ${siteName}. Sign up to unlock unlimited chat!` },
        { status: 200 } // 200 so UI shows it gracefully
      )
    }

    try {
      // messages/system/visitorId already parsed above

      // Check last user message for obvious out-of-scope
      const lastUserMsg = messages?.findLast?.((m: { role: string; content: string }) => m.role === 'user')?.content ?? ''
      if (isOutOfScope(lastUserMsg, siteScope)) {
        return NextResponse.json({
          text: `I'm trained specifically for ${siteName}. For that question, try Google or ChatGPT — they're great for general queries! Is there anything about ${siteScope} I can help with?`
        })
      }

      const res = await groq().chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system ?? fullSystem },
          ...messages,
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
      })

      return NextResponse.json({ text: res.choices[0]?.message?.content ?? 'Happy to help!' })
    } catch {
      return NextResponse.json({ text: `Something went wrong. Please try again!` }, { status: 200 })
    }
  }
}
