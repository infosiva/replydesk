import Link from 'next/link'

export interface FooterLink {
  label: string
  href: string
  external?: boolean
}

export interface FooterColumn {
  heading: string
  links: FooterLink[]
}

export interface FooterProps {
  siteName: string
  tagline?: string
  /** Short product description — shows below brand on desktop (good for AdSense content signals) */
  description?: string
  icon?: string
  /** Extra nav columns — e.g. [{ heading: 'Product', links: [...] }] */
  columns?: FooterColumn[]
  /** Extra flat links alongside compliance links */
  extraLinks?: FooterLink[]
  accentColor?: string
  className?: string
}

/**
 * Upgraded canonical dark glass footer.
 * - Column layout for richer content (AdSense friendly)
 * - Product description for SEO + context
 * - Compliance links always present
 * - Responsive: 1 col mobile → multi-col desktop
 *
 * Usage:
 *   <Footer
 *     siteName="ResumeVault"
 *     icon="📄"
 *     tagline="ATS-optimised resumes, free."
 *     description="Build, scan, and export ATS-ready resumes powered by AI. No account required for your first 3 exports."
 *     columns={[
 *       { heading: 'Product', links: [{ label: 'Resume Builder', href: '/builder' }, { label: 'ATS Scanner', href: '/scanner' }] },
 *       { heading: 'Resources', links: [{ label: 'Blog', href: '/blog' }, { label: 'Templates', href: '/templates' }] },
 *     ]}
 *   />
 */
export default function Footer({
  siteName,
  tagline,
  description,
  icon,
  columns = [],
  extraLinks = [],
  accentColor = 'var(--accent, #f59e0b)',
  className = '',
}: FooterProps) {
  const year = new Date().getFullYear()

  const complianceLinks: FooterLink[] = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ]

  const hasColumns = columns.length > 0

  return (
    <footer
      className={className}
      style={{
        width: '100%',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'transparent',
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 20px 28px' }}>

        {/* Main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasColumns
            ? `1fr ${columns.map(() => 'auto').join(' ')}`
            : '1fr',
          gap: '40px 60px',
          marginBottom: 40,
        }}>
          {/* Brand column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {icon && <span style={{ fontSize: 22 }}>{icon}</span>}
              <span style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.02em' }}>
                <span style={{ color: accentColor }}>{siteName}</span>
              </span>
            </div>
            {tagline && (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 8, fontStyle: 'italic' }}>
                {tagline}
              </p>
            )}
            {description && (
              <p style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 12.5,
                lineHeight: 1.7,
                maxWidth: 300,
                marginBottom: 16,
              }}>
                {description}
              </p>
            )}
            {/* Compliance links below brand on mobile */}
            <nav
              aria-label="Compliance"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}
            >
              {[...complianceLinks, ...extraLinks].map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  target={l.external ? '_blank' : undefined}
                  rel={l.external ? 'noopener noreferrer' : undefined}
                  style={{
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 12,
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                  className="footer-link"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Product columns */}
          {columns.map(col => (
            <div key={col.heading}>
              <h3 style={{
                color: 'rgba(255,255,255,0.25)',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 14,
              }}>
                {col.heading}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.links.map(l => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target={l.external ? '_blank' : undefined}
                      rel={l.external ? 'noopener noreferrer' : undefined}
                      style={{
                        color: 'rgba(255,255,255,0.45)',
                        fontSize: 13,
                        textDecoration: 'none',
                        transition: 'color 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                      className="footer-link"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11.5 }}>
            © {year} {siteName}. All rights reserved.
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.2)', fontSize: 11.5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
            Built with AI
          </span>
        </div>
      </div>

      <style>{`
        .footer-link:hover { color: rgba(255,255,255,0.65) !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        /* Responsive column layout */
        @media (max-width: 640px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </footer>
  )
}
