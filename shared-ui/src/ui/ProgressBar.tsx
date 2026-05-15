'use client'
import React from 'react'

interface ProgressBarProps {
  value: number        // 0-100
  color?: string
  label?: string
  showPercent?: boolean
}

export default function ProgressBar({
  value,
  color = '#6366f1',
  label,
  showPercent = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div style={{ width: '100%' }}>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          {label && (
            <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</span>
          )}
          {showPercent && (
            <span style={{ fontSize: 13, color: '#64748b', marginLeft: 'auto' }}>{Math.round(clamped)}%</span>
          )}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: 8,
          background: '#e2e8f0',
          borderRadius: 99,
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            height: '100%',
            width: `${clamped}%`,
            background: color,
            borderRadius: 99,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}
