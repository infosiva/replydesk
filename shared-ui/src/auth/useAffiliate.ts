'use client'
import { useEffect } from 'react'

const AFFILIATE_KEY = 'aff_ref'
const AFFILIATE_EXPIRY_KEY = 'aff_ref_expiry'
const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Reads ?ref= or ?aff= query param on landing, stores in localStorage for 30 days.
 * Call getAffiliateRef() at conversion time (signup, purchase) to include in API payload.
 * Works across all projects — no setup needed beyond <AffiliateTracker /> in layout.
 */
export function useAffiliateTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref') ?? params.get('aff') ?? params.get('via') ?? null
    if (!ref) return

    const expiry = Date.now() + AFFILIATE_TTL_MS
    localStorage.setItem(AFFILIATE_KEY, ref)
    localStorage.setItem(AFFILIATE_EXPIRY_KEY, String(expiry))
  }, [])
}

export function getAffiliateRef(): string | null {
  if (typeof window === 'undefined') return null
  const expiry = localStorage.getItem(AFFILIATE_EXPIRY_KEY)
  if (expiry && Date.now() > Number(expiry)) {
    localStorage.removeItem(AFFILIATE_KEY)
    localStorage.removeItem(AFFILIATE_EXPIRY_KEY)
    return null
  }
  return localStorage.getItem(AFFILIATE_KEY)
}

export function clearAffiliateRef() {
  localStorage.removeItem(AFFILIATE_KEY)
  localStorage.removeItem(AFFILIATE_EXPIRY_KEY)
}

/** Drop into any layout — silently tracks ?ref= params */
export function AffiliateTracker() {
  useAffiliateTracker()
  return null
}
