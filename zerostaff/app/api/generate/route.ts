import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, workspaces, briefs } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { enqueueJob } from '@/lib/queue'
import { z } from 'zod'

const BriefSchema = z.object({
  brief: z.object({
    brand: z.string().min(1).max(100),
    topic: z.string().min(3).max(300),
    audience: z.string().min(5).max(500),
    tone: z.enum(['professional', 'casual', 'educational', 'persuasive']),
    keywords: z.array(z.string()).max(8).default([]),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const body = await request.json()
    const parsed = BriefSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid brief', details: parsed.error.issues }, { status: 400 })

    const { brief } = parsed.data

    const [userData] = await db.select({
      tier: users.tier,
      briefs_used_this_month: users.briefs_used_this_month,
      briefs_reset_at: users.briefs_reset_at,
    }).from(users).where(eq(users.id, userId))

    const tier = (userData?.tier ?? 'free') as 'free' | 'pro' | 'agency'
    const used = userData?.briefs_used_this_month ?? 0
    const limit = tier === 'free' ? 2 : tier === 'pro' ? 20 : Infinity
    const resetAt = userData?.briefs_reset_at ? new Date(userData.briefs_reset_at) : new Date()
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    let currentUsed = used
    if (resetAt < monthAgo) {
      currentUsed = 0
      await db.update(users).set({ briefs_used_this_month: 0, briefs_reset_at: new Date() }).where(eq(users.id, userId))
    }

    if (currentUsed >= limit) {
      return NextResponse.json({ error: 'Monthly brief limit reached. Upgrade to Pro.' }, { status: 403 })
    }

    const [workspace] = await db.select({ id: workspaces.id }).from(workspaces)
      .where(eq(workspaces.owner_id, userId))

    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const jobTypes: Array<'text' | 'audio' | 'video'> = ['text']
    if (tier === 'pro' || tier === 'agency') jobTypes.push('audio')
    if (tier === 'agency') jobTypes.push('video')

    const [briefRecord] = await db.insert(briefs).values({
      workspace_id: workspace.id,
      user_id: userId,
      topic: brief.topic,
      brand: brief.brand,
      audience: brief.audience,
      tone: brief.tone,
      keywords: brief.keywords,
      status: 'processing',
      jobs_total: jobTypes.length,
      jobs_done: 0,
    }).returning({ id: briefs.id })

    if (!briefRecord) {
      return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 })
    }

    await db.update(users).set({ briefs_used_this_month: currentUsed + 1 }).where(eq(users.id, userId))

    const jobPayload = { briefId: briefRecord.id, userId, tier, brief }
    await Promise.all(jobTypes.map((type) => enqueueJob(type, jobPayload)))

    return NextResponse.json({ briefId: briefRecord.id, queued: true, jobs: jobTypes })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
