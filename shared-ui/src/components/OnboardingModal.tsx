'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'

export interface OnboardingStep {
  icon: string
  title: string
  body: string
}

export interface OnboardingModalProps {
  storageKey: string
  siteName: string
  tagline?: string
  steps: OnboardingStep[]
  accentColor?: string
  /** Auto-show on first visit. Default true */
  autoShow?: boolean
  /** Auto-close after N seconds (0 = never). Default 0 */
  autoCloseSeconds?: number
}

export function OnboardingModal({
  storageKey,
  siteName,
  tagline,
  steps,
  accentColor = '#8b5cf6',
  autoShow = true,
  autoCloseSeconds = 0,
}: OnboardingModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (autoShow && !localStorage.getItem(`onboarding_${storageKey}`)) {
      setOpen(true)
    }
  }, [storageKey, autoShow])

  useEffect(() => {
    if (open && autoCloseSeconds > 0) {
      const t = setTimeout(() => dismiss(), autoCloseSeconds * 1000)
      return () => clearTimeout(t)
    }
  }, [open, autoCloseSeconds])

  function dismiss() {
    setOpen(false)
    localStorage.setItem(`onboarding_${storageKey}`, '1')
  }

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!mounted) return null

  const EASE = [0.23, 1, 0.32, 1] as [number, number, number, number]
  const current = steps[step]

  return (
    <>
      {/* Help button — always visible to reopen */}
      <motion.button
        onClick={() => { setStep(0); setOpen(true) }}
        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
        style={{
          position: 'fixed', bottom: 24, right: 80, zIndex: 500,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 700,
          backdropFilter: 'blur(8px)',
        }}
        aria-label="How to use"
      >
        ?
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px',
            }}
            onClick={e => { if (e.target === e.currentTarget) dismiss() }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
              style={{
                background: '#0d0d18', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24, padding: '28px 28px 24px', maxWidth: 400, width: '100%',
                position: 'relative',
              }}
            >
              {/* Close */}
              <button onClick={dismiss}
                style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.06)',
                  border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={14} />
              </button>

              {/* Site name */}
              <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: 4 }}>
                Welcome to {siteName}
              </div>
              {tagline && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                  {tagline}
                </div>
              )}

              {/* Step content */}
              <AnimatePresence mode="wait">
                <motion.div key={step}
                  initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: EASE }}>
                  <div style={{ fontSize: 44, marginBottom: 16, textAlign: 'center' }}>
                    {current.icon}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff',
                    margin: '0 0 8px', letterSpacing: '-0.03em', textAlign: 'center' }}>
                    {current.title}
                  </h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65,
                    textAlign: 'center', margin: 0 }}>
                    {current.body}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Step dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '20px 0 18px' }}>
                {steps.map((_, i) => (
                  <button key={i} onClick={() => setStep(i)}
                    style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 99,
                      background: i === step ? accentColor : 'rgba(255,255,255,0.15)',
                      border: 'none', cursor: 'pointer',
                      transition: 'all 250ms cubic-bezier(0.23,1,0.32,1)' }} />
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                {step < steps.length - 1 ? (
                  <>
                    <button onClick={dismiss}
                      style={{ flex: 1, padding: '11px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}>
                      Skip
                    </button>
                    <motion.button onClick={next} whileTap={{ scale: 0.96 }}
                      style={{ flex: 2, padding: '11px', borderRadius: 12, border: 'none',
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      Next <ChevronRight size={14} />
                    </motion.button>
                  </>
                ) : (
                  <motion.button onClick={dismiss} whileTap={{ scale: 0.96 }}
                    style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                      color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      boxShadow: `0 0 24px ${accentColor}55` }}>
                    Let's go →
                  </motion.button>
                )}
              </div>

              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                marginTop: 12 }}>
                Press ? anytime to see this again
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
