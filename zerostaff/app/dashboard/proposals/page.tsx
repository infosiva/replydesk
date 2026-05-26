import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { workspaces, proposals } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { DbProposal } from '@/lib/types'

const STATUS_STYLES: Record<DbProposal['status'], string> = {
  draft: 'bg-white/10 text-white/50',
  sent: 'bg-blue-500/15 text-blue-400',
  accepted: 'bg-green-500/15 text-green-400',
  declined: 'bg-red-500/15 text-red-400',
}

function fmt(amount: string | number) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

export default async function ProposalsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [workspace] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.owner_id, session.user.id))
    .limit(1)

  const proposalRows: DbProposal[] = workspace
    ? (await db
        .select()
        .from(proposals)
        .where(eq(proposals.workspace_id, workspace.id))
        .orderBy(desc(proposals.created_at))
      ) as DbProposal[]
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Proposals</h1>
          <p className="text-sm text-white/50 mt-1">Send quotes and track client acceptance</p>
        </div>
        <Link
          href="/dashboard/proposals/new"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition"
        >
          New Proposal
        </Link>
      </div>

      {proposalRows.length === 0 ? (
        <div className="glass p-12 text-center">
          <p className="text-white/40 mb-4">No proposals yet.</p>
          <Link href="/dashboard/proposals/new" className="text-sm text-purple-400 hover:text-purple-300 transition">
            Create your first proposal →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {proposalRows.map(p => (
            <div key={p.id} className="glass p-4 flex items-center justify-between glass-hover">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{p.client_name} · {p.client_email}</p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-sm font-semibold text-white">{fmt(p.total_amount)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[p.status]}`}>
                  {p.status}
                </span>
                <a
                  href={`/proposals/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/40 hover:text-white/70 transition"
                >
                  View ↗
                </a>
                {p.pdf_url && (
                  <a
                    href={`/api/proposals/${p.id}/pdf`}
                    className="text-xs text-white/40 hover:text-white/70 transition"
                  >
                    PDF ↓
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
