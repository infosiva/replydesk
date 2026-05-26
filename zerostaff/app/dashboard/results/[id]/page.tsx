'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import DownloadCenter from '@/components/DownloadCenter'
import JobProgress from '@/components/JobProgress'
import { ApprovalWidget } from '@/components/ApprovalWidget'
import Link from 'next/link'
import type { DbAsset, DbComment, Tier } from '@/lib/types'
import { use } from 'react'

interface Brief {
  id: string
  topic: string
  brand: string
  tone: string
  status: string
  keywords: string[]
  jobs_done: number
  jobs_total: number
}

function ResultsContent({ id }: { id: string }) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [assets, setAssets] = useState<DbAsset[]>([])
  const [tier, setTier] = useState<Tier>('free')
  const [loading, setLoading] = useState(true)
  const [notFoundError, setNotFoundError] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/results/${id}`)
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.status === 404) {
        setNotFoundError(true)
        return
      }
      if (!res.ok) return

      const data = await res.json() as { brief: Brief; assets: DbAsset[]; tier: Tier }
      setBrief(data.brief)
      setAssets(data.assets)
      setTier(data.tier)
      setLoading(false)
    }
    load()
  }, [id])

  function handleComplete() {
    fetch(`/api/results/${id}`).then(r => r.json()).then((data: { brief: Brief; assets: DbAsset[]; tier: Tier }) => {
      setAssets(data.assets)
      setBrief(prev => prev ? { ...prev, status: 'complete' } : prev)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    )
  }

  if (notFoundError) return notFound()
  if (!brief) return null

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
          <p className="text-xs text-white/30">{assets.length} assets generated</p>
        </div>
      </div>

      {brief.status === 'processing' ? (
        <JobProgress
          briefId={brief.id}
          initialDone={brief.jobs_done}
          initialTotal={brief.jobs_total}
          initialStatus={brief.status}
          onComplete={handleComplete}
        />
      ) : brief.status === 'error' ? (
        <div className="glass p-8 text-center border-red-500/20">
          <p className="text-red-400 font-medium">Generation failed</p>
          <p className="text-sm text-white/50 mt-1">Please try submitting another brief.</p>
          <Link href="/dashboard/new" className="mt-4 inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition">
            Try again
          </Link>
        </div>
      ) : (
        <>
          <DownloadCenter assets={assets} tier={tier} />
          <div className="mt-6 space-y-4">
            {assets.map(asset => (
              <div key={asset.id} className="glass p-4">
                <ApprovalWidget
                  assetId={asset.id}
                  approvedAt={asset.approved_at ? asset.approved_at.toISOString() : null}
                  comments={((asset as DbAsset & { comments?: DbComment[] }).comments ?? []).map(c => ({
                    id: c.id,
                    author_email: c.author_email,
                    body: c.body,
                    resolved: c.resolved,
                    created_at: c.created_at,
                  }))}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {tier === 'free' && brief.status === 'complete' && (
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

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ResultsContent id={id} />
}
