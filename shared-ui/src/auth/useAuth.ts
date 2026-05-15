'use client'
import { useState, useEffect, useCallback } from 'react'

const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3110'
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export interface AuthUser {
  id: number
  username: string
  email: string
  site: string
  created_at: string
}

export interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true, error: null })

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)
    if (token && userStr) {
      try {
        setState({ user: JSON.parse(userStr), token, loading: false, error: null })
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setState({ user: null, token: null, loading: false, error: null })
      }
    } else {
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  const signup = useCallback(async (username: string, email: string, password: string, site: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`${AUTH_API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, site }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: data.error }))
        return { success: false, error: data.error, field: data.field }
      }
      setState(s => ({ ...s, loading: false }))
      // OTP flow: returns { otpSent: true, email }
      if (data.otpSent) {
        return { success: true, otpSent: true, email: data.email }
      }
      // Legacy direct-token flow
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setState({ user: data.user, token: data.token, loading: false, error: null })
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setState(s => ({ ...s, loading: false, error: msg }))
      return { success: false, error: msg }
    }
  }, [])

  const verifyOtp = useCallback(async (email: string, code: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`${AUTH_API}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: data.error }))
        return { success: false, error: data.error, field: data.field }
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setState({ user: data.user, token: data.token, loading: false, error: null })
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setState(s => ({ ...s, loading: false, error: msg }))
      return { success: false, error: msg }
    }
  }, [])

  const resendOtp = useCallback(async (email: string) => {
    try {
      const res = await fetch(`${AUTH_API}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: data.error }
      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: data.error }))
        return { success: false, error: data.error }
      }
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      setState({ user: data.user, token: data.token, loading: false, error: null })
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setState(s => ({ ...s, loading: false, error: msg }))
      return { success: false, error: msg }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setState({ user: null, token: null, loading: false, error: null })
  }, [])

  return { ...state, signup, verifyOtp, resendOtp, login, logout }
}
