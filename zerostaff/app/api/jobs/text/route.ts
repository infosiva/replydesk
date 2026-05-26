import { NextRequest, NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/queue'
import { db } from '@/lib/db'
import { assets, briefs, users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
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

  try {
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
      await db.insert(assets).values(assetInserts)
    }

    const [briefRow] = await db.select({ jobs_done: briefs.jobs_done, jobs_total: briefs.jobs_total, user_id: briefs.user_id })
      .from(briefs).where(eq(briefs.id, briefId))

    const newDone = (briefRow?.jobs_done ?? 0) + 1
    const allDone = newDone >= (briefRow?.jobs_total ?? 1)

    await db.update(briefs).set({
      jobs_done: newDone,
      ...(allDone ? { status: 'complete' } : {}),
    }).where(eq(briefs.id, briefId))

    if (assetInserts.length > 0) {
      const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId))
      if (userRow?.email) {
        await sendDeliveryEmail(userRow.email, briefId, assetInserts.map((a) => a.type))
      }
    }

    return NextResponse.json({ ok: true, assets: assetInserts.length })
  } catch (err) {
    console.error('Text job error:', err)
    await db.update(briefs).set({ status: 'error' }).where(eq(briefs.id, briefId))
    return NextResponse.json({ error: 'Text job failed' }, { status: 500 })
  }
}
