'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'

interface ProposalItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface Proposal {
  id: string
  client_name: string
  title: string
  executive_summary: string | null
  timeline_notes: string | null
  total_amount: number
  billing_cadence: 'one_off' | 'monthly' | 'quarterly'
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  accepted_at: string | null
  created_at: string
}

const CADENCE_LABELS: Record<Proposal['billing_cadence'], string> = {
  one_off: 'One-off payment',
  monthly: 'Monthly retainer',
  quarterly: 'Quarterly billing',
}

function fmt(amount: number) {
  return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProposalView({ id }: { id: string }) {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [items, setItems] = useState<ProposalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    fetch(`/api/proposals/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setProposal(data.proposal)
        setItems(data.items)
        setAccepted(data.proposal.status === 'accepted')
        setLoading(false)
      })
  }, [id])

  async function accept() {
    setAccepting(true)
    const res = await fetch(`/api/proposals/${id}/accept`, { method: 'POST' })
    if (res.ok) setAccepted(true)
    setAccepting(false)
  }

  if (loading && !notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-purple-400 animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 text-lg">Proposal not found.</p>
        </div>
      </div>
    )
  }

  if (!proposal) return null

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-purple-400 font-semibold text-sm mb-1">ZeroStaff — AI Content Agency</p>
          <h1 className="text-3xl font-bold text-white">{proposal.title}</h1>
          <p className="text-white/50 mt-2 text-sm">Prepared for {proposal.client_name}</p>
        </div>

        {/* Executive summary */}
        {proposal.executive_summary && (
          <div className="glass p-5 mb-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Overview</h2>
            <p className="text-white/80 text-sm leading-relaxed">{proposal.executive_summary}</p>
          </div>
        )}

        {/* Services table */}
        <div className="glass p-5 mb-5">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Services</h2>
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 text-xs text-white/40 uppercase tracking-wider pb-2 border-b border-white/10">
              <span className="col-span-2">Description</span>
              <span className="text-right">Qty × Price</span>
              <span className="text-right">Total</span>
            </div>
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-4 gap-2 py-3 border-b border-white/5 text-sm">
                <span className="col-span-2 text-white/80">{item.description}</span>
                <span className="text-right text-white/50">{item.quantity} × {fmt(item.unit_price)}</span>
                <span className="text-right text-white font-medium">{fmt(item.total)}</span>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2 pt-4 text-sm font-semibold">
              <span className="col-span-3 text-right text-white/60">Total</span>
              <span className="text-right text-purple-400 text-base">{fmt(proposal.total_amount)}</span>
            </div>
            <p className="text-right text-xs text-white/30 pt-1">{CADENCE_LABELS[proposal.billing_cadence]}</p>
          </div>
        </div>

        {/* Timeline */}
        {proposal.timeline_notes && (
          <div className="glass p-5 mb-5">
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Timeline</h2>
            <p className="text-white/80 text-sm leading-relaxed">{proposal.timeline_notes}</p>
          </div>
        )}

        {/* Accept block */}
        <div className="glass p-6 border-purple-500/30">
          {accepted ? (
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                <span className="text-green-400 text-lg">✓</span>
              </div>
              <p className="text-green-400 font-semibold">Proposal Accepted</p>
              {proposal.accepted_at && (
                <p className="text-white/40 text-xs mt-1">{new Date(proposal.accepted_at).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-white font-semibold mb-2">Accept this Proposal</h2>
              <p className="text-white/50 text-sm mb-5">
                By clicking below, you agree to the terms outlined above. Your acceptance will be recorded with a timestamp.
              </p>
              <button
                onClick={accept}
                disabled={accepting}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition"
              >
                {accepting ? 'Processing...' : `Accept — ${fmt(proposal.total_amount)}`}
              </button>
            </div>
          )}
        </div>

        {/* PDF download */}
        <div className="text-center mt-5">
          <a
            href={`/api/proposals/${id}/pdf`}
            className="text-sm text-white/40 hover:text-white/70 transition underline underline-offset-2"
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ProposalView id={id} />
}
