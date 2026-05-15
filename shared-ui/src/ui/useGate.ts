'use client'
import { useState, useEffect, useRef } from 'react'
import { isLoggedIn } from '../auth/useMagicAuth'

function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_AUTH_API_URL as string) || 'http://31.97.56.148:3110'
}

function getFingerprint(product: string): string {
  const key = `${product}_fp`
  let fp = localStorage.getItem(key)
  if (!fp) {
    fp = `${product}_` + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(key, fp)
  }
  return fp
}

async function serverTrack(product: string, action: string): Promise<number> {
  try {
    const fp = getFingerprint(product)
    const res = await fetch(`${getApiUrl()}/guest/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint: fp, product, action }),
    })
    const data = await res.json()
    return data.count ?? 1
  } catch {
    const key = `${product}_${action}_count`
    const next = (parseInt(localStorage.getItem(key) || '0', 10)) + 1
    localStorage.setItem(key, String(next))
    return next
  }
}

async function serverGetCount(product: string, action: string): Promise<number> {
  try {
    const fp = getFingerprint(product)
    const res = await fetch(`${getApiUrl()}/guest/usage?fingerprint=${fp}&product=${product}&action=${encodeURIComponent(action)}`)
    const data = await res.json()
    return data.count ?? 0
  } catch {
    const key = `${product}_${action}_count`
    return parseInt(localStorage.getItem(key) || '0', 10)
  }
}

export function useGate(product: string, freeLimit: number, action = 'session') {
  const [count, setCount]               = useState(0)
  const [isRegistered, setIsRegistered] = useState(false)
  const [showGate, setShowGate]         = useState(false)
  const [ready, setReady]               = useState(false)
  // Keep a ref so increment() can check without stale closure
  const countRef = useRef(0)

  useEffect(() => {
    const registered = isLoggedIn()
    setIsRegistered(registered)
    if (!registered) {
      serverGetCount(product, action).then(c => {
        setCount(c)
        countRef.current = c
        // If they already hit the limit (e.g. returning visitor), show gate immediately
        if (c >= freeLimit) setShowGate(true)
        setReady(true)
      })
    } else {
      setReady(true)
    }
  }, [product, action, freeLimit])

  /** Call BEFORE the action. Returns true = allowed, false = blocked (gate shown). */
  const increment = async (): Promise<boolean> => {
    if (isRegistered) return true
    const next = await serverTrack(product, action)
    setCount(next)
    countRef.current = next
    if (next > freeLimit) {
      // Already over — show gate, block
      setShowGate(true)
      return false
    }
    if (next === freeLimit) {
      // Used the last free one — show gate after this action completes
      // We still ALLOW this action (returns true) so UX feels generous
      // Gate fires at next attempt
      return true
    }
    return true
  }

  /** Call BEFORE the action when you want hard-block at freeLimit (not freeLimit+1). */
  const check = (): boolean => {
    if (isRegistered) return true
    if (countRef.current >= freeLimit) {
      setShowGate(true)
      return false
    }
    return true
  }

  const onRegistered = () => {
    setIsRegistered(true)
    setShowGate(false)
  }

  const dismissGate = () => setShowGate(false)

  return { count, isRegistered, showGate, increment, check, onRegistered, dismissGate, ready }
}
