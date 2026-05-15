'use client'
import React, { useEffect, useState } from 'react'
import { useToast, ToastItem, ToastType } from './useToast'

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✓', text: '#166534' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '✕', text: '#991b1b' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ', text: '#1e40af' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠', text: '#92400e' },
}

function SingleToast({ item }: { item: ToastItem }) {
  const { removeToast } = useToast()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const colors = COLORS[item.type]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        minWidth: 280,
        maxWidth: 380,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease',
        pointerEvents: 'auto',
      }}
    >
      {/* Icon */}
      <span style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: colors.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: colors.text,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {colors.icon}
      </span>

      {/* Message */}
      <span style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 1.4 }}>
        {item.message}
      </span>

      {/* Close */}
      <button
        onClick={() => removeToast(item.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: colors.text,
          opacity: 0.6,
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

export default function Toast() {
  const { toasts } = useToast()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(item => (
        <SingleToast key={item.id} item={item} />
      ))}
    </div>
  )
}
