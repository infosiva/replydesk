import Link from "next/link";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterProps {
  siteName: string;
  tagline?: string;
  icon?: string;
  /** Extra nav links alongside the always-present compliance links */
  extraLinks?: FooterLink[];
  className?: string;
}

/**
 * Canonical dark glass footer for all Siva projects.
 * Always includes: Privacy Policy, Terms, About, Contact.
 * Source of truth: shared-ui/src/layout/Footer.tsx
 * Usage: <Footer siteName="Kwizzo" icon="🎮" tagline="Quiz your family" />
 */
export default function Footer({
  siteName,
  tagline,
  icon,
  extraLinks = [],
  className = "",
}: FooterProps) {
  const year = new Date().getFullYear();

  const complianceLinks: FooterLink[] = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  const allLinks = [...complianceLinks, ...extraLinks];

  return (
    <footer className={`w-full border-t border-white/[0.06] bg-transparent mt-auto ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Brand + links row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            {(icon || siteName) && (
              <div className="flex items-center gap-2 mb-1.5">
                {icon && <span className="text-xl">{icon}</span>}
                <span className="font-bold text-white text-sm">{siteName}</span>
              </div>
            )}
            {tagline && (
              <p className="text-white/40 text-xs max-w-xs">{tagline}</p>
            )}
          </div>

          <nav aria-label="Footer navigation" className="flex flex-wrap items-center gap-4 text-xs text-white/40">
            {allLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white/70 transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <span>© {year} {siteName}. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Built with AI
          </span>
        </div>
      </div>
    </footer>
  );
}
