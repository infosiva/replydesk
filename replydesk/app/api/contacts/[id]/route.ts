import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await db.contact.findUniqueOrThrow({
    where: { id },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  })
  return NextResponse.json(contact)
}
