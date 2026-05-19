'use client'
import React, { useState } from 'react'

export interface Citation {
  index: number
  title: string
  url: string
  excerpt?: string
}

interface StreamingMessageProps {
  content: string
  streaming?: boolean
  citations?: Citation[]
  accentColor?: string
  className?: string
}

function parseCitations(text: string): { text: string; citations: number[] }[] {
  const parts: { text: string; citations: number[] }[] = []
  const regex = /\[(\d+)\]/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), citations: [] })
    parts.push({ text: '', citations: [parseInt(match[1])] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), citations: [] })
  return parts
}

export default function StreamingMessage({
  content,
  streaming = false,
  citations = [],
  accentColor = '#6366f1',
}: StreamingMessageProps) {
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null)
  const parts = parseCitations(content)

  return (
    <div style={{ position: 'relative', lineHeight: 1.65, fontSize: 14, color: '#e2e8f0' }}>
      {parts.map((part, i) =>
        part.citations.length > 0 ? (
          part.citations.map(idx => {
            const cite = citations.find(c => c.index === idx)
            if (!cite) return null
            return (
              <span key={`${i}-${idx}`} style={{ position: 'relative', display: 'inline' }}>
                <sup
                  onMouseEnter={() => setHoveredCitation(idx)}
                  onMouseLeave={() => setHoveredCitation(null)}
                  style={{
                    cursor: 'pointer',
                    color: accentColor,
                    fontWeight: 600,
                    fontSize: '0.7em',
                    padding: '0 2px',
                    borderRadius: 3,
                    background: `${accentColor}22`,
                    userSelect: 'none',
                  }}
                >
                  [{idx}]
                </sup>
                {hoveredCitation === idx && cite && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      zIndex: 50,
                      background: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      width: 260,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#f1f5f9', marginBottom: 4 }}>
                      {cite.title}
                    </span>
                    {cite.excerpt && (
                      <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                        {cite.excerpt}
                      </span>
                    )}
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: accentColor, textDecoration: 'none' }}
                      onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = 'underline')}
                      onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}
                    >
                      {cite.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </a>
                  </span>
                )}
              </span>
            )
          })
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
      {streaming && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 2,
            height: '0.9em',
            background: accentColor,
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            borderRadius: 1,
            animation: 'smsg-blink 1s step-end infinite',
          }}
        />
      )}
      <style>{`
        @keyframes smsg-blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  )
}
