import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { threads, messages } from '@/lib/schema'
import { eq } from 'drizzle-orm'

// Resend inbound email webhook
// Configure at resend.com/inbound — set webhook URL to /api/email/inbound
// Reply-To pattern: thread-{threadId}@mail.zerostaff.app

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const to = (body.to as string) ?? ''
  const match = to.match(/thread-([0-9a-f-]+)@/)
  if (!match) return NextResponse.json({ ok: true })

  const threadId = match[1]
  const from = (body.from as string) ?? 'unknown'
  const text = ((body.text ?? body.html ?? '') as string).slice(0, 10_000)

  const [thread] = await db.select({ id: threads.id }).from(threads).where(eq(threads.id, threadId))
  if (!thread) return NextResponse.json({ ok: true })

  await db.insert(messages).values({
    thread_id: threadId,
    sender_email: from,
    direction: 'inbound',
    body: text.trim(),
  })

  return NextResponse.json({ ok: true })
}
