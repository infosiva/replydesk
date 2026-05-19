'use client'

interface GoogleAuthButtonProps {
  label?: string
  redirectUrl?: string
  className?: string
  onSuccess?: (user: { email: string; name: string; picture?: string }) => void
}

/**
 * Google OAuth button — integrates with Next.js pages that have
 * /api/auth/google route (NextAuth or custom OAuth handler).
 * Drop-in: <GoogleAuthButton /> in any auth modal.
 */
export default function GoogleAuthButton({
  label = 'Continue with Google',
  redirectUrl,
  className,
}: GoogleAuthButtonProps) {
  function handleClick() {
    const callbackUrl = redirectUrl ?? window.location.href
    const url = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`
    window.location.href = url
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 16px',
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.15)',
        background: '#fff',
        color: '#3c4043',
        fontSize: '0.9375rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
    >
      {/* Google logo SVG */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
      </svg>
      {label}
    </button>
  )
}
