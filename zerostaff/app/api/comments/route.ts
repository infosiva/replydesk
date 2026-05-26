import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { comments } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const Schema = z.object({
  asset_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  revision_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const [comment] = await db.insert(comments).values({
    asset_id: parsed.data.asset_id,
    revision_id: parsed.data.revision_id ?? null,
    author_id: session.user.id,
    body: parsed.data.body,
  }).returning({ id: comments.id })

  if (!comment) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  return NextResponse.json({ id: comment.id })
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assetId = new URL(request.url).searchParams.get('asset_id')
  if (!assetId) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const rows = await db.select().from(comments)
    .where(eq(comments.asset_id, assetId))
    .orderBy(comments.created_at)

  return NextResponse.json({ comments: rows })
}
