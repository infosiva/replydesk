import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { db } from '@/lib/db'
import { assets, briefs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generatePodcastEpisode } from '@/lib/generate'
import { scriptToAudio } from '@/lib/elevenlabs'
import { uploadToR2 } from '@/lib/r2'
import type { JobPayload } from '@/lib/queue'
import type { ContentBrief } from '@/lib/types'

export async function POST(request: NextRequest) {
  const clonedReq = request.clone()

  try {
    await verifyQStashSignature(clonedReq as NextRequest)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: JobPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { briefId } = payload
  const brief = payload.brief as ContentBrief

  try {
    const podcast = await generatePodcastEpisode(brief)
    const audioBuffer = await scriptToAudio(podcast.script)

    const key = `briefs/${briefId}/podcast.mp3`
    const fileUrl = await uploadToR2(audioBuffer, key, 'audio/mpeg')

    await db.insert(assets).values({
      brief_id: briefId,
      type: 'podcast_audio',
      content: { title: podcast.title, showNotes: podcast.showNotes, promoPulls: podcast.promoPulls },
      file_url: fileUrl,
      file_size_bytes: audioBuffer.byteLength,
    })

    const [briefRow] = await db.select({ jobs_done: briefs.jobs_done, jobs_total: briefs.jobs_total })
      .from(briefs).where(eq(briefs.id, briefId))

    const newDone = (briefRow?.jobs_done ?? 0) + 1
    const allDone = newDone >= (briefRow?.jobs_total ?? 1)

    await db.update(briefs).set({
      jobs_done: newDone,
      ...(allDone ? { status: 'complete' } : {}),
    }).where(eq(briefs.id, briefId))

    return NextResponse.json({ ok: true, fileUrl })
  } catch (err) {
    console.error('Audio job error:', err)
    return NextResponse.json({ error: 'Audio job failed' }, { status: 500 })
  }
}
