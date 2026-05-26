import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assets, briefs, workspaces, revisions } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: assetId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership via join chain: asset → brief → workspace
  const [asset] = await db.select({ brief_id: assets.brief_id }).from(assets).where(eq(assets.id, assetId))
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [brief] = await db.select({ workspace_id: briefs.workspace_id }).from(briefs).where(eq(briefs.id, asset.brief_id))
  if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [workspace] = await db.select({ owner_id: workspaces.owner_id }).from(workspaces).where(eq(workspaces.id, brief.workspace_id))
  if (workspace?.owner_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const existingRevisions = await db.select({ id: revisions.id, round: revisions.round })
    .from(revisions).where(eq(revisions.asset_id, assetId))
    .orderBy(revisions.round)

  const latest = existingRevisions[existingRevisions.length - 1]

  if (latest) {
    await db.update(revisions).set({ status: 'approved' }).where(eq(revisions.id, latest.id))
  } else {
    await db.insert(revisions).values({ asset_id: assetId, round: 1, status: 'approved' })
  }

  await db.update(assets).set({ approved_at: new Date() }).where(eq(assets.id, assetId))

  return NextResponse.json({ ok: true })
}
