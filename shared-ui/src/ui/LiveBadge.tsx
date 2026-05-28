'use client'

/**
 * LiveBadge — shows real visitor count from VPS tracker.
 * Pass the server-fetched count as a prop (avoids client-side CORS to VPS).
 *
 * Usage in layout (server component):
 *   import { getSiteStats } from '@infosiva/shared-ui/lib/analytics'
 *   const stats = await getSiteStats('kwizzo.app')
 *   <LiveBadge count={stats.today} />
 *
 * Or use StaticBadge for zero-latency when stats unavailable.
 */

interface LiveBadgeProps {
  /** Today's visitor count from VPS tracker */
  count: number
  /** If count is 0, hide the badge entirely (no fake data) */
  hideIfZero?: boolean
  /** Label after the number. Default: 'visitors today' */
  label?: string
  /** Dot colour. Default: '#22c55e' */
  dotColor?: string
}

export function LiveBadge({
  count,
  hideIfZero = true,
  label      = 'visitors today',
  dotColor   = '#22c55e',
}: LiveBadgeProps) {
  if (hideIfZero && count === 0) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 999,
        padding: '4px 10px',
      }}
    >
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
          animation: 'pulse-dot 2s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count.toLocaleString()}</span>
      &nbsp;{label}
      <style>{`@keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
    </span>
  )
}
