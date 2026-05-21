'use client'

import Link from 'next/link'

interface TierGateProps {
  children: React.ReactNode
  locked?: boolean
  label?: string
}

export default function TierGate({ children, locked = false, label = 'Pro' }: TierGateProps) {
  if (!locked) return <>{children}</>

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(8,7,18,0.7)' }}>
        <div className="text-center px-6">
          <span className="block text-2xl mb-2">🔒</span>
          <p className="text-sm text-white/70 mb-3">
            <span className="text-purple-400 font-semibold">{label}</span> feature
          </p>
          <Link
            href="/api/stripe/checkout"
            className="inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition"
          >
            Upgrade to unlock
          </Link>
        </div>
      </div>
    </div>
  )
}
