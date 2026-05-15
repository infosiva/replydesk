'use client'
import { useState, useEffect, useCallback } from 'react'

const TOKEN_KEY = 'auth_token'
const USER_KEY  = 'auth_user'

export interface AuthUser {
  id: number
  username: string
  email: string
  site: string
}

function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as { __AUTH_API__?: string }).__AUTH_API__) return (window as { __AUTH_API__?: string }).__AUTH_API__!
  return (process.env.NEXT_PUBLIC_AUTH_API_URL as string) || 'http://31.97.56.148:3110'
}

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(TOKEN_KEY)
}

export async function sendMagicCode(email: string, site: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/magic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, site }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? 'Failed to send code' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export async function verifyMagicCode(email: string, code: string, site: string): Promise<{ ok: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch(`${getApiUrl()}/magic/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, site }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? 'Invalid code' }
    saveAuth(data.token, data.user)
    return { ok: true, user: data.user }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

/** React hook — wraps magic auth state */
export function useMagicAuth() {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getStoredUser())
    setLoading(false)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setUser(null)
  }, [])

  const onSuccess = useCallback((u: AuthUser) => {
    setUser(u)
  }, [])

  return { user, loading, logout, onSuccess, isLoggedIn: !!user }
}
