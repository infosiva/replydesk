'use client'
import React from 'react'

interface FollowUpChipsProps {
  questions: string[]
  onSelect: (q: string) => void
  accentColor?: string
}

export default function FollowUpChips({ questions, onSelect, accentColor = '#6366f1' }: FollowUpChipsProps) {
  if (!questions.length) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          style={{
            padding: '6px 12px',
            borderRadius: 20,
            border: `1px solid ${accentColor}55`,
            background: `${accentColor}11`,
            color: accentColor,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            maxWidth: 280,
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.background = `${accentColor}22`
            el.style.borderColor = accentColor
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.background = `${accentColor}11`
            el.style.borderColor = `${accentColor}55`
          }}
        >
          {q}
        </button>
      ))}
    </div>
  )
}
