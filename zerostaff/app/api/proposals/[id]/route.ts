import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { proposals, proposal_items } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [proposal] = await db.select({
    id: proposals.id,
    client_name: proposals.client_name,
    title: proposals.title,
    executive_summary: proposals.executive_summary,
    timeline_notes: proposals.timeline_notes,
    total_amount: proposals.total_amount,
    billing_cadence: proposals.billing_cadence,
    status: proposals.status,
    accepted_at: proposals.accepted_at,
    created_at: proposals.created_at,
  }).from(proposals).where(eq(proposals.id, id))

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await db.select({
    id: proposal_items.id,
    description: proposal_items.description,
    quantity: proposal_items.quantity,
    unit_price: proposal_items.unit_price,
    total: proposal_items.total,
  }).from(proposal_items).where(eq(proposal_items.proposal_id, id))

  return NextResponse.json({ proposal, items })
}
