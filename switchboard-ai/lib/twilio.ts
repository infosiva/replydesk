import twilio from 'twilio'

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export async function sendSMS(to: string, body: string): Promise<void> {
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  })
}

export function twimlRecord(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Please leave a message after the beep and we will get back to you shortly.</Say>
  <Record maxLength="120" />
  <Say>Thank you. Goodbye.</Say>
</Response>`
}

export function twimlEmpty(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
}
