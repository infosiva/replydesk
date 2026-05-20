'use client'
import { useRouter } from 'next/navigation'
import { EventBadge } from './EventBadge'

type Event = { id: string; type: string; raw: string; createdAt: string }
type Contact = { id: string; name: string | null; phone: string | null; email: string | null; events: Event[] }

export function ContactList({ contacts, activeId }: { contacts: Contact[]; activeId?: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {contacts.map(c => {
        const last = c.events[0]
        return (
          <button
            key={c.id}
            onClick={() => router.push(`/contacts/${c.id}`)}
            className={`text-left px-4 py-3 rounded-lg transition-colors ${
              c.id === activeId ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm truncate">{c.name ?? c.phone ?? c.email}</span>
              {last && <EventBadge type={last.type} />}
            </div>
            {last && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{last.raw.slice(0, 60)}</p>
            )}
          </button>
        )
      })}
      {contacts.length === 0 && (
        <p className="text-gray-500 text-sm px-4 py-8 text-center">
          No contacts yet. Calls and emails will appear here.
        </p>
      )}
    </div>
  )
}
