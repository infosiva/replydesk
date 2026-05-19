'use client'
import { motion } from 'framer-motion'

interface Props {
  color?: string
}

export function TypingIndicator({ color = 'rgba(255,255,255,0.4)' }: Props) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '12px 16px',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px 18px 18px 18px', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          style={{ width: 7, height: 7, borderRadius: '50%', background: color }}
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }} />
      ))}
    </div>
  )
}
