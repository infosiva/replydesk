import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
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

  const supabase = createServiceRoleClient()

  try {
    // Generate storyboard via Groq
    const storyboard = await generateVideoStoryboard(brief)

    // Generate video via fal.ai Kling
    const videoBuffer = await storyboardToVideo(storyboard)

    // Upload to R2
    const key = `briefs/${briefId}/video.mp4`
    const fileUrl = await uploadToR2(videoBuffer, key, 'video/mp4')

    // Save asset with file metadata
    await supabase.from('assets').insert({
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
    const { data: briefRow } = await supabase
      .from('briefs')
      .select('jobs_done, jobs_total')
      .eq('id', briefId)
      .single()

    const newDone = (briefRow?.jobs_done ?? 0) + 1
    const allDone = newDone >= (briefRow?.jobs_total ?? 1)

    await supabase
      .from('briefs')
      .update({ jobs_done: newDone, ...(allDone ? { status: 'complete' } : {}) })
      .eq('id', briefId)

    return NextResponse.json({ ok: true, fileUrl })
  } catch (err) {
    console.error('Video job error:', err)
    return NextResponse.json({ error: 'Video job failed' }, { status: 500 })
  }
}
