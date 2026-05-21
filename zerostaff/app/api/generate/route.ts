import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
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
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = BriefSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid brief', details: parsed.error.issues }, { status: 400 })

    const { brief } = parsed.data

    // Check tier + usage limit
    const { data: userData } = await supabase
      .from('users')
      .select('tier, briefs_used_this_month, briefs_reset_at')
      .eq('id', user.id)
      .single()

    const tier = (userData?.tier ?? 'free') as 'free' | 'pro' | 'agency'
    const used = userData?.briefs_used_this_month ?? 0
    const limit = tier === 'free' ? 2 : tier === 'pro' ? 20 : Infinity
    const resetAt = userData?.briefs_reset_at ? new Date(userData.briefs_reset_at) : new Date()
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    let currentUsed = used
    if (resetAt < monthAgo) {
      currentUsed = 0
      await supabase.from('users').update({ briefs_used_this_month: 0, briefs_reset_at: new Date().toISOString() }).eq('id', user.id)
    }

    if (currentUsed >= limit) {
      return NextResponse.json({ error: 'Monthly brief limit reached. Upgrade to Pro.' }, { status: 403 })
    }

    // Get or create workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Determine how many async jobs to enqueue
    const jobTypes: Array<'text' | 'audio' | 'video'> = ['text']
    if (tier === 'pro' || tier === 'agency') jobTypes.push('audio')
    if (tier === 'agency') jobTypes.push('video')

    // Create brief record with job count
    const { data: briefRecord, error: briefError } = await supabase
      .from('briefs')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        topic: brief.topic,
        brand: brief.brand,
        audience: brief.audience,
        tone: brief.tone,
        keywords: brief.keywords,
        status: 'processing',
        jobs_total: jobTypes.length,
        jobs_done: 0,
      })
      .select('id')
      .single()

    if (briefError || !briefRecord) {
      return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 })
    }

    // Increment usage
    await supabase
      .from('users')
      .update({ briefs_used_this_month: currentUsed + 1 })
      .eq('id', user.id)

    // Enqueue async jobs
    const jobPayload = { briefId: briefRecord.id, userId: user.id, tier, brief }
    await Promise.all(jobTypes.map((type) => enqueueJob(type, jobPayload)))

    return NextResponse.json({ briefId: briefRecord.id, queued: true, jobs: jobTypes })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
