'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useFingerprint } from '../hooks/useFingerprint'

export interface ChatBotProps {
  siteName: string
  openingMessage: string
  apiEndpoint: string
  primaryColor?: string
  delayMs?: number
  /** Bottom offset in px — increase when FeedbackWidget is also visible */
  bottomOffset?: number
}

interface Message { role: 'user' | 'assistant'; content: string }

/**
 * Reusable floating chatbot widget.
 * Mobile: full-viewport height minus safe-area. Compact content.
 * Desktop: fixed 500px panel bottom-right.
 * Never overflows the viewport.
 */
export default function ChatBot({
  siteName,
  openingMessage,
  apiEndpoint,
  primaryColor = '#0ea5e9',
  delayMs = 30000,
  bottomOffset = 84,
}: ChatBotProps) {
  const { visitorId } = useFingerprint()
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [gated, setGated] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: openingMessage },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, visitorId }),
      })
      if (!res.ok) throw new Error('Request failed')
      const contentType = res.headers.get('content-type') ?? ''

      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (data.gated) setGated(true)
        setMessages(prev => [...prev, { role: 'assistant', content: data.text ?? '' }])
      } else {
        if (!res.body) throw new Error('No body')
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let assistantText = ''
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          assistantText += decoder.decode(value, { stream: true })
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantText }
            return updated
          })
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, apiEndpoint, visitorId])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!visible) return null

  // Panel dimensions — mobile fills viewport, desktop is fixed
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: `calc(100dvh - ${bottomOffset}px)`,
        maxHeight: `calc(100dvh - ${bottomOffset}px)`,
        zIndex: 9998,
        borderRadius: '16px 16px 0 0',
        background: '#020c14',
        border: `1px solid ${primaryColor}44`,
        borderBottom: 'none',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        bottom: bottomOffset + 4,
        right: 24,
        zIndex: 9998,
        width: 370,
        height: 500,
        maxHeight: `calc(100dvh - ${bottomOffset + 20}px)`,
        borderRadius: 12,
        background: '#020c14',
        border: `1px solid ${primaryColor}44`,
        boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Chat with ${siteName}`}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: 12,
          background: primaryColor,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 20px ${primaryColor}55`,
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <span style={{ fontSize: 22 }}>💬</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={panelStyle}>
          <style>{`
            @keyframes chatbot-slide-up { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
            @keyframes chatbot-slide-bottom { from { opacity:0; transform:translateY(100%) } to { opacity:1; transform:translateY(0) } }
            .chatbot-panel { animation: ${isMobile ? 'chatbot-slide-bottom' : 'chatbot-slide-up'} 0.22s cubic-bezier(0.23,1,0.32,1) }
            .chatbot-msgs::-webkit-scrollbar { width:4px }
            .chatbot-msgs::-webkit-scrollbar-thumb { background:${primaryColor}44; border-radius:2px }
            @keyframes chatbot-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${primaryColor}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: `${primaryColor}12`,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>
                💬
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{siteName} AI</div>
                <div style={{ color: `${primaryColor}cc`, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Online · Free assistant
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 6, borderRadius: 6 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages — flex-1 + overflow-y-auto keeps it in bounds */}
          <div
            className="chatbot-msgs"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '12px 14px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minHeight: 0, // critical for flex children to scroll
            }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: m.role === 'user' ? primaryColor : 'rgba(255,255,255,0.05)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  color: '#f0f0f0',
                  fontSize: isMobile ? 14 : 13.5,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 3px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 1, 2].map(d => (
                    <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: primaryColor, display: 'inline-block', animation: `chatbot-bounce 1.2s ${d * 0.2}s infinite ease-in-out` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Gated prompt */}
          {gated && (
            <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: `${primaryColor}12`, textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
                Sign up free to keep chatting 🚀
              </div>
              <a href="/signup" style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none', color: '#fff', background: primaryColor }}>
                Sign up free →
              </a>
            </div>
          )}

          {/* Input — always at bottom, flexShrink:0 */}
          <div style={{
            padding: '10px 12px',
            paddingBottom: isMobile ? 'max(10px, env(safe-area-inset-bottom))' : '10px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: '#061622',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask me anything…"
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${primaryColor}30`,
                borderRadius: 8,
                padding: '9px 13px',
                color: '#f0f0f0',
                fontSize: 14,
                outline: 'none',
                minWidth: 0,
              }}
              onFocus={e => (e.target.style.borderColor = primaryColor)}
              onBlur={e => (e.target.style.borderColor = `${primaryColor}30`)}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width: 38, height: 38, borderRadius: 8, border: 'none',
                background: input.trim() && !loading ? primaryColor : 'rgba(255,255,255,0.06)',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
