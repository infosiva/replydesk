import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { z } from 'zod'

const Body = z.object({ body: z.string().min(1).max(5000) })

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: threadId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify thread belongs to this user's workspace
  const { data: thread } = await supabase
    .from('threads')
    .select('id')
    .eq('id', threadId)
    .single()

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const parsed = Body.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const service = createServiceRoleClient()
  const { data: msg, error } = await service
    .from('messages')
    .insert({ thread_id: threadId, sender: 'agent', body: parsed.data.body })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })

  return NextResponse.json({ message: msg })
}
