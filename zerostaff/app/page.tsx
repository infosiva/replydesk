import Link from 'next/link'

const outputs = [
  { icon: '📝', label: 'SEO Blog', sub: '1,200 words' },
  { icon: '🎙️', label: 'Podcast Script', sub: 'TTS-ready MP3' },
  { icon: '🎬', label: 'Video Script', sub: 'fal.ai scenes' },
  { icon: '💼', label: 'LinkedIn Posts', sub: '3 angles' },
  { icon: '✉️', label: 'Email Sequence', sub: '5-email nurture' },
  { icon: '✂️', label: 'Short Clips', sub: '10 captions' },
  { icon: '🎯', label: 'Lead Gen Pack', sub: 'DMs + cold email' },
  { icon: '📊', label: 'Client Report', sub: 'Strategy + calendar' },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#080712', minHeight: '100vh', color: '#f8fafc' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06]" style={{ background: 'rgba(8,7,18,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-lg font-bold text-white">Zero<span className="text-purple-400">Staff</span></span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 hover:text-white transition">Sign in</Link>
            <Link href="/signup" className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/8 text-purple-300 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          AI Automation Agency OS
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
          One brief in.<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a855f7, #f97316)' }}>
            8 assets out.
          </span>
        </h1>
        <p className="text-lg text-white/60 max-w-xl mx-auto mb-10">
          Blog post. Podcast script. Faceless video. LinkedIn posts. Email sequence. Lead gen pack.
          Zero employees. Full agency in 60 seconds.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-base transition"
          >
            Generate your first brief — free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-white/70 hover:text-white font-medium text-base transition"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-white/30">2 free briefs/month · No credit card</p>
      </section>

      {/* 8 Outputs Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <p className="text-center text-sm text-white/40 uppercase tracking-widest mb-8">Every brief generates</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {outputs.map(({ icon, label, sub }) => (
            <div key={label} className="glass p-4 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-xs text-white/40 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-4 pb-24">
        <p className="text-center text-sm text-white/40 uppercase tracking-widest mb-8">Pricing</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { tier: 'Free', price: '$0', sub: '2 briefs/mo', features: ['Blog post', 'LinkedIn posts', 'Watermarked report'], color: 'white/5', border: 'white/8' },
            { tier: 'Pro', price: '$99', sub: '20 briefs/mo', features: ['All 8 outputs', 'Podcast + video scripts', 'Email sequence', 'Lead gen pack', 'Client portal'], color: 'purple-500/6', border: 'purple-500/30', highlight: true },
            { tier: 'Agency', price: '$199', sub: 'Unlimited', features: ['Everything in Pro', 'White-label portal', 'Sub-accounts', 'API access', 'Custom domain'], color: 'emerald-500/6', border: 'emerald-500/30' },
          ].map(({ tier, price, sub, features, color, border, highlight }) => (
            <div key={tier} className="rounded-2xl p-6 border" style={{ background: `rgba(255,255,255,0.02)`, borderColor: `rgba(255,255,255,0.08)` }}
              data-highlight={highlight}>
              <div className="text-xs font-bold uppercase tracking-widest text-white/50 mb-2">{tier}</div>
              <div className="text-3xl font-extrabold text-white mb-0.5">{price}<span className="text-base font-normal text-white/40">/mo</span></div>
              <div className="text-xs text-white/40 mb-5">{sub}</div>
              <ul className="space-y-1.5">
                {features.map(f => (
                  <li key={f} className="text-sm text-white/70 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition ${
                  highlight
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'border border-white/10 hover:border-white/20 text-white/70 hover:text-white'
                }`}
              >
                {tier === 'Free' ? 'Start free' : `Get ${tier}`}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
