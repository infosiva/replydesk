import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { workspaces, proposals, proposal_items } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { generateProposalPdf } from '@/lib/pdf'
import { uploadToR2 } from '@/lib/r2'
import { z } from 'zod'
import type { DbProposal, DbProposalItem } from '@/lib/types'

const ItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
})

const CreateSchema = z.object({
  client_email: z.string().email(),
  client_name: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  executive_summary: z.string().max(2000).optional(),
  timeline_notes: z.string().max(1000).optional(),
  billing_cadence: z.enum(['one_off', 'monthly', 'quarterly']),
  items: z.array(ItemSchema).min(1).max(50),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = CreateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const [workspace] = await db.select({ id: workspaces.id }).from(workspaces)
    .where(eq(workspaces.owner_id, session.user.id))
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 403 })

  const total_amount = parsed.data.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  const [proposal] = await db.insert(proposals).values({
    workspace_id: workspace.id,
    client_email: parsed.data.client_email,
    client_name: parsed.data.client_name,
    title: parsed.data.title,
    executive_summary: parsed.data.executive_summary ?? null,
    timeline_notes: parsed.data.timeline_notes ?? null,
    total_amount: total_amount.toString(),
    billing_cadence: parsed.data.billing_cadence,
  }).returning()

  if (!proposal) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  const itemRows = await db.insert(proposal_items).values(
    parsed.data.items.map(i => ({
      proposal_id: proposal.id,
      description: i.description,
      quantity: i.quantity.toString(),
      unit_price: i.unit_price.toString(),
      total: (i.quantity * i.unit_price).toString(),
    }))
  ).returning()

  const origin = new URL(request.url).origin
  const acceptUrl = `${origin}/proposals/${proposal.id}`

  let pdfUrl: string | null = null
  try {
    const pdfBuffer = await generateProposalPdf(
      proposal as unknown as DbProposal,
      itemRows as unknown as DbProposalItem[],
      acceptUrl,
    )
    const pdfKey = `proposals/${proposal.id}/proposal.pdf`
    pdfUrl = await uploadToR2(pdfBuffer, pdfKey, 'application/pdf')
    await db.update(proposals).set({ pdf_url: pdfUrl }).where(eq(proposals.id, proposal.id))
  } catch {
    // PDF generation is non-fatal
  }

  return NextResponse.json({ id: proposal.id, pdf_url: pdfUrl })
}

export async function GET(_request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [workspace] = await db.select({ id: workspaces.id }).from(workspaces)
    .where(eq(workspaces.owner_id, session.user.id))

  if (!workspace) return NextResponse.json({ proposals: [] })

  const proposalRows = await db.select().from(proposals)
    .where(eq(proposals.workspace_id, workspace.id))
    .orderBy(proposals.created_at)

  return NextResponse.json({ proposals: proposalRows })
}
