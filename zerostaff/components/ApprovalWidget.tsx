'use client'

import { useState } from 'react'

type Comment = {
  id: string
  author_email: string | null
  body: string
  resolved: boolean
  created_at: string
}

export function ApprovalWidget({
  assetId,
  approvedAt,
  comments: initialComments,
}: {
  assetId: string
  approvedAt: string | null
  comments: Comment[]
}) {
  const [approved, setApproved] = useState(!!approvedAt)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    await fetch(`/api/assets/${assetId}/approve`, { method: 'POST' })
    setApproved(true)
    setLoading(false)
  }

  async function addComment() {
    if (!draft.trim()) return
    setLoading(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, body: draft.trim() }),
    })
    if (res.ok) {
      const { id } = await res.json()
      setComments(prev => [...prev, {
        id, author_email: null, body: draft.trim(), resolved: false,
        created_at: new Date().toISOString(),
      }])
      setDraft('')
    }
    setLoading(false)
  }

  return (
    <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
      <div className="flex items-center gap-3">
        {approved ? (
          <span className="flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full" /> Approved
          </span>
        ) : (
          <button onClick={approve} disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
            {loading ? 'Approving...' : 'Approve'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {comments.map(c => (
          <div key={c.id} className="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/80">
            <p className="whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-white/30 mt-1">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addComment() }}
            placeholder="Add a comment..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addComment} disabled={loading || !draft.trim()}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm rounded-lg transition">
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
