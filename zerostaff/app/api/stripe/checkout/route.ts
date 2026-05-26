import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const checkout = await createCheckoutSession(session.user.id, session.user.email!)
  return NextResponse.json({ url: checkout.url })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))

  const checkout = await createCheckoutSession(session.user.id, session.user.email!)
  return NextResponse.redirect(checkout.url!)
}
