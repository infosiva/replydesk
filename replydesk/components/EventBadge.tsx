const BADGE: Record<string, { label: string; color: string }> = {
  CALL_INBOUND:  { label: 'Call',         color: 'text-blue-400 bg-blue-500/10'     },
  CALL_MISSED:   { label: 'Missed Call',  color: 'text-yellow-400 bg-yellow-500/10' },
  EMAIL_INBOUND: { label: 'Email',        color: 'text-purple-400 bg-purple-500/10' },
  SMS_INBOUND:   { label: 'SMS',          color: 'text-cyan-400 bg-cyan-500/10'     },
  AI_REPLY:      { label: 'AI Reply',     color: 'text-emerald-400 bg-emerald-500/10' },
  HUMAN_REPLY:   { label: 'Human Reply',  color: 'text-orange-400 bg-orange-500/10' },
}

export function EventBadge({ type }: { type: string }) {
  const { label, color } = BADGE[type] ?? { label: type, color: 'text-gray-400 bg-gray-500/10' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
  )
}
