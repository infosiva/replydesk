import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { proposals } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSignedUrl } from '@/lib/r2'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const [proposal] = await db.select({ pdf_url: proposals.pdf_url })
    .from(proposals).where(eq(proposals.id, id))

  if (!proposal?.pdf_url) return NextResponse.json({ error: 'PDF not available' }, { status: 404 })

  // If stored as r2://bucket/key, generate a signed URL
  const r2Match = proposal.pdf_url.match(/^r2:\/\/[^/]+\/(.+)$/)
  const signedUrl = r2Match
    ? await getSignedUrl(r2Match[1], 3600)
    : proposal.pdf_url

  return NextResponse.redirect(signedUrl, { status: 302 })
}
