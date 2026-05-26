'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const outputs = [
  { icon: '📝', label: 'SEO Blog', sub: '1,200 words', color: '#a855f7' },
  { icon: '🎙️', label: 'Podcast Script', sub: 'TTS-ready MP3', color: '#3b82f6' },
  { icon: '🎬', label: 'Video Script', sub: 'fal.ai scenes', color: '#ec4899' },
  { icon: '💼', label: 'LinkedIn Posts', sub: '3 angles', color: '#06b6d4' },
  { icon: '✉️', label: 'Email Sequence', sub: '5-email nurture', color: '#f97316' },
  { icon: '✂️', label: 'Short Clips', sub: '10 captions', color: '#10b981' },
  { icon: '🎯', label: 'Lead Gen Pack', sub: 'DMs + cold email', color: '#f59e0b' },
  { icon: '📊', label: 'Client Report', sub: 'Strategy + calendar', color: '#8b5cf6' },
]

const EASE = 'easeOut' as const

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

const stagger = {
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const cardVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } },
}

export default function LandingPage() {
  return (
    <div style={{ background: '#05040f', minHeight: '100vh', color: '#f8fafc' }}>
      {/* Animated aurora background */}
      <div className="aurora" />
      <div className="aurora-third" />
      <div className="grain" />
      <div className="grid-lines" />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(5,4,15,0.80)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="text-lg font-bold text-white"
          >
            Zero<span className="text-purple-400">Staff</span>
          </motion.span>
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex items-center gap-3"
          >
            <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors duration-200">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white btn-press"
              style={{ transition: 'background 200ms, transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
            >
              Start free
            </Link>
          </motion.div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-28 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/25 mb-10"
          style={{ background: 'rgba(168,85,247,0.08)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />
          <span className="text-purple-300 text-xs font-medium tracking-wide">AI Automation Agency OS</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.23, 1, 0.32, 1] }}
          className="text-6xl sm:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6"
        >
          One brief in.
          <br />
          <span className="grad-purple-orange">8 assets out.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="text-lg text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Blog post. Podcast script. Faceless video. LinkedIn posts. Email sequence.
          Lead gen pack. <strong className="text-white/80 font-medium">Zero employees.</strong> Full agency in 60 seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32, ease: [0.23, 1, 0.32, 1] }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Link
            href="/signup"
            className="relative px-8 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-base btn-press glow-border overflow-hidden"
            style={{ transition: 'background 200ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
          >
            <span className="shimmer absolute inset-0 rounded-xl" />
            <span className="relative">Generate your first brief — free</span>
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-medium text-base btn-press"
            style={{ transition: 'border-color 200ms, color 200ms, transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
          >
            Sign in
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-4 text-xs text-white/25"
        >
          2 free briefs/month · No credit card
        </motion.p>
      </section>

      {/* 8 Outputs Grid */}
      <section className="max-w-5xl mx-auto px-4 pb-28">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
          className="text-center text-xs text-white/30 uppercase tracking-[0.2em] mb-10"
        >
          Every brief generates
        </motion.p>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {outputs.map(({ icon, label, sub, color }) => (
            <motion.div
              key={label}
              variants={cardVariant}
              className="glass glass-hover p-5 text-center cursor-default"
              style={{ '--accent': color } as React.CSSProperties}
            >
              <div
                className="w-10 h-10 mx-auto mb-3 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${color}15`, border: `1px solid ${color}25` }}
              >
                {icon}
              </div>
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-xs text-white/35 mt-0.5">{sub}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 pb-28">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          className="text-center text-xs text-white/30 uppercase tracking-[0.2em] mb-12"
        >
          How it works
        </motion.p>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid sm:grid-cols-3 gap-6"
        >
          {[
            { step: '01', title: 'Fill one brief', desc: 'Topic, brand, audience, tone. 60 seconds of input.' },
            { step: '02', title: 'AI generates 8 assets', desc: 'Blog, podcast, video, LinkedIn, email, clips, leads, report — all at once.' },
            { step: '03', title: 'Download & publish', desc: 'Export everything. White-label client report included.' },
          ].map(({ step, title, desc }) => (
            <motion.div key={step} variants={fadeUp} className="glass p-6">
              <div className="text-xs font-bold text-purple-400/60 tracking-widest mb-3">{step}</div>
              <div className="text-base font-semibold text-white mb-2">{title}</div>
              <div className="text-sm text-white/40 leading-relaxed">{desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-4 pb-28">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          className="text-center text-xs text-white/30 uppercase tracking-[0.2em] mb-12"
        >
          Pricing
        </motion.p>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid sm:grid-cols-3 gap-4"
        >
          {[
            {
              tier: 'Free', price: '$0', sub: '2 briefs/mo',
              features: ['Blog post', 'LinkedIn posts', 'Watermarked report'],
              highlight: false,
            },
            {
              tier: 'Pro', price: '$99', sub: '20 briefs/mo',
              features: ['All 8 outputs', 'Podcast + video scripts', 'Email sequence', 'Lead gen pack', 'Client portal'],
              highlight: true,
            },
            {
              tier: 'Agency', price: '$199', sub: 'Unlimited',
              features: ['Everything in Pro', 'White-label portal', 'Sub-accounts', 'API access', 'Custom domain'],
              highlight: false,
            },
          ].map(({ tier, price, sub, features, highlight }) => (
            <motion.div
              key={tier}
              variants={cardVariant}
              className="rounded-2xl p-6 border relative overflow-hidden"
              style={{
                background: highlight ? 'rgba(168,85,247,0.07)' : 'rgba(255,255,255,0.02)',
                borderColor: highlight ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.07)',
              }}
            >
              {highlight && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/80 text-white tracking-wide">
                  POPULAR
                </div>
              )}
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">{tier}</div>
              <div className="text-3xl font-extrabold text-white mb-0.5">
                {price}<span className="text-base font-normal text-white/35">/mo</span>
              </div>
              <div className="text-xs text-white/35 mb-6">{sub}</div>
              <ul className="space-y-2 mb-6">
                {features.map(f => (
                  <li key={f} className="text-sm text-white/60 flex items-center gap-2">
                    <span className="text-emerald-400 text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block text-center py-2.5 rounded-lg text-sm font-medium btn-press ${
                  highlight
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'border border-white/10 hover:border-white/20 text-white/60 hover:text-white'
                }`}
                style={{ transition: 'background 200ms, color 200ms, border-color 200ms, transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
              >
                {tier === 'Free' ? 'Start free' : `Get ${tier}`}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Footer CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="max-w-2xl mx-auto px-4 pb-24 text-center"
      >
        <div className="glass p-10 rounded-3xl">
          <h2 className="text-3xl font-extrabold text-white mb-3">
            Run your agency.<br />
            <span className="grad-purple-orange">With zero staff.</span>
          </h2>
          <p className="text-sm text-white/40 mb-8">One brief. 8 content assets. Delivered in under 60 seconds.</p>
          <Link
            href="/signup"
            className="inline-block px-10 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold btn-press glow-border relative overflow-hidden"
            style={{ transition: 'background 200ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)' }}
          >
            <span className="shimmer absolute inset-0 rounded-xl" />
            <span className="relative">Get started free</span>
          </Link>
        </div>
      </motion.section>

      {/* Footer */}
      <div className="border-t border-white/[0.05] max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-white/30">Zero<span className="text-purple-400/50">Staff</span></span>
        <span className="text-xs text-white/20">© 2026 · AI Automation Agency OS</span>
      </div>
    </div>
  )
}
