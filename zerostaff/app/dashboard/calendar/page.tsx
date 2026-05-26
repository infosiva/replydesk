import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { workspaces, calendar_items } from '@/lib/schema'
import { eq, asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/CalendarGrid'
import type { DbCalendarItem } from '@/lib/types'

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.owner_id, session.user.id))
    .limit(1)

  const items: DbCalendarItem[] = workspace
    ? (await db
        .select()
        .from(calendar_items)
        .where(eq(calendar_items.workspace_id, workspace.id))
        .orderBy(asc(calendar_items.publish_date))
      ) as DbCalendarItem[]
    : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Calendar</h1>
        <p className="text-sm text-white/50 mt-1">Schedule and track content across platforms</p>
      </div>
      <div className="glass p-5">
        <CalendarGrid items={items} />
      </div>
    </div>
  )
}
