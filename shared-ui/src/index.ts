// Auth (password-based — legacy)
export { useAuth } from './auth/useAuth'
export type { AuthUser, AuthState } from './auth/useAuth'
export { default as SignupForm } from './auth/SignupForm'
export { default as LoginForm } from './auth/LoginForm'
export { default as AuthModal } from './auth/AuthModal'

// Magic link auth (preferred)
export { useMagicAuth, sendMagicCode, verifyMagicCode, saveAuth, clearAuth, getStoredUser, isLoggedIn } from './auth/useMagicAuth'
export { default as MagicAuthModal } from './auth/MagicAuthModal'

// UI
export { default as CookieConsent } from './ui/CookieConsent'
export { default as ComplianceFooter } from './ui/ComplianceFooter'
export { default as FeedbackWidget } from './ui/FeedbackWidget'
export { default as RegisterGate } from './ui/RegisterGate'
export { useGate } from './ui/useGate'
export { default as Toast } from './ui/Toast'
export { useToast, ToastProvider } from './ui/useToast'
export { default as LoadingSpinner } from './ui/LoadingSpinner'
export { default as ProgressBar } from './ui/ProgressBar'

// Chat
export { default as ChatInterface } from './chat/ChatInterface'
export { default as ChatMessage } from './chat/ChatMessage'
export { default as TypingIndicator } from './chat/TypingIndicator'

// Layout
export { default as Footer } from './layout/Footer'
export { default as PageWrapper } from './layout/PageWrapper'

// Server-side helpers (import directly in route.ts files, not in client components)
// import { rateLimit, AI_LIMITER } from '@siva/shared-ui/lib/rateLimit'
// import { apiGuard } from '@siva/shared-ui/lib/apiGuard'
export type { GateFeature } from './ui/RegisterGate'
