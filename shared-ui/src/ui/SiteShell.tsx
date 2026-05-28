'use client'

/**
 * SiteShell — centrally managed layout wrapper for all portfolio sites.
 *
 * Replaces per-project aurora/grain/feedback/chatbot/navbar/footer boilerplate.
 * Driven by EC flags — no code changes needed per site.
 *
 * Layout: sticky Navbar → [optional banner] → children → Footer
 * Floating layer: FeedbackWidget (bottom-left) + ChatBot (bottom-right) — never overlap.
 *
 * Usage in layout.tsx:
 *   import { SiteShell } from '@infosiva/shared-ui'
 *
 *   <SiteShell
 *     siteName="Kwizzo"
 *     icon="🎮"
 *     tagline="Quiz your family"
 *     accentColor="#7c3aed"
 *     flags={flags}
 *     navLinks={[{ label: 'Features', href: '#features' }]}
 *     navCtaLabel="Play free"
 *     chatbot={<ChatBot siteName="Kwizzo" ... />}
 *   >
 *     {children}
 *   </SiteShell>
 */

import React, { ReactNode } from 'react'
import { default as FeedbackWidget } from './FeedbackWidget'
import { Navbar } from '../layout/Navbar'
import type { NavLink } from '../layout/Navbar'
import Footer from '../layout/Footer'
import type { FooterColumn } from '../layout/Footer'

export interface SiteShellProps {
  children: ReactNode
  siteName: string
  /** Emoji icon for brand */
  icon?: string
  /** Short tagline for footer */
  tagline?: string
  /** Longer description for footer SEO/AdSense */
  description?: string
  /** Primary brand colour */
  accentColor?: string
  /** Secondary gradient colour */
  accentColor2?: string
  /** EC flags — controls which widgets render */
  flags?: {
    chatbot?: boolean
    feedback?: boolean
    banner?: boolean
  }
  /** Override feedback API endpoint. Default: /api/feedback */
  feedbackEndpoint?: string
  /**
   * Chatbot component — pass <ChatBot .../> JSX.
   * Rendered at bottom-right, offset from FeedbackWidget.
   */
  chatbot?: ReactNode
  /** Optional sticky banner text (shown when flags.banner=true) */
  bannerText?: ReactNode
  /** Navbar links */
  navLinks?: NavLink[]
  /** Navbar CTA label — e.g. "Try free" */
  navCtaLabel?: string
  /** Navbar CTA href — default: /app */
  navCtaHref?: string
  /** Footer product columns */
  footerColumns?: FooterColumn[]
  /** Extra CSS class on root div */
  className?: string
}

const CHATBOT_BOTTOM = 84    // height of chatbot trigger button + gap
const FEEDBACK_RIGHT_OFFSET = 84 // feedback sits left, chatbot sits right — no overlap

export function SiteShell({
  children,
  siteName,
  icon,
  tagline,
  description,
  accentColor  = 'var(--accent, #f59e0b)',
  accentColor2 = 'var(--accent-2, #ef4444)',
  flags,
  feedbackEndpoint = '/api/feedback',
  chatbot,
  bannerText,
  navLinks = [],
  navCtaLabel,
  navCtaHref,
  footerColumns = [],
  className = '',
}: SiteShellProps) {
  const showFeedback = flags?.feedback !== false
  const showChatbot  = flags?.chatbot  !== false && !!chatbot
  const showBanner   = flags?.banner   === true  && !!bannerText

  return (
    <div
      className={`site-shell ${className}`}
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {/* Background atmosphere */}
      <div className="aurora aurora-primary" aria-hidden />
      <div className="aurora aurora-secondary" aria-hidden />
      <div className="aurora aurora-third" aria-hidden />
      <div className="grain" aria-hidden />

      {/* Sticky navbar */}
      <Navbar
        siteName={siteName}
        icon={icon}
        links={navLinks}
        ctaLabel={navCtaLabel}
        ctaHref={navCtaHref}
        accentColor={typeof accentColor === 'string' ? accentColor : '#f59e0b'}
      />

      {/* Optional announcement banner */}
      {showBanner && (
        <div
          style={{
            background: accentColor,
            color: '#000',
            textAlign: 'center',
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 700,
            position: 'relative',
            zIndex: 60,
          }}
        >
          {bannerText}
        </div>
      )}

      {/* Page content — flex-grow fills space between navbar and footer */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* Footer */}
      <Footer
        siteName={siteName}
        icon={icon}
        tagline={tagline}
        description={description}
        columns={footerColumns}
        accentColor={typeof accentColor === 'string' ? accentColor : 'var(--accent)'}
      />

      {/* ─── Floating widgets ─────────────────────────────────── */}
      {/*
        Layout when both are visible:
          FeedbackWidget  → bottom-left  (position='left', bottom=24)
          ChatBot trigger → bottom-right (bottom=24)
        No overlap possible.

        When only feedback visible → bottom-right (default behavior).
        When only chatbot visible  → chatbot at bottom-right, no offset needed.
      */}

      {showFeedback && (
        <FeedbackWidget
          siteName={siteName}
          accentColor={typeof accentColor === 'string' ? accentColor : '#f59e0b'}
          accentColor2={typeof accentColor2 === 'string' ? accentColor2 : '#ef4444'}
          apiEndpoint={feedbackEndpoint}
          /* If chatbot also visible, push feedback to left so triggers don't overlap */
          position={showChatbot ? 'left' : 'right'}
          offset={24}
        />
      )}

      {showChatbot && chatbot}
    </div>
  )
}
