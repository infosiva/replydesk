'use client'
/**
 * useIsMobile — SSR-safe responsive hook (shared across all projects)
 *
 * Uses window.matchMedia so the initial state matches what CSS sees.
 * No hydration mismatch. Reacts to viewport resizes.
 *
 * Usage:
 *   import { useIsMobile } from '@/lib/useIsMobile'
 *   const isMobile = useIsMobile()          // true when width < 640px
 *   const isTablet = useIsMobile(1024)      // true when width < 1024px
 */
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 640): boolean {
  // Initialize from matchMedia synchronously on client, false on server (SSR)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches
  })

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches) // sync on mount
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
