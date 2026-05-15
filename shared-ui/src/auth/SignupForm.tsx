'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth, AuthUser } from './useAuth'

const AUTH_API = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3110'

const RESERVED = ['admin', 'root', 'system', 'api', 'null', 'undefined', 'support', 'help', 'mod', 'moderator', 'bot']

function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Username must be at least 3 characters'
  if (username.length > 20) return 'Username must be 20 characters or less'
  if (!/^[a-z0-9_]+$/.test(username)) return 'Only lowercase letters, numbers, and underscores'
  if (username.startsWith('_') || username.endsWith('_')) return 'Cannot start or end with underscore'
  if (username.includes('__')) return 'Cannot contain consecutive underscores'
  if (RESERVED.includes(username)) return 'This username is reserved'
  return null
}

function validatePassword(password: string): { valid: boolean; criteria: PasswordCriteria } {
  const criteria: PasswordCriteria = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  }
  return { valid: Object.values(criteria).every(Boolean), criteria }
}

interface PasswordCriteria {
  minLength: boolean
  uppercase: boolean
  number: boolean
  special: boolean
}

interface SignupFormProps {
  onSuccess: (user: AuthUser) => void
  site: string
  accentColor?: string
}

export default function SignupForm({ onSuccess, site, accentColor = '#6366f1' }: SignupFormProps) {
  const { signup, verifyOtp, resendOtp, loading } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false, uppercase: false, number: false, special: false,
  })
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // OTP step
  const [otpStep, setOtpStep] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Username validation + availability check
  useEffect(() => {
    const clientError = validateUsername(username)
    if (username.length === 0) {
      setUsernameError(null)
      setUsernameAvailable(null)
      setCheckingUsername(false)
      return
    }
    if (clientError) {
      setUsernameError(clientError)
      setUsernameAvailable(null)
      setCheckingUsername(false)
      return
    }
    setUsernameError(null)
    setCheckingUsername(true)
    setUsernameAvailable(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${AUTH_API}/check?username=${encodeURIComponent(username)}`)
        const data = await res.json()
        setUsernameAvailable(data.available === true)
        if (!data.available) setUsernameError('Username is already taken')
      } catch {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
  }, [username])

  // Password criteria
  useEffect(() => {
    if (password.length === 0) {
      setPasswordCriteria({ minLength: false, uppercase: false, number: false, special: false })
      return
    }
    const { criteria } = validatePassword(password)
    setPasswordCriteria(criteria)
  }, [password])

  // Email validation
  const handleEmailBlur = useCallback(() => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address')
    } else {
      setEmailError(null)
    }
  }, [email])

  // Confirm password
  useEffect(() => {
    if (confirmPassword && confirmPassword !== password) {
      setConfirmError('Passwords do not match')
    } else {
      setConfirmError(null)
    }
  }, [confirmPassword, password])

  const isFormValid =
    username.length > 0 &&
    !usernameError &&
    usernameAvailable === true &&
    !checkingUsername &&
    email.length > 0 &&
    !emailError &&
    Object.values(passwordCriteria).every(Boolean) &&
    confirmPassword === password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const result = await signup(username, email, password, site)
    if (result.success === false) {
      setSubmitError(result.error || 'Signup failed')
    } else if (result.otpSent) {
      setOtpEmail(result.email as string)
      setOtpStep(true)
      setResendCooldown(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } else {
      const userStr = localStorage.getItem('auth_user')
      if (userStr) onSuccess(JSON.parse(userStr))
    }
  }

  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[idx] = digit
    setOtpDigits(next)
    setOtpError(null)
    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      e.preventDefault()
      setOtpDigits(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = otpDigits.join('')
    if (code.length < 6) {
      setOtpError('Enter all 6 digits')
      return
    }
    setOtpError(null)
    const result = await verifyOtp(otpEmail, code)
    if (result.success === false) {
      setOtpError(result.error || 'Invalid code')
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } else {
      const userStr = localStorage.getItem('auth_user')
      if (userStr) onSuccess(JSON.parse(userStr))
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    await resendOtp(otpEmail)
    setResendCooldown(60)
    setOtpDigits(['', '', '', '', '', ''])
    setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }

  if (otpStep) {
    return (
      <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Check your email</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            We sent a 6-digit code to<br />
            <strong style={{ color: '#1e293b' }}>{otpEmail}</strong>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Expires in 10 minutes</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }} onPaste={handleOtpPaste}>
          {otpDigits.map((d, i) => (
            <input
              key={i}
              ref={el => { otpRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleOtpChange(i, e.target.value)}
              onKeyDown={e => handleOtpKeyDown(i, e)}
              style={{
                width: 46,
                height: 56,
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 700,
                border: `2px solid ${otpError ? '#ef4444' : d ? accentColor : '#e2e8f0'}`,
                borderRadius: 10,
                outline: 'none',
                color: '#1e293b',
                background: '#fff',
              }}
            />
          ))}
        </div>

        {otpError && <p style={{ margin: 0, fontSize: 13, color: '#ef4444' }}>{otpError}</p>}

        <button
          type="submit"
          disabled={loading || otpDigits.join('').length < 6}
          style={{
            ...buttonStyle,
            width: '100%',
            background: otpDigits.join('').length === 6 && !loading ? accentColor : '#cbd5e1',
            cursor: otpDigits.join('').length === 6 && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Verifying…' : 'Verify & continue'}
        </button>

        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Didn't get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{ background: 'none', border: 'none', padding: 0, cursor: resendCooldown > 0 ? 'default' : 'pointer', color: resendCooldown > 0 ? '#94a3b8' : accentColor, fontWeight: 600, fontSize: 13 }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
        </p>
      </form>
    )
  }

  const CriterionRow = ({ met, label }: { met: boolean; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: met ? '#16a34a' : '#94a3b8' }}>
      <span style={{ fontSize: 14 }}>{met ? '✓' : '○'}</span>
      {label}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Username */}
      <div>
        <label style={labelStyle}>Username</label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            placeholder="your_username"
            style={{
              ...inputStyle,
              borderColor: usernameError ? '#ef4444' : usernameAvailable ? '#16a34a' : '#e2e8f0',
              paddingRight: 36,
            }}
            autoComplete="username"
          />
          {checkingUsername && (
            <span style={inputIconStyle}>⏳</span>
          )}
          {!checkingUsername && username.length > 0 && !usernameError && usernameAvailable === true && (
            <span style={{ ...inputIconStyle, color: '#16a34a' }}>✓</span>
          )}
          {!checkingUsername && username.length > 0 && (usernameError || usernameAvailable === false) && (
            <span style={{ ...inputIconStyle, color: '#ef4444' }}>✗</span>
          )}
        </div>
        {usernameError && <p style={errorStyle}>{usernameError}</p>}
        {!usernameError && usernameAvailable === true && (
          <p style={{ ...errorStyle, color: '#16a34a' }}>Username is available</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="you@example.com"
          style={{ ...inputStyle, borderColor: emailError ? '#ef4444' : '#e2e8f0' }}
          autoComplete="email"
        />
        {emailError && <p style={errorStyle}>{emailError}</p>}
      </div>

      {/* Password */}
      <div>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Create a strong password"
          style={{ ...inputStyle }}
          autoComplete="new-password"
        />
        {password.length > 0 && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            <CriterionRow met={passwordCriteria.minLength} label="8+ characters" />
            <CriterionRow met={passwordCriteria.uppercase} label="Uppercase letter" />
            <CriterionRow met={passwordCriteria.number} label="Number" />
            <CriterionRow met={passwordCriteria.special} label="Special (!@#$%^&*)" />
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label style={labelStyle}>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
          style={{ ...inputStyle, borderColor: confirmError ? '#ef4444' : '#e2e8f0' }}
          autoComplete="new-password"
        />
        {confirmError && <p style={errorStyle}>{confirmError}</p>}
      </div>

      {submitError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 14 }}>
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || loading}
        style={{
          ...buttonStyle,
          background: isFormValid && !loading ? accentColor : '#cbd5e1',
          cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
        }}
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 8,
  fontSize: 14,
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
  background: '#fff',
  transition: 'border-color 0.15s',
}

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  right: 10,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 16,
  pointerEvents: 'none',
}

const errorStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: '#ef4444',
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 0',
  border: 'none',
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  transition: 'background 0.2s',
  marginTop: 4,
}
