'use client'
/**
 * Browser fingerprint hook using @fingerprintjs/fingerprintjs (open source, free).
 * Returns a visitorId that persists across incognito sessions.
 *
 * Send as `visitorId` in chat API calls to enable incognito-resistant rate limiting.
 *
 * Usage:
 *   const { visitorId } = useFingerprint()
 *   fetch('/api/chat', { body: JSON.stringify({ messages, visitorId }) })
 */

import { useState, useEffect } from 'react'

export function useFingerprint() {
  const [visitorId, setVisitorId] = useState<string | null>(null)

  useEffect(() => {
    // Lazy-load FingerprintJS to avoid SSR issues
    async function load() {
      try {
        // @fingerprintjs/fingerprintjs is open source — no API key needed
        const FingerprintJS = await import('@fingerprintjs/fingerprintjs')
        const fp = await FingerprintJS.load()
        const result = await fp.get()
        setVisitorId(result.visitorId)
      } catch {
        // Fallback: generate a session-based ID stored in sessionStorage
        const stored = sessionStorage.getItem('_fid')
        if (stored) { setVisitorId(stored); return }
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        sessionStorage.setItem('_fid', id)
        setVisitorId(id)
      }
    }
    load()
  }, [])

  return { visitorId }
}
