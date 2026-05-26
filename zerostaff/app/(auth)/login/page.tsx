'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const searchParams = useSearchParams()
  const verify = searchParams.get('verify')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('resend', { email, redirect: false })
    if (result?.error) {
      setError('Failed to send magic link. Please try again.')
      setLoading(false)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#080712' }}>
      <div className="mesh-bg" />
      <div className="glass w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            {sent || verify ? 'Check your email' : 'Sign in to ZeroStaff'}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            {sent || verify
              ? 'We sent you a magic link. Click it to sign in.'
              : 'Enter your email and we\'ll send you a magic link'}
          </p>
        </div>

        {!sent && !verify ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 transition"
                placeholder="you@example.com"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium transition"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-white/50">
              Didn&apos;t get it?{' '}
              <button
                onClick={() => { setSent(false) }}
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Try again
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
