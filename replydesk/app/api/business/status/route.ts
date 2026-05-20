import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { status } = await req.json() as { status: 'OPEN' | 'CLOSED' }
  const businessId = process.env.BUSINESS_ID!
  const business = await db.business.update({
    where: { id: businessId },
    data: { officeStatus: status },
    select: { id: true, officeStatus: true },
  })
  return NextResponse.json(business)
}
