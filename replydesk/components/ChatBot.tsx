'use client'
import { useState, useRef, useEffect } from 'react'

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      setMessages(m => [...m, { role: 'assistant', content: '' }])
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value)
        setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: reply }])
      }
    } finally { setLoading(false) }
  }

  const accent = '#6366f1'

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: accent, boxShadow: `0 4px 24px ${accent}55` }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-xl transition-transform hover:scale-105 active:scale-95"
        aria-label="Chat with ReplyDesk AI"
      >
        {open ? '✕' : '💬'}
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 h-[420px] rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-white/10"
          style={{ background: '#0f0f1a' }}>
          <div className="px-4 py-3 font-semibold text-sm text-white border-b border-white/10 flex items-center gap-2"
            style={{ background: accent + '22' }}>
            <span>🤖</span> ReplyDesk Assistant
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <p className="text-white/40 text-center mt-8">Ask about AI customer support, pricing, or how ReplyDesk works.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rounded-xl px-3 py-2 max-w-[90%] ${m.role === 'user' ? 'ml-auto text-white' : 'mr-auto text-white/85'}`}
                style={{ background: m.role === 'user' ? accent : 'rgba(255,255,255,0.07)' }}>
                {m.content || <span className="opacity-50">▪▪▪</span>}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              className="flex-1 rounded-lg px-3 py-2 text-sm bg-white/10 text-white placeholder-white/30 outline-none focus:ring-1"
              style={{ '--tw-ring-color': accent } as React.CSSProperties}
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ background: accent }}>
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}
