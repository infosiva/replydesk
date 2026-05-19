'use client'
import { motion } from 'framer-motion'
import { Mic, MicOff } from 'lucide-react'
import { VoiceWave } from './VoiceWave'

interface Props {
  listening: boolean
  disabled?: boolean
  onToggle: () => void
  accentColor?: string
  label?: string
}

export function MicButton({
  listening, disabled = false, onToggle, accentColor = '#8b5cf6', label
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.07 } : {}}
        whileTap={!disabled ? { scale: 0.93 } : {}}
        animate={listening ? {
          boxShadow: [
            `0 0 0 0 ${accentColor}55`,
            `0 0 0 20px ${accentColor}00`,
            `0 0 0 0 ${accentColor}00`,
          ],
        } : {}}
        transition={listening ? { duration: 1.4, repeat: Infinity } : {}}
        aria-label={listening ? 'Stop recording' : 'Start recording'}
        style={{ width: 72, height: 72, borderRadius: '50%', border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: listening
            ? `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`
            : 'rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transition: 'background 250ms cubic-bezier(0.23,1,0.32,1)' }}>
        {listening
          ? <MicOff size={26} color="#fff" />
          : <Mic size={26} color="rgba(255,255,255,0.7)" />}
      </motion.button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <VoiceWave active={listening} color={accentColor} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: listening ? accentColor : 'rgba(255,255,255,0.35)',
          transition: 'color 200ms' }}>
          {label ?? (listening ? 'Listening…' : 'Tap to speak')}
        </span>
        <VoiceWave active={listening} color={accentColor} />
      </div>
    </div>
  )
}
