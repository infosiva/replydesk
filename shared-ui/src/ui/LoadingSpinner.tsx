'use client'
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const SIZE_MAP = { sm: 20, md: 36, lg: 56 }
const STROKE_MAP = { sm: 3, md: 4, lg: 5 }

export default function LoadingSpinner({ size = 'md', color = '#6366f1' }: LoadingSpinnerProps) {
  const px = SIZE_MAP[size]
  const stroke = STROKE_MAP[size]
  const r = (px - stroke) / 2
  const circ = 2 * Math.PI * r

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      aria-label="Loading"
      role="status"
    >
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        style={{ animation: 'shared-ui-spin 0.85s linear infinite' }}
      >
        <style>{`
          @keyframes shared-ui-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
        {/* Track */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          opacity={0.2}
        />
        {/* Arc */}
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${circ * 0.72} ${circ * 0.28}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${px / 2} ${px / 2})`}
        />
      </svg>
    </div>
  )
}
