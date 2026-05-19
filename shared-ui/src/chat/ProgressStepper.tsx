'use client'
import React from 'react'

export type StepStatus = 'pending' | 'active' | 'done' | 'error'

export interface Step {
  label: string
  status: StepStatus
}

interface ProgressStepperProps {
  steps: Step[]
  accentColor?: string
}

const ICON: Record<StepStatus, string> = {
  pending: '○',
  active: '◉',
  done: '✓',
  error: '✕',
}

const COLOR: Record<StepStatus, string> = {
  pending: '#475569',
  active: '#f59e0b',
  done: '#22c55e',
  error: '#ef4444',
}

export default function ProgressStepper({ steps, accentColor = '#6366f1' }: ProgressStepperProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              color: step.status === 'active' ? accentColor : COLOR[step.status],
              fontWeight: step.status === 'active' ? 700 : 400,
              fontSize: 14,
              width: 16,
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            {step.status === 'active' ? (
              <span style={{ animation: 'ps-spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            ) : (
              ICON[step.status]
            )}
          </span>
          <span
            style={{
              color: step.status === 'pending' ? '#475569' : step.status === 'done' ? '#64748b' : '#e2e8f0',
              textDecoration: step.status === 'done' ? 'none' : 'none',
            }}
          >
            {step.label}
          </span>
        </div>
      ))}
      <style>{`@keyframes ps-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
