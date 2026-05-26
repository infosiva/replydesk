'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  sender_email: string
  direction: string
  body: string
  created_at: Date | string
}

interface MessageThreadProps {
  threadId: string
  initialMessages: Message[]
}

export default function MessageThread({ threadId, initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/threads/${threadId}/messages`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages ?? [])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      } catch {
        // ignore
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [threadId])

  async function handleSend() {
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setReply('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-white/30 text-center py-8">No messages yet</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
              msg.direction === 'inbound'
                ? 'bg-white/[0.06] text-white/80'
                : 'bg-purple-600/80 text-white'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <p className="text-[10px] mt-1 opacity-40">
                {msg.direction === 'inbound' ? msg.sender_email : 'You'} ·{' '}
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="flex gap-2 pt-4 border-t border-white/[0.06]">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="Reply…"
          rows={2}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-purple-500/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition self-end"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
