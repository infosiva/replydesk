'use client'
import React, { useState } from 'react'
import { useAuth, AuthUser } from './useAuth'
import { useToast } from '../ui/useToast'

interface LoginFormProps {
  onSuccess: (user: AuthUser) => void
  accentColor?: string
}

export default function LoginForm({ onSuccess, accentColor = '#6366f1' }: LoginFormProps) {
  const { login, loading } = useAuth()
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isFormValid = email.length > 0 && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    const result = await login(email, password)
    if (result.success === false) {
      setSubmitError(result.error || 'Login failed')
    } else {
      const userStr = localStorage.getItem('auth_user')
      if (userStr) onSuccess(JSON.parse(userStr))
    }
  }

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    toast.info('Email recovery coming soon')
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={inputStyle}
          autoComplete="email"
        />
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
          <a
            href="#"
            onClick={handleForgotPassword}
            style={{ fontSize: 12, color: accentColor, textDecoration: 'none' }}
          >
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Your password"
          style={inputStyle}
          autoComplete="current-password"
        />
      </div>

      {submitError && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          padding: '10px 14px',
          color: '#b91c1c',
          fontSize: 14,
        }}>
          {submitError}
        </div>
      )}

      <button
        type="submit"
        disabled={!isFormValid || loading}
        style={{
          width: '100%',
          padding: '11px 0',
          border: 'none',
          borderRadius: 8,
          fontSize: 15,
          fontWeight: 600,
          color: '#fff',
          marginTop: 4,
          background: isFormValid && !loading ? accentColor : '#cbd5e1',
          cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
          transition: 'background 0.2s',
        }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
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
