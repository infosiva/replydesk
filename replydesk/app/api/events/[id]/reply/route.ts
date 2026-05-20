import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { message } = await req.json() as { message: string }

  const source = await db.contactEvent.findUniqueOrThrow({
    where: { id },
    include: { contact: true },
  })

  const businessId = process.env.BUSINESS_ID!
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  if (source.contact.phone && ['CALL_MISSED', 'CALL_INBOUND', 'SMS_INBOUND'].includes(source.type)) {
    await sendSMS(source.contact.phone, message)
  } else if (source.contact.email) {
    await sendEmail(source.contact.email, `Message from ${business.name}`, message, business.emailInbox)
  }

  const reply = await db.contactEvent.create({
    data: {
      contactId: source.contactId,
      type: 'HUMAN_REPLY',
      direction: 'OUTBOUND',
      raw: message,
      sentReply: message,
      claimedBy: 'human',
    },
  })

  return NextResponse.json(reply)
}
