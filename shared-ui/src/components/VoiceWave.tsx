'use client'
import { motion } from 'framer-motion'

interface Props {
  active: boolean
  color?: string
  bars?: number
}

export function VoiceWave({ active, color = '#8b5cf6', bars = 5 }: Props) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 24 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div key={i}
          style={{ width: 3, borderRadius: 99, background: color, originY: 0.5 }}
          animate={active ? {
            height: [6, 18, 8, 20, 6],
            opacity: [0.5, 1, 0.7, 1, 0.5],
          } : { height: 4, opacity: 0.3 }}
          transition={active ? {
            duration: 0.6 + i * 0.08,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          } : { duration: 0.25 }}
        />
      ))}
    </div>
  )
}
