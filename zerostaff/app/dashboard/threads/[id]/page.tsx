import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import MessageThread from '@/components/MessageThread'
import Link from 'next/link'

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: thread } = await supabase
    .from('threads')
    .select('*, briefs(topic, brand)')
    .eq('id', id)
    .single()

  if (!thread) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', id)
    .order('created_at', { ascending: true })

  const brief = thread.briefs as { topic: string; brand: string } | null

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
          initialMessages={messages ?? []}
        />
      </div>
    </div>
  )
}
