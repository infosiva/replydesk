'use client'
import React, { useState, useEffect } from 'react'
import { AuthUser } from './useAuth'
import SignupForm from './SignupForm'
import LoginForm from './LoginForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: AuthUser) => void
  site: string
  accentColor?: string
  initialMode?: 'signup' | 'login'
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  site,
  accentColor = '#6366f1',
  initialMode = 'signup',
}: AuthModalProps) {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode)

  // Reset to initialMode whenever modal opens
  useEffect(() => {
    if (isOpen) setMode(initialMode)
  }, [isOpen, initialMode])

  if (!isOpen) return null

  const handleSuccess = (user: AuthUser) => {
    onSuccess(user)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 440,
          padding: '32px 32px 28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            fontSize: 22,
            cursor: 'pointer',
            color: '#94a3b8',
            lineHeight: 1,
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #f1f5f9' }}>
          {(['signup', 'login'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                background: 'none',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                color: mode === tab ? accentColor : '#94a3b8',
                borderBottom: mode === tab ? `2.5px solid ${accentColor}` : '2.5px solid transparent',
                marginBottom: -2,
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          ))}
        </div>

        {/* Form */}
        {mode === 'signup' ? (
          <SignupForm onSuccess={handleSuccess} site={site} accentColor={accentColor} />
        ) : (
          <LoginForm onSuccess={handleSuccess} accentColor={accentColor} />
        )}

        {/* Toggle link */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: accentColor, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New here?{' '}
              <button
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: accentColor, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </div>
    </>
  )
}
