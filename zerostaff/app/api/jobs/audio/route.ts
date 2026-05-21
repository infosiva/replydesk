import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
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

  const supabase = createServiceRoleClient()

  try {
    // Generate podcast script via Groq
    const podcast = await generatePodcastEpisode(brief)

    // Convert script to audio via ElevenLabs
    const audioBuffer = await scriptToAudio(podcast.script)

    // Upload to R2
    const key = `briefs/${briefId}/podcast.mp3`
    const fileUrl = await uploadToR2(audioBuffer, key, 'audio/mpeg')

    // Save asset with file metadata
    await supabase.from('assets').insert({
      brief_id: briefId,
      type: 'podcast_audio',
      content: { title: podcast.title, showNotes: podcast.showNotes, promoPulls: podcast.promoPulls },
      file_url: fileUrl,
      file_size_bytes: audioBuffer.byteLength,
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
    console.error('Audio job error:', err)
    return NextResponse.json({ error: 'Audio job failed' }, { status: 500 })
  }
}
