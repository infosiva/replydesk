import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  from: string
): Promise<void> {
  await sgMail.send({ to, from: process.env.SENDGRID_FROM_EMAIL ?? from, subject, text })
}
