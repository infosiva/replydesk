import { EventBadge } from './EventBadge'

type Event = {
  id: string
  type: string
  direction: string
  raw: string
  sentReply: string | null
  claimedBy: string | null
  createdAt: string
}

export function EventTimeline({ events }: { events: Event[] }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {events.map(ev => (
        <div
          key={ev.id}
          className={`flex gap-3 ${ev.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div className={`flex flex-col gap-1 max-w-md ${ev.direction === 'OUTBOUND' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-center gap-2 ${ev.direction === 'OUTBOUND' ? 'flex-row-reverse' : ''}`}>
              <EventBadge type={ev.type} />
              <span className="text-xs text-gray-500">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
              {ev.claimedBy && <span className="text-xs text-orange-400">Human</span>}
            </div>
            <div
              className={`rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                ev.direction === 'OUTBOUND'
                  ? 'bg-indigo-600/30 text-indigo-100 rounded-tr-sm'
                  : 'bg-white/8 text-gray-200 rounded-tl-sm'
              }`}
            >
              {ev.sentReply ?? ev.raw}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
