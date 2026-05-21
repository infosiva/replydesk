import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import DownloadCenter from '@/components/DownloadCenter'
import Link from 'next/link'
import type { DbAsset, Tier } from '@/lib/types'

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brief } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!brief) notFound()

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('brief_id', id)

  const { data: userData } = await supabase
    .from('users')
    .select('tier')
    .eq('id', user.id)
    .single()

  const tier = (userData?.tier ?? 'free') as Tier

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-white/40 hover:text-white/70 transition">← Dashboard</Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{brief.topic}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-white/50">{brief.brand}</span>
            <span className="text-white/20">·</span>
            <span className="text-sm text-white/50 capitalize">{brief.tone}</span>
            <span className="text-white/20">·</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              brief.status === 'complete' ? 'bg-emerald-500/15 text-emerald-400' :
              brief.status === 'error' ? 'bg-red-500/15 text-red-400' :
              'bg-white/5 text-white/40'
            }`}>
              {brief.status}
            </span>
          </div>
          {brief.keywords?.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {brief.keywords.map((kw: string) => (
                <span key={kw} className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40">{kw}</span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-white/30">{assets?.length ?? 0} assets generated</p>
        </div>
      </div>

      {brief.status === 'processing' ? (
        <div className="glass p-12 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Generating your content…</p>
          <p className="text-sm text-white/30 mt-1">This usually takes 30–60 seconds</p>
        </div>
      ) : brief.status === 'error' ? (
        <div className="glass p-8 text-center border-red-500/20">
          <p className="text-red-400 font-medium">Generation failed</p>
          <p className="text-sm text-white/50 mt-1">Please try submitting another brief.</p>
          <Link href="/dashboard/new" className="mt-4 inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">
            Try again
          </Link>
        </div>
      ) : (
        <DownloadCenter assets={(assets ?? []) as DbAsset[]} tier={tier} />
      )}

      {tier === 'free' && (
        <div className="mt-8 glass p-5 border-purple-500/20 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Unlock all 8 assets</p>
            <p className="text-xs text-white/50 mt-0.5">Upgrade to Pro for podcast scripts, video storyboards, email sequences, and more</p>
          </div>
          <Link href="/api/stripe/checkout" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition whitespace-nowrap">
            Upgrade — $99/mo
          </Link>
        </div>
      )}
    </div>
  )
}
