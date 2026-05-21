import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await createCheckoutSession(user.id, user.email!)
  return NextResponse.json({ url: session.url })
}

// GET redirect for direct link usage
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

  const session = await createCheckoutSession(user.id, user.email!)
  return NextResponse.redirect(session.url!)
}
