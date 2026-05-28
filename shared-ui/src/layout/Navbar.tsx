'use client'

/**
 * Navbar — glass sticky nav for all projects.
 * - Desktop: brand left, links right, optional CTA button
 * - Mobile: burger menu → full-width slide-down drawer
 * - Accent from CSS var(--accent) automatically via data-theme
 *
 * Usage:
 *   import { Navbar } from '@infosiva/shared-ui/layout/Navbar'
 *   <Navbar siteName="Kwizzo" icon="🎮" links={[{ label:'Features', href:'#features' }]} ctaLabel="Try free" ctaHref="/app" />
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export interface NavLink {
  label: string
  href: string
  external?: boolean
}

export interface NavbarProps {
  siteName: string
  /** Emoji or path to small icon */
  icon?: string
  /** Product word highlighted in accent color */
  accentWord?: string
  links?: NavLink[]
  ctaLabel?: string
  ctaHref?: string
  accentColor?: string
}

export function Navbar({
  siteName,
  icon,
  accentWord,
  links = [],
  ctaLabel,
  ctaHref = '/app',
  accentColor = 'var(--accent, #f59e0b)',
}: NavbarProps) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close drawer on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Render brand name with optional accent word highlighted
  const brandLabel = accentWord
    ? (
      <>
        {siteName.replace(accentWord, '')}
        <span style={{ color: accentColor }}>{accentWord}</span>
      </>
    )
    : <span style={{ color: accentColor }}>{siteName}</span>

  return (
    <>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 200,
          background: scrolled
            ? 'rgba(10,10,15,0.85)'
            : 'rgba(10,10,15,0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
          transition: 'background 0.3s, border-color 0.3s',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 20px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>}
            <span style={{
              fontWeight: 900,
              fontSize: 17,
              letterSpacing: '-0.02em',
              color: '#fff',
              lineHeight: 1,
            }}>
              {brandLabel}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" style={{
            display: 'none',
            alignItems: 'center',
            gap: 28,
          }} className="nav-desktop">
            {links.map(l => (
              <a
                key={l.href}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              >
                {l.label}
              </a>
            ))}
            {ctaLabel && (
              <a
                href={ctaHref}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: 'none',
                  color: '#fff',
                  background: accentColor,
                  boxShadow: `0 0 20px ${accentColor}44`,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}66` }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 0 20px ${accentColor}44` }}
              >
                {ctaLabel}
              </a>
            )}
          </nav>

          {/* Mobile burger */}
          <button
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            className="nav-burger"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              alignItems: 'flex-end',
            }}
          >
            <span style={{
              display: 'block', width: 22, height: 2, background: 'currentColor', borderRadius: 2,
              transform: open ? 'translateY(7px) rotate(45deg)' : '',
              transition: 'transform 0.2s ease',
            }} />
            <span style={{
              display: 'block', width: 16, height: 2, background: 'currentColor', borderRadius: 2,
              opacity: open ? 0 : 1,
              transition: 'opacity 0.15s',
            }} />
            <span style={{
              display: 'block', width: 22, height: 2, background: 'currentColor', borderRadius: 2,
              transform: open ? 'translateY(-7px) rotate(-45deg)' : '',
              transition: 'transform 0.2s ease',
            }} />
          </button>
        </div>

        {/* CSS for showing/hiding desktop vs burger */}
        <style>{`
          @media (min-width: 640px) {
            .nav-desktop { display: flex !important; }
            .nav-burger { display: none !important; }
          }
        `}</style>
      </header>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          top: 56,
          left: 0,
          right: 0,
          zIndex: 200,
          background: 'rgba(10,10,15,0.97)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          transform: open ? 'translateY(0)' : 'translateY(-8px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.22s cubic-bezier(0.23,1,0.32,1), opacity 0.18s',
        }}
        className="nav-drawer"
      >
        {links.map(l => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            target={l.external ? '_blank' : undefined}
            rel={l.external ? 'noopener noreferrer' : undefined}
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
              fontWeight: 500,
              textDecoration: 'none',
              padding: '12px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              transition: 'color 0.12s',
            }}
          >
            {l.label}
          </a>
        ))}
        {ctaLabel && (
          <a
            href={ctaHref}
            onClick={() => setOpen(false)}
            style={{
              display: 'block',
              marginTop: 12,
              padding: '13px 20px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: 'none',
              color: '#fff',
              background: accentColor,
              textAlign: 'center',
            }}
          >
            {ctaLabel}
          </a>
        )}

        {/* Hide drawer completely on desktop */}
        <style>{`
          @media (min-width: 640px) {
            .nav-drawer { display: none !important; }
          }
        `}</style>
      </div>
    </>
  )
}
