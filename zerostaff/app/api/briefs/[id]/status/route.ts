import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { briefs, assets } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [brief] = await db.select({
    jobs_done: briefs.jobs_done,
    jobs_total: briefs.jobs_total,
    status: briefs.status,
  }).from(briefs).where(eq(briefs.id, id))

  if (!brief) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const assetRows = await db.select({ type: assets.type })
    .from(assets)
    .where(eq(assets.brief_id, id))

  return NextResponse.json({
    jobs_done: brief.jobs_done,
    jobs_total: brief.jobs_total,
    status: brief.status,
    asset_types: assetRows.map(a => a.type),
  })
}
