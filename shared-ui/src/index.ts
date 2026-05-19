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

// Motion primitives (Framer Motion wrappers)
export { ease, FadeIn, SlideUp, SlideIn, ScaleIn, StaggerList, AnimatedModal, PageTransition, HoverCard, PressButton, ParallaxSection, TabIndicator, CountUp, AnimatedBackground, ImageRotator } from './motion'
export { motion, AnimatePresence, useInView, useScroll, useTransform } from './motion'

// Smart chatbot
export { SmartChat, FloatingChat } from './chat/SmartChat'
export type { ChatMessage as SmartChatMessage, SmartChatProps, FloatingChatProps } from './chat/SmartChat'

// Animated hero sections
export { AnimatedHero, SocialProofBar } from './ui/AnimatedHero'
export type { AnimatedHeroProps } from './ui/AnimatedHero'

// AI media generation hooks (call from API routes — server-side)
// import { generateImage } from '@siva/shared-ui/lib/image-gen'
// import { generateVideo } from '@siva/shared-ui/lib/video-gen'

// Client-side hooks (call API routes you create in your app)
export { useGeneratedImage } from './hooks/useGeneratedImage'
export { useGeneratedVideo } from './hooks/useGeneratedVideo'

// Server-side helpers (import directly in route.ts files, not in client components)
// import { rateLimit, AI_LIMITER } from '@siva/shared-ui/lib/rateLimit'
// import { apiGuard } from '@siva/shared-ui/lib/apiGuard'
export type { GateFeature } from './ui/RegisterGate'

// Floating chatbot widget (reusable across all projects)
export { default as ChatBot } from './components/ChatBot'
export type { ChatBotProps } from './components/ChatBot'

// Google OAuth
export { default as GoogleAuthButton } from './auth/GoogleAuthButton'

// Affiliate tracking
export { useAffiliateTracker, getAffiliateRef, clearAffiliateRef, AffiliateTracker } from './auth/useAffiliate'

// Auth shell (provider-agnostic — wire to Clerk/Supabase/NextAuth/custom)
export { default as SignInModal } from './auth/SignInModal'
export type { AuthProvider } from './auth/SignInModal'
export { useCurrentUser, registerAuthAdapter } from './auth/useCurrentUser'
export type { CurrentUser } from './auth/useCurrentUser'

// AI chat primitives (Perplexity-style streaming + citations + follow-ups)
export { default as StreamingMessage } from './chat/StreamingMessage'
export type { Citation } from './chat/StreamingMessage'
export { default as FollowUpChips } from './chat/FollowUpChips'
export { default as ProgressStepper } from './chat/ProgressStepper'
export type { Step, StepStatus } from './chat/ProgressStepper'

// AI caching (model-layer KV cache — wraps any AI SDK call)
export { createAICache, createMemoryStore } from './lib/ai-cache'
export type { KVStore, AICacheOptions } from './lib/ai-cache'

// Layout system
export { LAYOUT_PRESETS, PROJECT_LAYOUTS } from './layout/layouts'
export type { LayoutKey, LayoutConfig } from './layout/layouts'

// Voice + Interview UI primitives (reusable across aicoachlab, tutiq, quizbytes)
export { VoiceWave } from './components/VoiceWave'
export { TypingIndicator as VoiceTypingIndicator } from './components/TypingIndicator'
export { ScoreCounter } from './components/ScoreCounter'
export { MicButton } from './components/MicButton'
export { useVoiceRecognition } from './hooks/useVoiceRecognition'
