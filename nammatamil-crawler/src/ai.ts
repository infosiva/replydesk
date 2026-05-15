/**
 * AI engine for nammatamil-crawler
 * Chain: Groq (free/fast) → Gemini (free) → Claude Haiku (paid fallback)
 * Used for: structured extraction, description generation, relevance scoring
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
dotenv.config()

// ── In-memory cache (1h TTL) ─────────────────────────────────────────
const cache = new Map<string, { value: string; expires: number }>()

function getCache(key: string): string | null {
  const e = cache.get(key)
  if (!e || Date.now() > e.expires) { cache.delete(key); return null }
  return e.value
}
function setCache(key: string, value: string) {
  cache.set(key, { value, expires: Date.now() + 3_600_000 })
}

// ── Claude daily budget guard ─────────────────────────────────────────
let claudeTokensToday = 0
const CLAUDE_DAILY_LIMIT = 80_000 // ~$0.10/day on Haiku

// ── Provider: Groq ────────────────────────────────────────────────────
async function callGroq(system: string, user: string, maxTokens = 600): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('No GROQ_API_KEY')
  const groq = new Groq({ apiKey: key })
  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: Math.min(maxTokens, 1000),
    temperature: 0.3, // low temp for structured extraction
  })
  return res.choices[0]?.message?.content?.trim() ?? ''
}

// ── Provider: Gemini ─────────────────────────────────────────────────
async function callGemini(system: string, user: string, maxTokens = 600): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('No GEMINI_API_KEY')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { maxOutputTokens: Math.min(maxTokens, 1000), temperature: 0.3 },
  })
  const result = await model.generateContent(`${system}\n\n${user}`)
  return result.response.text().trim()
}

// ── Provider: Claude Haiku ───────────────────────────────────────────
async function callClaude(system: string, user: string, maxTokens = 600): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('No ANTHROPIC_API_KEY')
  if (claudeTokensToday >= CLAUDE_DAILY_LIMIT) throw new Error('Claude daily budget exceeded')

  const client = new Anthropic({ apiKey: key })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: Math.min(maxTokens, 800),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  })
  if (res.usage) {
    claudeTokensToday += res.usage.input_tokens + res.usage.output_tokens
    console.log(`[Claude] tokens: ${res.usage.input_tokens}+${res.usage.output_tokens} | daily: ${claudeTokensToday}`)
  }
  const block = res.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

// ── Public: run prompt through fallback chain ─────────────────────────
export async function ai(
  system: string,
  user: string,
  maxTokens = 600
): Promise<string> {
  const cacheKey = `${system.slice(0, 40)}::${user.slice(0, 80)}`
  const cached = getCache(cacheKey)
  if (cached) { console.log('[AI] cache hit'); return cached }

  for (const [name, fn] of [
    ['Groq',   () => callGroq(system, user, maxTokens)],
    ['Gemini', () => callGemini(system, user, maxTokens)],
    ['Claude', () => callClaude(system, user, maxTokens)],
  ] as const) {
    try {
      const result = await (fn as () => Promise<string>)()
      if (result) {
        console.log(`[AI] ✓ ${name}`)
        setCache(cacheKey, result)
        return result
      }
    } catch (e) {
      console.warn(`[AI] ${name} failed: ${(e as Error).message}`)
    }
  }
  return ''
}

// ── Structured JSON extractor ─────────────────────────────────────────
// Asks AI to return valid JSON, strips markdown fences, parses safely
export async function aiJSON<T>(system: string, user: string, fallback: T): Promise<T> {
  const raw = await ai(system + '\n\nReturn ONLY valid JSON, no markdown, no explanation.', user, 800)
  try {
    // Strip ```json ... ``` if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    console.warn('[AI] JSON parse failed, raw:', raw.slice(0, 200))
    return fallback
  }
}
