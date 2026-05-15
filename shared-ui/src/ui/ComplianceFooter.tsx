import Link from "next/link";

interface ComplianceFooterProps {
  siteName?: string;
  className?: string;
}

/**
 * Minimal AdSense-compliant footer with required policy links.
 * Drop into any project's layout.tsx or existing Footer component.
 * Usage: <ComplianceFooter siteName="MyApp" />
 */
export default function ComplianceFooter({ siteName, className = "" }: ComplianceFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer
      className={`w-full border-t border-white/5 py-6 px-4 mt-auto ${className}`}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
        <span>
          © {year} {siteName ?? "This site"}. All rights reserved.
        </span>
        <nav aria-label="Legal links" className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-white/60 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white/60 transition-colors">
            Terms of Service
          </Link>
          <Link href="/about" className="hover:text-white/60 transition-colors">
            About
          </Link>
          <Link href="/contact" className="hover:text-white/60 transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
