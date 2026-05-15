'use client'
import React from 'react'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  accentColor?: string
}

export default function ChatMessage({
  role,
  content,
  streaming = false,
  accentColor = '#6366f1',
}: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 4px',
      }}
    >
      <div
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isUser ? accentColor : '#f1f5f9',
          color: isUser ? '#fff' : '#1e293b',
          fontSize: 14,
          lineHeight: 1.55,
          wordBreak: 'break-word',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        }}
      >
        {content}
        {streaming && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: '1em',
              background: isUser ? 'rgba(255,255,255,0.8)' : '#94a3b8',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              animation: 'shared-ui-blink 1s step-end infinite',
            }}
          />
        )}
        <style>{`
          @keyframes shared-ui-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  )
}
