import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { threads, messages, briefs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import MessageThread from '@/components/MessageThread'
import Link from 'next/link'

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [thread] = await db.select().from(threads).where(eq(threads.id, id))
  if (!thread) notFound()

  const threadMessages = await db.select().from(messages)
    .where(eq(messages.thread_id, id))
    .orderBy(messages.created_at)

  let brief: { topic: string; brand: string } | null = null
  if (thread.brief_id) {
    const [row] = await db.select({ topic: briefs.topic, brand: briefs.brand })
      .from(briefs).where(eq(briefs.id, thread.brief_id))
    brief = row ?? null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-white/40 hover:text-white/70 transition">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-white mt-1">{thread.subject}</h1>
          {brief && (
            <p className="text-xs text-white/40">{brief.brand} · {brief.topic}</p>
          )}
        </div>
      </div>

      <div className="glass flex-1 p-5 overflow-hidden flex flex-col">
        <MessageThread
          threadId={id}
          initialMessages={threadMessages}
        />
      </div>
    </div>
  )
}
