'use client'
import { useState } from 'react'

export function OfficeToggle({ initial }: { initial: 'OPEN' | 'CLOSED' }) {
  const [status, setStatus] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await fetch('/api/business/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setStatus(next)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        status === 'OPEN'
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
      } disabled:opacity-50`}
    >
      {loading ? '...' : status === 'OPEN' ? '🟢 Office Open' : '🔴 Closed — AI handling all'}
    </button>
  )
}
