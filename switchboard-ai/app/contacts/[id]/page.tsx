import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { EventTimeline } from '@/components/EventTimeline'
import { ReplyBox } from '@/components/ReplyBox'
import { ContactList } from '@/components/ContactList'
import { OfficeToggle } from '@/components/OfficeToggle'

export const dynamic = 'force-dynamic'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = process.env.BUSINESS_ID!

  const [business, contact, contacts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.contact.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    }),
    db.contact.findMany({
      where: { businessId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!contact) notFound()

  const lastEvent = contact.events.at(-1)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-lg font-semibold">ReplyDesk</h1>
          <p className="text-xs text-gray-500">{business.name}</p>
        </div>
        <OfficeToggle initial={business.officeStatus} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-white/10 overflow-y-auto py-2">
          <ContactList
            contacts={contacts as Parameters<typeof ContactList>[0]['contacts']}
            activeId={id}
          />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold">{contact.name ?? contact.phone ?? contact.email}</h2>
            <div className="flex gap-3 text-xs text-gray-500 mt-1">
              {contact.phone && <span>📞 {contact.phone}</span>}
              {contact.email && <span>✉️ {contact.email}</span>}
              <span>{contact.events.length} events</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <EventTimeline events={contact.events as Parameters<typeof EventTimeline>[0]['events']} />
          </div>

          {lastEvent && <ReplyBox sourceEventId={lastEvent.id} />}
        </main>
      </div>
    </div>
  )
}
