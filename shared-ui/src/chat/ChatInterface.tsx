'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from './ChatMessage'
import TypingIndicator from './TypingIndicator'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatInterfaceProps {
  apiEndpoint: string
  systemPrompt?: string
  placeholder?: string
  accentColor?: string
  className?: string
}

export default function ChatInterface({
  apiEndpoint,
  systemPrompt,
  placeholder = 'Type a message…',
  accentColor = '#6366f1',
  className,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const body: Record<string, unknown> = { messages: newMessages }
    if (systemPrompt) body.systemPrompt = systemPrompt

    try {
      abortRef.current = new AbortController()
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        // SSE streaming
        setIsLoading(false)
        setIsStreaming(true)
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No response body')

        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const raw = line.slice(6).trim()
              if (raw === '[DONE]') continue
              try {
                const parsed = JSON.parse(raw)
                // Support OpenAI-style delta or plain text chunk
                const chunk: string =
                  parsed.choices?.[0]?.delta?.content ??
                  parsed.content ??
                  parsed.text ??
                  parsed.chunk ??
                  ''
                if (chunk) {
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: updated[updated.length - 1].content + chunk,
                    }
                    return updated
                  })
                }
              } catch {
                // plain text chunk (non-JSON SSE)
                if (raw && raw !== '[DONE]') {
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: updated[updated.length - 1].content + raw,
                    }
                    return updated
                  })
                }
              }
            }
          }
        }
        setIsStreaming(false)
      } else {
        // Regular JSON response
        const data = await res.json()
        const reply: string =
          data.message ??
          data.content ??
          data.text ??
          data.choices?.[0]?.message?.content ??
          JSON.stringify(data)
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
        setIsLoading(false)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setIsLoading(false)
      setIsStreaming(false)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    }
  }, [input, messages, apiEndpoint, systemPrompt, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
        background: '#fff',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 12px 8px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, marginTop: 40 }}>
            Start a conversation
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            streaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            accentColor={accentColor}
          />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: '1px solid #f1f5f9',
          padding: '10px 12px',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          background: '#fafafa',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            padding: '9px 12px',
            fontSize: 14,
            color: '#1e293b',
            outline: 'none',
            background: '#fff',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            maxHeight: 140,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || isLoading}
          aria-label="Send"
          style={{
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: 10,
            background: input.trim() && !isLoading ? accentColor : '#e2e8f0',
            color: '#fff',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
            fontSize: 18,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
