"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_KEY = "cookie_consent_v1";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-zinc-950/95 border-t border-white/10 backdrop-blur-sm"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 text-sm text-white/70">
          <p>
            We use cookies to improve your experience and show relevant ads via{" "}
            <strong className="text-white">Google AdSense</strong>. By clicking
            &ldquo;Accept&rdquo; you consent to our use of cookies.{" "}
            <Link href="/privacy" className="underline text-white/90">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/terms" className="underline text-white/90">
              Terms
            </Link>
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-xs rounded-lg border border-white/20 text-white/60 hover:border-white/40 hover:text-white/80 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-xs rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors"
          >
            Accept all cookies
          </button>
        </div>
      </div>
    </div>
  );
}
