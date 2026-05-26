import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { proposals } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [proposal] = await db.select({ id: proposals.id, status: proposals.status })
    .from(proposals).where(eq(proposals.id, id))

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (proposal.status === 'accepted') return NextResponse.json({ ok: true, already: true })

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  await db.update(proposals).set({
    status: 'accepted',
    accepted_at: new Date(),
    accepted_ip: ip,
  }).where(eq(proposals.id, id))

  return NextResponse.json({ ok: true })
}
