'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ContentBrief } from '@/lib/types'

const TONES = ['professional', 'casual', 'educational', 'persuasive'] as const

export default function BriefForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<ContentBrief>({
    brand: '',
    topic: '',
    audience: '',
    tone: 'professional',
    keywords: [],
  })
  const [keywordInput, setKeywordInput] = useState('')

  function addKeyword(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && keywordInput.trim()) {
      e.preventDefault()
      if (form.keywords.length < 8) {
        setForm(f => ({ ...f, keywords: [...f.keywords, keywordInput.trim()] }))
        setKeywordInput('')
      }
    }
  }

  function removeKeyword(kw: string) {
    setForm(f => ({ ...f, keywords: f.keywords.filter(k => k !== kw) }))
  }

  function canProceed() {
    if (step === 1) return form.brand.trim() && form.topic.trim()
    if (step === 2) return form.audience.trim()
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      router.push(`/dashboard/results/${data.briefId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className="flex-1 h-1 rounded-full transition-all"
            style={{ background: s <= step ? '#a855f7' : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="glass p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Tell us about your brand</h2>
              <p className="text-sm text-white/50">We'll tailor every asset to your brand voice.</p>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Brand / Company name</label>
              <input
                type="text"
                value={form.brand}
                onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Content topic</label>
              <input
                type="text"
                value={form.topic}
                onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
                placeholder="e.g. Why AI is transforming customer service in 2025"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="glass p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Who is your audience?</h2>
              <p className="text-sm text-white/50">Be specific — better audience = better copy.</p>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Target audience</label>
              <textarea
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                required
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition resize-none"
                placeholder="e.g. B2B SaaS founders and CTOs who manage support teams of 5-50 people"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Tone</label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tone: t }))}
                    className={`py-2 rounded-lg text-sm capitalize transition border ${
                      form.tone === t
                        ? 'border-purple-500/60 bg-purple-500/15 text-purple-300'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="glass p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Keywords (optional)</h2>
              <p className="text-sm text-white/50">SEO keywords to weave into the content.</p>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Add keywords <span className="text-white/30">(press Enter or comma)</span></label>
              <input
                type="text"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={addKeyword}
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
                placeholder="AI customer service, chatbot ROI…"
              />
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {form.keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 text-sm">
                      {kw}
                      <button type="button" onClick={() => removeKeyword(kw)} className="text-purple-400/60 hover:text-purple-300">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/8 pt-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Your brief summary</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2"><dt className="text-white/40 w-20">Brand</dt><dd className="text-white">{form.brand}</dd></div>
                <div className="flex gap-2"><dt className="text-white/40 w-20">Topic</dt><dd className="text-white">{form.topic}</dd></div>
                <div className="flex gap-2"><dt className="text-white/40 w-20">Audience</dt><dd className="text-white/80 line-clamp-2">{form.audience}</dd></div>
                <div className="flex gap-2"><dt className="text-white/40 w-20">Tone</dt><dd className="text-white capitalize">{form.tone}</dd></div>
              </dl>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="flex justify-between mt-5">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-sm btn-press"
              style={{ transition: 'border-color 200ms, color 200ms, transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
            >
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium btn-press"
              style={{ transition: 'background 200ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !form.brand || !form.topic || !form.audience}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium btn-press flex items-center gap-2"
              style={{ transition: 'background 200ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Generating 8 assets…
                </>
              ) : (
                '✨ Generate content'
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
