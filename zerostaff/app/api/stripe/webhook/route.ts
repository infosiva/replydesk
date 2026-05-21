import { NextRequest, NextResponse } from 'next/server'
import { getStripeInstance } from '@/lib/stripe'
import { createServiceRoleClient } from '@/lib/supabase-server'
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

  const supabase = createServiceRoleClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    if (!userId) return NextResponse.json({ ok: true })

    await supabase
      .from('users')
      .update({
        tier: 'pro',
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      })
      .eq('id', userId)
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    await supabase
      .from('users')
      .update({ tier: 'free' })
      .eq('stripe_subscription_id', subscription.id)
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const status = subscription.status
    if (status === 'active') {
      await supabase
        .from('users')
        .update({ tier: 'pro' })
        .eq('stripe_subscription_id', subscription.id)
    } else if (status === 'canceled' || status === 'unpaid') {
      await supabase
        .from('users')
        .update({ tier: 'free' })
        .eq('stripe_subscription_id', subscription.id)
    }
  }

  return NextResponse.json({ ok: true })
}
