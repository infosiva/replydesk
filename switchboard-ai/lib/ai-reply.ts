import { db } from '@/lib/db'
import { aiChat } from '@/lib/ai'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'

type Business = { id: string; name: string; emailInbox: string; officeStatus: string; systemPrompt: string }
type Contact  = { id: string; businessId: string; phone: string | null; email: string | null; name: string | null; createdAt: Date }

export async function triggerAIReply(
  eventId: string,
  contact: Contact,
  business: Business
): Promise<void> {
  const event = await db.contactEvent.findUniqueOrThrow({ where: { id: eventId } })

  const history = await db.contactEvent.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const historyText = history.map((e: { type: string; raw: string }) => `[${e.type}] ${e.raw}`).join('\n')

  const systemPrompt = `You are the AI front desk for ${business.name}.
Business context: ${business.systemPrompt}
Office is currently CLOSED.
Keep replies warm, concise, under 3 sentences.
Never invent appointment times or prices not in the business context.`

  const userMessage = `Customer history (most recent first):
${historyText}

Latest: ${event.raw}

${event.type === 'CALL_MISSED'
    ? 'Write a short SMS to the customer who just called and got no answer.'
    : 'Write a short email reply to the customer.'}`

  const reply = await aiChat([{ role: 'user', content: userMessage }], systemPrompt)

  if (event.type === 'CALL_MISSED' && contact.phone) {
    await sendSMS(contact.phone, reply)
  } else if (event.type === 'EMAIL_INBOUND' && contact.email) {
    await sendEmail(
      contact.email,
      `Re: your message to ${business.name}`,
      reply,
      business.emailInbox
    )
  }

  await db.contactEvent.create({
    data: {
      contactId: contact.id,
      type: 'AI_REPLY',
      direction: 'OUTBOUND',
      raw: reply,
      sentReply: reply,
    },
  })
}
