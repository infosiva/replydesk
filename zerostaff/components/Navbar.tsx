'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Tier } from '@/lib/types'

const tierColors: Record<Tier, string> = {
  free: 'text-white/50 bg-white/5',
  pro: 'text-purple-300 bg-purple-500/15',
  agency: 'text-emerald-300 bg-emerald-500/15',
}

interface NavbarProps {
  email?: string
  tier?: Tier
}

export default function Navbar({ email, tier = 'free' }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06]" style={{ background: 'rgba(5,4,15,0.80)', backdropFilter: 'blur(20px)' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">Zero<span className="text-purple-400">Staff</span></span>
        </Link>

        <div className="flex items-center gap-3">
          {tier && (
            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${tierColors[tier]}`}>
              {tier}
            </span>
          )}
          {email && (
            <span className="text-sm text-white/50 hidden sm:block">{email}</span>
          )}
          <button
            onClick={signOut}
            className="text-sm text-white/50 hover:text-white/80 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
