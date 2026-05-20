import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await db.contactEvent.update({
    where: { id },
    data: { claimedBy: 'human' },
  })
  return NextResponse.json(event)
}
