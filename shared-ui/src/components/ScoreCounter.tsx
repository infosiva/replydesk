'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  target: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  colorThresholds?: { good: number; ok: number }
  colors?: { good: string; ok: string; bad: string }
}

const SIZE = { sm: 36, md: 56, lg: 72 } as const

export function ScoreCounter({
  target,
  size = 'lg',
  label = 'Score',
  colorThresholds = { good: 75, ok: 55 },
  colors = { good: '#10b981', ok: '#fbbf24', bad: '#ef4444' },
}: Props) {
  const [display, setDisplay] = useState(0)
  const color = target >= colorThresholds.good ? colors.good
    : target >= colorThresholds.ok ? colors.ok
    : colors.bad

  useEffect(() => {
    let n = 0
    const step = () => {
      n += Math.ceil((target - n) * 0.12) || 1
      if (n >= target) { setDisplay(target); return }
      setDisplay(n)
      requestAnimationFrame(step)
    }
    const t = setTimeout(() => requestAnimationFrame(step), 200)
    return () => clearTimeout(t)
  }, [target])

  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6, bounce: 0.3 }}
        style={{ fontSize: SIZE[size], fontWeight: 900, color, lineHeight: 1,
          letterSpacing: '-0.05em' }}>
        {display}
      </motion.div>
      {label && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
          letterSpacing: '0.12em', marginTop: 6 }}>
          {label}
        </div>
      )}
    </div>
  )
}
