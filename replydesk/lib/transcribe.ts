import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(recordingUrl: string): Promise<string> {
  const res = await fetch(recordingUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')}`,
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch recording: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const file = new File([buffer], 'call.mp3', { type: 'audio/mpeg' })
  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
  })
  return result.text
}
