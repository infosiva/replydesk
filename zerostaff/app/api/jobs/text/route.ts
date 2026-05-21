import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { createServiceRoleClient } from '@/lib/supabase-server'
import {
  generateBlogPost,
  generateLinkedInPosts,
  generateEmailSequence,
  generateShortClips,
  generateLeadGenPack,
  generateClientReport,
  generatePodcastEpisode,
  generateVideoStoryboard,
} from '@/lib/generate'
import { sendDeliveryEmail } from '@/lib/email'
import type { JobPayload } from '@/lib/queue'
import type { ContentBrief } from '@/lib/types'

export async function POST(request: NextRequest) {
  // Clone request for signature verification (body can only be read once)
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

  const { briefId, userId, tier } = payload
  const brief = payload.brief as ContentBrief

  const supabase = createServiceRoleClient()

  try {
    // Run all text generation in parallel based on tier
    const freeJobs = [
      generateBlogPost(brief),
      generateLinkedInPosts(brief),
    ]

    const proJobs = tier === 'free' ? [] : [
      generatePodcastEpisode(brief),
      generateVideoStoryboard(brief),
      generateEmailSequence(brief),
      generateShortClips(brief),
      generateLeadGenPack(brief),
      generateClientReport(brief),
    ]

    const [freeResults, proResults] = await Promise.all([
      Promise.allSettled(freeJobs),
      Promise.allSettled(proJobs),
    ])

    const [blogResult, linkedInResult] = freeResults
    const [podcastResult, videoResult, emailResult, clipsResult, leadGenResult, reportResult] = proResults

    const resultMap = {
      blog_post: blogResult?.status === 'fulfilled' ? blogResult.value : undefined,
      linked_in_posts: linkedInResult?.status === 'fulfilled' ? linkedInResult.value : undefined,
      podcast_episode: podcastResult?.status === 'fulfilled' ? podcastResult.value : undefined,
      video_storyboard: videoResult?.status === 'fulfilled' ? videoResult.value : undefined,
      email_sequence: emailResult?.status === 'fulfilled' ? emailResult.value : undefined,
      short_clips: clipsResult?.status === 'fulfilled' ? clipsResult.value : undefined,
      lead_gen_pack: leadGenResult?.status === 'fulfilled' ? leadGenResult.value : undefined,
      client_report: reportResult?.status === 'fulfilled' ? reportResult.value : undefined,
    }

    const assetInserts = Object.entries(resultMap)
      .filter(([, value]) => value !== undefined)
      .map(([type, content]) => ({ brief_id: briefId, type, content }))

    if (assetInserts.length > 0) {
      await supabase.from('assets').insert(assetInserts)
    }

    // Increment jobs_done and check if all done
    const { data: briefRow } = await supabase
      .from('briefs')
      .select('jobs_done, jobs_total, user_id')
      .eq('id', briefId)
      .single()

    const newDone = (briefRow?.jobs_done ?? 0) + 1
    const allDone = newDone >= (briefRow?.jobs_total ?? 1)

    await supabase
      .from('briefs')
      .update({ jobs_done: newDone, ...(allDone ? { status: 'complete' } : {}) })
      .eq('id', briefId)

    // Send delivery email if all text assets are done (first job to finish)
    if (assetInserts.length > 0) {
      const { data: userRow } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()

      if (userRow?.email) {
        await sendDeliveryEmail(userRow.email, briefId, assetInserts.map((a) => a.type))
      }
    }

    return NextResponse.json({ ok: true, assets: assetInserts.length })
  } catch (err) {
    console.error('Text job error:', err)
    await supabase.from('briefs').update({ status: 'error' }).eq('id', briefId)
    return NextResponse.json({ error: 'Text job failed' }, { status: 500 })
  }
}
