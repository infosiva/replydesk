import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

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

  // Extract thread ID from the To address (thread-{id}@domain)
  const to = (body.to as string) ?? ''
  const match = to.match(/thread-([0-9a-f-]+)@/)
  if (!match) {
    // Not a thread reply — ignore
    return NextResponse.json({ ok: true })
  }

  const threadId = match[1]
  const from = (body.from as string) ?? 'unknown'
  const text = ((body.text ?? body.html ?? '') as string).slice(0, 10_000)

  const supabase = createServiceRoleClient()

  // Verify thread exists
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) {
    return NextResponse.json({ ok: true }) // silently ignore unknown threads
  }

  await supabase.from('messages').insert({
    thread_id: threadId,
    sender: from,
    body: text.trim(),
  })

  return NextResponse.json({ ok: true })
}
