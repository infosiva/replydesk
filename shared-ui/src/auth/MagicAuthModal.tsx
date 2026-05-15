'use client'
import React, { useState, useEffect, useRef } from 'react'
import { sendMagicCode, verifyMagicCode, type AuthUser } from './useMagicAuth'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (user: AuthUser) => void
  site: string
  accentColor?: string
  title?: string
  subtitle?: string
}

type Step = 'email' | 'code' | 'done'

export default function MagicAuthModal({
  isOpen, onClose, onSuccess, site,
  accentColor = '#6366f1',
  title = 'Sign in — it\'s free',
  subtitle = 'No password. We\'ll email you a one-time code.',
}: Props) {
  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [countdown, setCountdown] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setStep('email'); setEmail(''); setCode(''); setError(''); setLoading(false); setCountdown(0)
      setTimeout(() => emailRef.current?.focus(), 80)
    }
  }, [isOpen])

  useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 80)
  }, [step])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  if (!isOpen) return null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email'); return }
    setLoading(true); setError('')
    const res = await sendMagicCode(email.trim(), site)
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Failed to send'); return }
    setStep('code'); setCountdown(60)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true); setError('')
    const res = await verifyMagicCode(email.trim(), trimmed, site)
    setLoading(false)
    if (!res.ok) { setError(res.error ?? 'Invalid code'); return }
    setStep('done')
    setTimeout(() => { onSuccess(res.user!); onClose() }, 900)
  }

  async function handleResend() {
    if (countdown > 0) return
    setLoading(true)
    await sendMagicCode(email.trim(), site)
    setLoading(false)
    setCountdown(60); setCode('')
  }

  const accent = accentColor

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 1001, width: '90%', maxWidth: 400,
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
      }}>
        {/* Accent top bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg,${accent},${accent}88)` }} />

        <div style={{ padding: '28px 28px 32px' }}>
          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999', lineHeight: 1,
          }}>×</button>

          {step === 'done' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>You&apos;re in!</p>
              <p style={{ fontSize: 14, color: '#777' }}>Signed in as <strong>{email}</strong></p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>{title}</p>
              <p style={{ fontSize: 14, color: '#777', marginBottom: 22, lineHeight: 1.5 }}>{subtitle}</p>

              {/* Perks */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {['Free forever', 'No password', 'Instant access'].map(p => (
                  <span key={p} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                    background: `${accent}15`, border: `1px solid ${accent}40`, color: accent,
                  }}>{p}</span>
                ))}
              </div>

              {step === 'email' ? (
                <form onSubmit={handleSend}>
                  <input
                    ref={emailRef}
                    type="email" required value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="your@email.com"
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
                      border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`, fontSize: 14,
                      outline: 'none', marginBottom: error ? 8 : 14, fontFamily: 'inherit',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = accent }}
                    onBlur={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : '#e5e7eb' }}
                  />
                  {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>⚠ {error}</p>}
                  <button type="submit" disabled={loading} style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: accent, color: '#fff', fontSize: 15, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                    fontFamily: 'inherit',
                  }}>
                    {loading ? 'Sending…' : 'Send login code →'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify}>
                  <p style={{ fontSize: 13, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
                    Code sent to <strong>{email}</strong>. Check inbox + spam.
                  </p>
                  <input
                    ref={codeRef}
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                    placeholder="123456"
                    style={{
                      width: '100%', padding: '14px', borderRadius: 10, boxSizing: 'border-box',
                      border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`,
                      fontSize: 28, fontWeight: 800, letterSpacing: '0.3em', textAlign: 'center',
                      outline: 'none', fontFamily: 'monospace', marginBottom: error ? 8 : 14,
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = accent }}
                    onBlur={e => { e.currentTarget.style.borderColor = error ? '#ef4444' : '#e5e7eb' }}
                  />
                  {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>⚠ {error}</p>}
                  <button type="submit" disabled={loading || code.length !== 6} style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none',
                    background: code.length === 6 ? accent : '#e5e7eb',
                    color: code.length === 6 ? '#fff' : '#aaa',
                    fontSize: 15, fontWeight: 700, cursor: code.length === 6 ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                    {loading ? 'Verifying…' : 'Confirm & Sign In'}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
                    <button type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
                      style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 0 }}>
                      ← Change email
                    </button>
                    <button type="button" onClick={handleResend} disabled={countdown > 0}
                      style={{ background: 'none', border: 'none', cursor: countdown > 0 ? 'not-allowed' : 'pointer', padding: 0, color: countdown > 0 ? '#ccc' : accent, fontWeight: 600 }}>
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
