import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { db } from '@/lib/db'
import { assets, briefs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateVideoStoryboard } from '@/lib/generate'
import { storyboardToVideo } from '@/lib/falai'
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
    // Generate storyboard via Groq
    const storyboard = await generateVideoStoryboard(brief)

    // Generate video via fal.ai Kling
    const videoBuffer = await storyboardToVideo(storyboard)

    // Upload to R2
    const key = `briefs/${briefId}/video.mp4`
    const fileUrl = await uploadToR2(videoBuffer, key, 'video/mp4')

    // Save asset with file metadata
    await db.insert(assets).values({
      brief_id: briefId,
      type: 'video_asset',
      content: {
        title: storyboard.title,
        scenes: storyboard.scenes,
        callToAction: storyboard.callToAction,
      },
      file_url: fileUrl,
      file_size_bytes: videoBuffer.byteLength,
    })

    // Increment jobs_done
    const [briefRow] = await db.select({ jobs_done: briefs.jobs_done, jobs_total: briefs.jobs_total })
      .from(briefs).where(eq(briefs.id, briefId))

    const newDone = (briefRow?.jobs_done ?? 0) + 1
    const allDone = newDone >= (briefRow?.jobs_total ?? 1)

    await db.update(briefs)
      .set({ jobs_done: newDone, ...(allDone ? { status: 'complete' } : {}) })
      .where(eq(briefs.id, briefId))

    return NextResponse.json({ ok: true, fileUrl })
  } catch (err) {
    console.error('Video job error:', err)
    return NextResponse.json({ error: 'Video job failed' }, { status: 500 })
  }
}
