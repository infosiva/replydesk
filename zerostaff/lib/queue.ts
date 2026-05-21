import { Client, Receiver } from '@upstash/qstash'
import { NextRequest } from 'next/server'

let _client: Client | null = null

function getClient(): Client {
  if (!_client) {
    if (!process.env.QSTASH_TOKEN) throw new Error('QSTASH_TOKEN not set')
    _client = new Client({ token: process.env.QSTASH_TOKEN })
  }
  return _client
}

export type JobType = 'text' | 'audio' | 'video'

export interface JobPayload {
  briefId: string
  userId: string
  tier: 'free' | 'pro' | 'agency'
  brief: {
    brand: string
    topic: string
    audience: string
    tone: string
    keywords: string[]
  }
}

export async function enqueueJob(type: JobType, payload: JobPayload): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const destination = `${baseUrl}/api/jobs/${type}`

  const res = await getClient().publishJSON({
    url: destination,
    body: payload,
    retries: 3,
  })

  return res.messageId
}

export async function verifyQStashSignature(req: NextRequest): Promise<void> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (!currentSigningKey || !nextSigningKey) {
    // In dev without QStash keys, skip verification
    if (process.env.NODE_ENV === 'development') return
    throw new Error('QStash signing keys not configured')
  }

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  })

  const signature = req.headers.get('upstash-signature') ?? ''
  const body = await req.text()

  const isValid = await receiver.verify({
    signature,
    body,
  })

  if (!isValid) throw new Error('Invalid QStash signature')
}
