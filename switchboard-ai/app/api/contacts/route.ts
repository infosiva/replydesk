import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const businessId = process.env.BUSINESS_ID!
  const contacts = await db.contact.findMany({
    where: { businessId },
    include: {
      events: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contacts)
}
