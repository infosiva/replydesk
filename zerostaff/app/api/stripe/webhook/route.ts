import { NextRequest, NextResponse } from 'next/server'
import { getStripeInstance } from '@/lib/stripe'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  const stripe = getStripeInstance()
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    if (!userId) return NextResponse.json({ ok: true })

    await db.update(users).set({
      tier: 'pro',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
    }).where(eq(users.id, userId))
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await db.update(users).set({ tier: 'free' })
      .where(eq(users.stripe_subscription_id, subscription.id))
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const status = subscription.status
    if (status === 'active') {
      await db.update(users).set({ tier: 'pro' })
        .where(eq(users.stripe_subscription_id, subscription.id))
    } else if (status === 'canceled' || status === 'unpaid') {
      await db.update(users).set({ tier: 'free' })
        .where(eq(users.stripe_subscription_id, subscription.id))
    }
  }

  return NextResponse.json({ ok: true })
}
