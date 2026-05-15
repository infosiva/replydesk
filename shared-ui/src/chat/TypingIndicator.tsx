'use client'
import React from 'react'

export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: '#f1f5f9',
          borderRadius: 18,
          padding: '10px 16px',
        }}
      >
        <style>{`
          @keyframes shared-ui-bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40%            { transform: translateY(-6px); opacity: 1; }
          }
        `}</style>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#94a3b8',
              animation: `shared-ui-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
