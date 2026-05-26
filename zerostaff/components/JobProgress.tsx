'use client'

import { useEffect, useRef, useState } from 'react'

interface JobProgressProps {
  briefId: string
  initialDone: number
  initialTotal: number
  initialStatus: string
  onComplete: () => void
}

const JOB_LABELS: Record<string, string> = {
  text: 'Writing content',
  audio: 'Producing podcast audio',
  video: 'Generating video',
}

const ASSET_LABELS: Record<string, string> = {
  blog_post: 'Blog Post',
  linked_in_posts: 'LinkedIn Posts',
  podcast_episode: 'Podcast Script',
  video_storyboard: 'Video Storyboard',
  email_sequence: 'Email Sequence',
  short_clips: 'Short Clips',
  lead_gen_pack: 'Lead Gen Pack',
  client_report: 'Client Report',
  podcast_audio: 'Podcast MP3',
  video_asset: 'Video MP4',
}

const POLL_INTERVAL = 3000

export default function JobProgress({
  briefId,
  initialDone,
  initialTotal,
  initialStatus,
  onComplete,
}: JobProgressProps) {
  const [done, setDone] = useState(initialDone)
  const [total] = useState(initialTotal)
  const [status, setStatus] = useState(initialStatus)
  const [readyAssets, setReadyAssets] = useState<string[]>([])
  const prevDoneRef = useRef(initialDone)
  const completedRef = useRef(false)

  useEffect(() => {
    if (status !== 'processing') return

    const poll = async () => {
      try {
        const res = await fetch(`/api/briefs/${briefId}/status`)
        if (!res.ok) return
        const data = await res.json() as { jobs_done: number; status: string; asset_types: string[] }
        setDone(data.jobs_done)
        setStatus(data.status)

        if (data.asset_types?.length > prevDoneRef.current) {
          setReadyAssets(data.asset_types)
          prevDoneRef.current = data.asset_types.length
        }

        if (data.status === 'complete' && !completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } catch {
        // ignore transient errors
      }
    }

    const id = setInterval(poll, POLL_INTERVAL)
    poll() // immediate first poll
    return () => clearInterval(id)
  }, [briefId, status, onComplete])

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="glass p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-5 h-5 rounded-full border-2 border-purple-500/40 border-t-purple-500 animate-spin flex-shrink-0" />
        <p className="text-white/70 font-medium">Generating your content</p>
      </div>

      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-violet-500 rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 5)}%` }}
        />
      </div>

      <p className="text-xs text-white/30 mb-4">
        {done} of {total} job{total !== 1 ? 's' : ''} complete
      </p>

      {readyAssets.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {readyAssets.map((type) => (
            <div
              key={type}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
            >
              <span className="text-emerald-400 text-xs">✓</span>
              <span className="text-xs text-white/60">{ASSET_LABELS[type] ?? type}</span>
            </div>
          ))}
        </div>
      )}

      {readyAssets.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(JOB_LABELS).map(([, label]) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
            >
              <span className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0 animate-pulse" />
              <span className="text-xs text-white/30">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
