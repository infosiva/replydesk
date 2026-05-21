'use client'

import { useState } from 'react'
import TierGate from './TierGate'

interface ResultCardProps {
  title: string
  icon: string
  type: string
  content: unknown
  locked?: boolean
}

export default function ResultCard({ title, icon, type, content, locked = false }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  function getPreviewText(): string {
    if (!content || typeof content !== 'object') return ''
    const c = content as Record<string, unknown>

    switch (type) {
      case 'blog_post': {
        const sections = c.sections as { heading: string; body: string }[] | undefined
        return `${c.title || ''}\n\n${sections?.[0]?.body?.slice(0, 300) || ''}…`
      }
      case 'podcast_episode':
        return `${c.title || ''}\n\n${(c.hook as string || '').slice(0, 300)}…`
      case 'video_storyboard':
        return `${c.title || ''}\n\n${(c.voiceoverScript as string || '').slice(0, 300)}…`
      case 'linkedin_posts': {
        const posts = c.posts as { hook: string; body: string }[] | undefined
        return posts?.[0] ? `${posts[0].hook}\n\n${posts[0].body}` : ''
      }
      case 'email_sequence': {
        const emails = c.emails as { subject: string; body: string }[] | undefined
        return emails?.[0] ? `Subject: ${emails[0].subject}\n\n${emails[0].body.slice(0, 300)}…` : ''
      }
      case 'short_clips': {
        const captions = c.captions as string[] | undefined
        return captions?.slice(0, 3).join('\n\n') || ''
      }
      case 'lead_gen_pack': {
        const msgs = c.linkedinConnections as string[] | undefined
        return msgs?.[0] || ''
      }
      case 'client_report':
        return (c.executiveSummary as string || '').slice(0, 400) + '…'
      default:
        return JSON.stringify(content, null, 2).slice(0, 400)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(JSON.stringify(content, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const preview = getPreviewText()

  return (
    <TierGate locked={locked}>
      <div className="glass">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <h3 className="font-semibold text-white">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs px-2.5 py-1 rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="text-xs px-2.5 py-1 rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition"
            >
              Download
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs px-2.5 py-1 rounded-md bg-white/5 text-white/50 hover:text-white transition"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        <div className="px-5 pb-5">
          {expanded ? (
            <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono bg-black/20 rounded-lg p-4 max-h-96 overflow-y-auto">
              {JSON.stringify(content, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-white/60 line-clamp-4 whitespace-pre-line">{preview}</p>
          )}
        </div>
      </div>
    </TierGate>
  )
}
