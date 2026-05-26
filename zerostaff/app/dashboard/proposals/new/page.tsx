'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface LineItem {
  description: string
  quantity: string
  unit_price: string
}

export default function NewProposalPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    title: '',
    executive_summary: '',
    timeline_notes: '',
    billing_cadence: 'monthly' as 'one_off' | 'monthly' | 'quarterly',
  })
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: '1', unit_price: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function setField(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setItem(index: number, key: keyof LineItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  function addItem() {
    setItems(prev => [...prev, { description: '', quantity: '1', unit_price: '' }])
  }

  function removeItem(index: number) {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0
    const p = parseFloat(item.unit_price) || 0
    return sum + q * p
  }, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const parsedItems = items.map(item => ({
      description: item.description,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unit_price),
    }))

    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        executive_summary: form.executive_summary || undefined,
        timeline_notes: form.timeline_notes || undefined,
        items: parsedItems,
      }),
    })

    if (res.ok) {
      router.push('/dashboard/proposals')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create proposal')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/proposals" className="text-sm text-white/40 hover:text-white/70 transition">
          ← Proposals
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-6">New Proposal</h1>

      <form onSubmit={submit} className="space-y-6 max-w-2xl">
        {/* Client details */}
        <div className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Client</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Name</label>
              <input
                required
                value={form.client_name}
                onChange={e => setField('client_name', e.target.value)}
                placeholder="Acme Corp"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Email</label>
              <input
                required
                type="email"
                value={form.client_email}
                onChange={e => setField('client_email', e.target.value)}
                placeholder="client@example.com"
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Proposal title</label>
            <input
              required
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Content Marketing Package — Q3 2026"
              className="input-field"
            />
          </div>
        </div>

        {/* Services */}
        <div className="glass p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Services</h2>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                required
                value={item.description}
                onChange={e => setItem(i, 'description', e.target.value)}
                placeholder="Description"
                className="input-field flex-[3]"
              />
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={e => setItem(i, 'quantity', e.target.value)}
                placeholder="Qty"
                className="input-field flex-1"
              />
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={item.unit_price}
                onChange={e => setItem(i, 'unit_price', e.target.value)}
                placeholder="Price"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                className="px-2 py-2.5 text-white/30 hover:text-red-400 disabled:opacity-20 transition text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-purple-400 hover:text-purple-300 transition"
          >
            + Add line item
          </button>
          <div className="flex justify-end pt-1 border-t border-white/10">
            <span className="text-sm text-white/50 mr-2">Total:</span>
            <span className="text-sm font-semibold text-white">
              ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Details</h2>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Billing cadence</label>
            <select
              value={form.billing_cadence}
              onChange={e => setField('billing_cadence', e.target.value)}
              className="input-field"
            >
              <option value="monthly">Monthly retainer</option>
              <option value="quarterly">Quarterly billing</option>
              <option value="one_off">One-off payment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Executive summary (optional)</label>
            <textarea
              rows={3}
              value={form.executive_summary}
              onChange={e => setField('executive_summary', e.target.value)}
              placeholder="Brief overview of scope and goals..."
              className="input-field resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Timeline (optional)</label>
            <textarea
              rows={2}
              value={form.timeline_notes}
              onChange={e => setField('timeline_notes', e.target.value)}
              placeholder="Week 1: onboarding, Week 2-4: content production..."
              className="input-field resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
          >
            {submitting ? 'Creating...' : 'Create & Generate PDF'}
          </button>
          <Link
            href="/dashboard/proposals"
            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 text-sm rounded-xl transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
