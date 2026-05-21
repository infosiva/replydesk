import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { DbBrief } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: briefs } = await supabase
    .from('briefs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: userData } = await supabase
    .from('users')
    .select('tier, briefs_used_this_month')
    .eq('id', user.id)
    .single()

  const tier = userData?.tier ?? 'free'
  const used = userData?.briefs_used_this_month ?? 0
  const limit = tier === 'free' ? 2 : tier === 'pro' ? 20 : Infinity

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-white/40 mt-1">
            {tier === 'agency' ? 'Unlimited briefs' : `${used} / ${limit} briefs this month`}
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition"
        >
          + New brief
        </Link>
      </div>

      {!briefs || briefs.length === 0 ? (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-4">✨</div>
          <h2 className="text-lg font-semibold text-white mb-2">No briefs yet</h2>
          <p className="text-sm text-white/50 mb-6">Submit your first brief and get 8 content assets in under 60 seconds.</p>
          <Link href="/dashboard/new" className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">
            Create first brief
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(briefs as DbBrief[]).map(brief => (
            <Link
              key={brief.id}
              href={`/dashboard/results/${brief.id}`}
              className="glass flex items-center justify-between p-5 hover:border-purple-500/30 transition group"
            >
              <div>
                <p className="text-white font-medium group-hover:text-purple-300 transition">{brief.topic}</p>
                <p className="text-sm text-white/40 mt-0.5">{brief.brand} · {new Date(brief.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  brief.status === 'complete' ? 'bg-emerald-500/15 text-emerald-400' :
                  brief.status === 'error' ? 'bg-red-500/15 text-red-400' :
                  'bg-white/5 text-white/40'
                }`}>
                  {brief.status}
                </span>
                <span className="text-white/30 group-hover:text-white/60 transition">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tier === 'free' && used >= limit && (
        <div className="mt-6 glass p-5 border-purple-500/30 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Monthly limit reached</p>
            <p className="text-sm text-white/50 mt-0.5">Upgrade to Pro for 20 briefs/month + all 8 outputs</p>
          </div>
          <Link href="/api/stripe/checkout" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">
            Upgrade to Pro
          </Link>
        </div>
      )}
    </div>
  )
}
