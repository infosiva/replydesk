'use client'
import React, { useState } from 'react'

export type AuthProvider = 'google' | 'github' | 'magic-link'

interface SignInModalProps {
  open: boolean
  onClose: () => void
  providers?: AuthProvider[]
  brandLogo?: React.ReactNode
  brandName?: string
  accentColor?: string
  onSuccess?: (user: { email: string; name?: string }) => void
  onMagicLinkSend?: (email: string) => Promise<void>
}

export default function SignInModal({
  open,
  onClose,
  providers = ['google', 'magic-link'],
  brandLogo,
  brandName = 'Sign in',
  accentColor = '#6366f1',
  onSuccess,
  onMagicLinkSend,
}: SignInModalProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      if (onMagicLinkSend) {
        await onMagicLinkSend(email)
      } else {
        await fetch('/api/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      }
      setSent(true)
    } catch {
      setError('Failed to send link. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '32px 28px',
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {brandLogo && <div style={{ marginBottom: 12 }}>{brandLogo}</div>}
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{brandName}</h2>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            Check your email for a magic link.
            <br />
            <button
              onClick={() => setSent(false)}
              style={{ marginTop: 16, background: 'none', border: 'none', color: accentColor, cursor: 'pointer', fontSize: 13 }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {providers.includes('google') && (
              <button
                onClick={() => {
                  const url = `/api/auth/google?callbackUrl=${encodeURIComponent(window.location.href)}`
                  window.location.href = url
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '11px 16px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)', background: '#fff',
                  color: '#3c4043', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 12.091 17.64 10 17.64 9.2z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            )}

            {providers.includes('github') && (
              <button
                onClick={() => {
                  const url = `/api/auth/github?callbackUrl=${encodeURIComponent(window.location.href)}`
                  window.location.href = url
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '11px 16px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)', background: '#24292f',
                  color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>
            )}

            {providers.includes('magic-link') && (
              <>
                {(providers.includes('google') || providers.includes('github')) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    <span style={{ fontSize: 11, color: '#475569' }}>or</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                  </div>
                )}
                <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    style={{
                      width: '100%', padding: '11px 12px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#f1f5f9', fontSize: 14, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  {error && <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '11px 16px', borderRadius: 8, border: 'none',
                      background: accentColor, color: '#fff',
                      fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
                    }}
                  >
                    {loading ? 'Sending…' : 'Send magic link'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', color: '#475569',
            cursor: 'pointer', fontSize: 18, padding: 4, lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
