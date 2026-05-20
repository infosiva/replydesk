'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReplyBox({ sourceEventId }: { sourceEventId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const router = useRouter()

  async function send() {
    if (!message.trim()) return
    setSending(true)
    await fetch(`/api/events/${sourceEventId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setMessage('')
    setSending(false)
    router.refresh()
  }

  return (
    <div className="border-t border-white/10 p-4 flex gap-3">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type a reply... (Cmd+Enter to send)"
        rows={3}
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
      />
      <button
        onClick={send}
        disabled={sending || !message.trim()}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-sm font-medium self-end transition-colors"
      >
        {sending ? 'Sending...' : 'Send ↵'}
      </button>
    </div>
  )
}
