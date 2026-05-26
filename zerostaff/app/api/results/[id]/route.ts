import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { briefs, assets, users } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [brief] = await db.select().from(briefs)
    .where(and(eq(briefs.id, id), eq(briefs.user_id, session.user.id)))

  if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const assetRows = await db.select().from(assets).where(eq(assets.brief_id, id))

  const [userRow] = await db.select({ tier: users.tier }).from(users)
    .where(eq(users.id, session.user.id))

  return NextResponse.json({
    brief,
    assets: assetRows,
    tier: userRow?.tier ?? 'free',
  })
}
