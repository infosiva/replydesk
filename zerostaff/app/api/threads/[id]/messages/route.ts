import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { threads, messages } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Body = z.object({ body: z.string().min(1).max(5000) })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: threadId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(messages)
    .where(eq(messages.thread_id, threadId))
    .orderBy(messages.created_at)

  return NextResponse.json({ messages: rows })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: threadId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [thread] = await db.select({ id: threads.id }).from(threads).where(eq(threads.id, threadId))
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const [msg] = await db.insert(messages).values({
    thread_id: threadId,
    sender_email: session.user.email!,
    direction: 'outbound',
    body: parsed.data.body,
  }).returning()

  if (!msg) return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })

  return NextResponse.json({ message: msg })
}
