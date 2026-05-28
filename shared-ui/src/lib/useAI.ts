/**
 * useAI — client-side hook for AI completions with free-tier fallback.
 * Calls your app's /api/chat route which handles the model chain server-side.
 *
 * Model priority (server-side in createChatRoute):
 *   Groq llama-3.1-8b-instant → Gemini flash → Cerebras → Anthropic
 *
 * Usage:
 *   const { ask, reply, loading, error, reset, remaining } = useAI({ apiRoute: '/api/chat' })
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import { useFingerprint } from '../hooks/useFingerprint'

interface Message { role: 'user' | 'assistant'; content: string }

export interface UseAIOptions {
  /** Your app's chat API route. Default: '/api/chat' */
  apiRoute?: string
  /** Max messages to keep in history. Default: 10 */
  maxHistory?: number
  /** Max free queries before soft gate. Default: 10 (per hour, server enforces) */
  maxFree?: number
  /** Called when server returns { gated: true } */
  onGated?: () => void
}

export interface UseAIReturn {
  /** Send a message and get streaming/JSON reply */
  ask: (message: string, systemContext?: string) => Promise<string>
  /** Latest assistant reply */
  reply: string
  /** Full conversation history */
  history: Message[]
  loading: boolean
  error: string | null
  /** Approx remaining free queries (client-side count, not authoritative) */
  remaining: number
  /** Clear conversation */
  reset: () => void
  /** Is user soft-gated (server said quota exceeded) */
  gated: boolean
}

export function useAI({
  apiRoute  = '/api/chat',
  maxHistory = 10,
  maxFree   = 10,
  onGated,
}: UseAIOptions = {}): UseAIReturn {
  const [history,   setHistory]   = useState<Message[]>([])
  const [reply,     setReply]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [remaining, setRemaining] = useState(maxFree)
  const [gated,     setGated]     = useState(false)
  const { visitorId: fingerprint } = useFingerprint()
  const abortRef = useRef<AbortController | null>(null)

  const ask = useCallback(async (message: string, systemContext?: string): Promise<string> => {
    if (loading) return ''
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const userMsg: Message = { role: 'user', content: message }
    setHistory(prev => [...prev.slice(-(maxHistory - 1)), userMsg])
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(apiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(fingerprint ? { 'X-Guest-FP': fingerprint } : {}),
        },
        body: JSON.stringify({
          messages: [...history.slice(-maxHistory), userMsg],
          ...(systemContext ? { system: systemContext } : {}),
          visitorId: fingerprint,
        }),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (data.gated) {
        setGated(true)
        setRemaining(0)
        onGated?.()
        const msg = data.text ?? 'Free quota reached. Sign up for unlimited access.'
        setReply(msg)
        return msg
      }

      const text = data.text ?? data.reply ?? data.message ?? data.content ?? ''
      setReply(text)
      setHistory(prev => [...prev, { role: 'assistant', content: text }])
      setRemaining(prev => Math.max(0, prev - 1))
      return text
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return ''
      const msg = 'Request failed. Please try again.'
      setError(msg)
      return msg
    } finally {
      setLoading(false)
    }
  }, [apiRoute, fingerprint, history, loading, maxHistory, maxFree, onGated])

  const reset = useCallback(() => {
    setHistory([])
    setReply('')
    setError(null)
    setGated(false)
    setRemaining(maxFree)
  }, [maxFree])

  return { ask, reply, history, loading, error, remaining, reset, gated }
}
