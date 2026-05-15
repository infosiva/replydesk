'use client'
import { useState } from 'react'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <span className="font-display text-xl font-bold text-primary">PhotoRestore</span>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#how-it-works"
              className="text-text-secondary hover:text-primary text-sm font-medium transition-colors"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="text-text-secondary hover:text-primary text-sm font-medium transition-colors"
            >
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#upload"
              className="bg-accent text-white font-semibold rounded-full px-5 py-2 text-sm shadow-btn hover:bg-accent-dark transition-all duration-200 hover:-translate-y-0.5 hover:shadow-btn-hover"
            >
              Restore a Photo
            </a>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-primary"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border py-3 flex flex-col gap-3 animate-slideIn">
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="text-text-secondary hover:text-primary text-sm font-medium transition-colors px-1 py-1"
            >
              How it works
            </a>
            <a
              href="#pricing"
              onClick={() => setMenuOpen(false)}
              className="text-text-secondary hover:text-primary text-sm font-medium transition-colors px-1 py-1"
            >
              Pricing
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
