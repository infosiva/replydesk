'use client'
import { useState, useEffect } from 'react'

export interface CurrentUser {
  id: string
  email: string
  name?: string
  picture?: string
  role?: string
}

type AuthAdapter = {
  getUser: () => Promise<CurrentUser | null>
  signOut: () => Promise<void>
}

let _adapter: AuthAdapter | null = null

/**
 * Register an auth adapter once (in layout.tsx or _app.tsx).
 * Works with Clerk, Supabase, NextAuth, or custom session APIs.
 *
 * Example with custom session endpoint:
 *   registerAuthAdapter({
 *     getUser: async () => { const r = await fetch('/api/me'); return r.ok ? r.json() : null },
 *     signOut: async () => { await fetch('/api/auth/signout', { method: 'POST' }); window.location.href = '/' }
 *   })
 *
 * Example with Clerk (import after Clerk provider is mounted):
 *   import { useUser, useClerk } from '@clerk/nextjs'
 *   // Use useCurrentUser() directly — it internally reads Clerk's context when adapter not set
 */
export function registerAuthAdapter(adapter: AuthAdapter) {
  _adapter = adapter
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!_adapter) {
      // Fallback: try /api/me endpoint
      fetch('/api/me')
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(u => { setUser(u); setLoading(false) })
      return
    }
    _adapter.getUser().then(u => { setUser(u); setLoading(false) })
  }, [])

  async function signOut() {
    if (_adapter) await _adapter.signOut()
    else {
      await fetch('/api/auth/signout', { method: 'POST' })
      window.location.href = '/'
    }
    setUser(null)
  }

  return { user, loading, signOut, isAuthenticated: !!user }
}
