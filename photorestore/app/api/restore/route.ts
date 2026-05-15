import { NextRequest, NextResponse } from 'next/server'
import { restorePhoto } from '@/lib/restore'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const bytes = await image.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = image.type || 'image/jpeg'

    const { buffer: restoredBuffer, provider } = await restorePhoto(buffer, mimeType)

    // Return as base64 data URI — no external URL needed
    const base64 = restoredBuffer.toString('base64')
    const url = `data:image/jpeg;base64,${base64}`

    return NextResponse.json({ url, provider })
  } catch (error) {
    console.error('Restore error:', error)
    return NextResponse.json({ error: 'Restoration failed' }, { status: 500 })
  }
}
