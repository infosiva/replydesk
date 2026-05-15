'use client'
import React, { useState, useEffect } from 'react'
import MagicAuthModal from '../auth/MagicAuthModal'
import type { AuthUser } from '../auth/useMagicAuth'

export interface GateFeature {
  icon: string
  label: string
  desc: string
}

interface RegisterGateProps {
  freeUsed: number
  freeLimit: number
  freeFeature: string
  /** Short text: "unlimited games & leaderboards" */
  lockedFeature: string
  /** Richer feature list shown as a preview carousel */
  lockedFeatures?: GateFeature[]
  accentColor?: string
  site: string
  onSuccess: (user: AuthUser) => void
  onDismiss: () => void
  /** Override the headline */
  headline?: string
  /** Override the subline */
  subline?: string
}

const DEFAULT_FEATURES: Record<string, GateFeature[]> = {
  kwizzo: [
    { icon: '🏆', label: 'Live Leaderboard', desc: 'Real-time rankings after every question' },
    { icon: '♾️', label: 'Unlimited Games', desc: 'Play as many rounds as you want, forever' },
    { icon: '🎯', label: 'Tournaments', desc: 'Compete against other families in weekly events' },
    { icon: '📊', label: 'Score History', desc: 'Track every player\'s progress over time' },
    { icon: '🎨', label: 'Custom Topics', desc: 'Create quizzes on anything — birthdays, movies, family stories' },
  ],
  tutiq: [
    { icon: '🗺️', label: 'Full Learning Path', desc: 'AI builds a personalised curriculum just for you' },
    { icon: '📈', label: 'Progress Tracking', desc: 'See every topic mastered and what\'s next' },
    { icon: '🔁', label: 'Spaced Repetition', desc: 'Review weak spots at the perfect moment' },
    { icon: '🏅', label: 'Streak Rewards', desc: 'Daily streaks keep motivation high' },
    { icon: '💬', label: 'Deep Explanations', desc: 'Ask follow-up questions and go deeper on any topic' },
  ],
  quizbites: [
    { icon: '👥', label: 'Unlimited Sessions', desc: 'Host as many live quizzes as your class needs' },
    { icon: '📊', label: 'Class Analytics', desc: 'See how every student performed, question by question' },
    { icon: '📤', label: 'Export Results', desc: 'Download CSV reports for grades or portfolios' },
    { icon: '🔄', label: 'Session History', desc: 'Review and replay any past quiz with your class' },
    { icon: '🎯', label: 'Custom Questions', desc: 'Add your own questions alongside AI-generated ones' },
  ],
}

export default function RegisterGate({
  freeUsed, freeLimit, freeFeature, lockedFeature,
  lockedFeatures, accentColor = '#6366f1', site,
  onSuccess, onDismiss,
  headline, subline,
}: RegisterGateProps) {
  const [showAuth, setShowAuth] = useState(false)
  const [slide, setSlide] = useState(0)

  const features = lockedFeatures ?? DEFAULT_FEATURES[site] ?? []

  // Auto-advance feature carousel
  useEffect(() => {
    if (features.length <= 1) return
    const t = setInterval(() => setSlide(s => (s + 1) % features.length), 3000)
    return () => clearInterval(t)
  }, [features.length])

  const pct = Math.min(100, Math.round((freeUsed / freeLimit) * 100))

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
        onClick={e => { if (e.target === e.currentTarget) onDismiss() }}
      >
        <div style={{
          background: '#fff', borderRadius: 24, maxWidth: 420, width: '100%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.30)',
          overflow: 'hidden',
          animation: 'gateSlideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* Accent bar */}
          <div style={{ height: 5, background: `linear-gradient(90deg,${accentColor},${accentColor}66)` }} />

          <div style={{ padding: '28px 28px 24px' }}>

            {/* Usage bar */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Free {freeFeature}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>
                  {freeUsed} / {freeLimit} used
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: `linear-gradient(90deg,${accentColor},${accentColor}bb)`,
                  borderRadius: 99, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>

            {/* Headline */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔓</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 21, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {headline ?? `Unlock the full ${features.length > 0 ? 'experience' : lockedFeature}`}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
                {subline ?? 'You\'ve used your free quota. Sign in free to keep going — no password, no credit card.'}
              </p>
            </div>

            {/* Feature preview carousel */}
            {features.length > 0 && (
              <div style={{
                background: `${accentColor}0d`,
                border: `1px solid ${accentColor}33`,
                borderRadius: 14, padding: '16px 18px', marginBottom: 20,
                minHeight: 76,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{features[slide].icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>
                      {features[slide].label}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>
                      {features[slide].desc}
                    </div>
                  </div>
                </div>
                {/* Dots */}
                <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 12 }}>
                  {features.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlide(i)}
                      style={{
                        width: i === slide ? 18 : 6, height: 6,
                        borderRadius: 99, border: 'none', cursor: 'pointer',
                        background: i === slide ? accentColor : '#cbd5e1',
                        padding: 0, transition: 'all 0.25s',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* All features mini-list */}
            {features.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '6px 12px', marginBottom: 20,
              }}>
                {features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                    <span style={{ color: accentColor, fontSize: 11, fontWeight: 700 }}>✓</span>
                    {f.label}
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => setShowAuth(true)}
              style={{
                width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
                background: accentColor, color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', marginBottom: 10,
                boxShadow: `0 4px 16px ${accentColor}55`,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = `0 6px 20px ${accentColor}77`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = `0 4px 16px ${accentColor}55`
              }}
            >
              Sign in free — it takes 30 seconds
            </button>

            <div style={{ textAlign: 'center' }}>
              <button onClick={onDismiss} style={{
                background: 'none', border: 'none', color: '#94a3b8',
                fontSize: 13, cursor: 'pointer', padding: '6px 12px',
              }}>
                Maybe later
              </button>
            </div>

            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 11, color: '#cbd5e1' }}>
              No password · No credit card · Unsubscribe any time
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gateSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <MagicAuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={u => { setShowAuth(false); onSuccess(u) }}
        site={site}
        accentColor={accentColor}
        title="Sign in free"
        subtitle="We'll email you a one-time code. No password, ever."
      />
    </>
  )
}
