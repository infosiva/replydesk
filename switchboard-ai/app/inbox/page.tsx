import { db } from '@/lib/db'
import { ContactList } from '@/components/ContactList'
import { OfficeToggle } from '@/components/OfficeToggle'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const businessId = process.env.BUSINESS_ID!
  const [business, contacts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.contact.findMany({
      where: { businessId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

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
          <ContactList contacts={contacts as Parameters<typeof ContactList>[0]['contacts']} />
        </aside>
        <main className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Select a contact to view their timeline
        </main>
      </div>
    </div>
  )
}
