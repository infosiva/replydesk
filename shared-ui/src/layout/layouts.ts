/**
 * Layout presets — each project picks one.
 * Import the layout components from ./SidebarLayout, ./TopNavLayout, etc.
 * Switch by changing the layout key in your app/layout.tsx.
 */

export type LayoutKey =
  | 'topnav'       // Full-width top nav, no sidebar (landing pages, marketing)
  | 'sidebar-left' // Persistent left sidebar + content (dashboards, tools)
  | 'sidebar-mini' // Collapsed icon sidebar + content (apps, portals)
  | 'centered'     // Centered max-width content, minimal nav (docs, forms)
  | 'magazine'     // Editorial with hero header, category chips (news, media)
  | 'dashboard'    // Dual-pane: sidebar + scrollable main (SaaS admin)
  | 'fullscreen'   // No chrome — just content (games, immersive experiences)

export interface LayoutConfig {
  key: LayoutKey
  maxWidth: number | 'full'
  sidebarWidth?: number
  headerHeight: number
  contentPadding: string
  fontDisplay: string       // CSS font-family for headings
  fontBody: string          // CSS font-family for body text
  primaryColor: string      // Brand accent color
  bgColor: string           // Page background
  surfaceColor: string      // Card/panel background
  borderColor: string       // Default border
  description: string
}

export const LAYOUT_PRESETS: Record<LayoutKey, Omit<LayoutConfig, 'key' | 'primaryColor'>> = {
  topnav: {
    maxWidth: 1280,
    headerHeight: 64,
    contentPadding: '2rem',
    fontDisplay: "'Cal Sans', 'Plus Jakarta Sans', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    bgColor: '#0a0a0f',
    surfaceColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    description: 'Marketing / landing page layout',
  },
  'sidebar-left': {
    maxWidth: 'full',
    sidebarWidth: 240,
    headerHeight: 56,
    contentPadding: '1.5rem',
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    bgColor: '#0f0f0f',
    surfaceColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    description: 'Tool / portal with persistent sidebar',
  },
  'sidebar-mini': {
    maxWidth: 'full',
    sidebarWidth: 72,
    headerHeight: 56,
    contentPadding: '1.25rem',
    fontDisplay: "'Inter', system-ui, sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    bgColor: '#111118',
    surfaceColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.07)',
    description: 'Icon sidebar — more content real estate',
  },
  centered: {
    maxWidth: 720,
    headerHeight: 56,
    contentPadding: '2rem 1rem',
    fontDisplay: "'Lora', Georgia, serif",
    fontBody: "'Inter', system-ui, sans-serif",
    bgColor: '#0c0c0c',
    surfaceColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    description: 'Docs / blog / forms — focused reading layout',
  },
  magazine: {
    maxWidth: 1440,
    headerHeight: 60,
    contentPadding: '0',
    fontDisplay: "'Playfair Display', Georgia, serif",
    fontBody: "'Source Serif 4', Georgia, serif",
    bgColor: '#0d0d0d',
    surfaceColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    description: 'Editorial layout for news / media sites',
  },
  dashboard: {
    maxWidth: 'full',
    sidebarWidth: 260,
    headerHeight: 60,
    contentPadding: '1.5rem',
    fontDisplay: "'DM Sans', system-ui, sans-serif",
    fontBody: "'DM Sans', system-ui, sans-serif",
    bgColor: '#0a0a12',
    surfaceColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    description: 'SaaS admin dashboard',
  },
  fullscreen: {
    maxWidth: 'full',
    headerHeight: 0,
    contentPadding: '0',
    fontDisplay: "'Rajdhani', system-ui, sans-serif",
    fontBody: "'Rajdhani', system-ui, sans-serif",
    bgColor: '#000',
    surfaceColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
    description: 'Games, immersive — no chrome',
  },
}

/** Project → layout mapping */
export const PROJECT_LAYOUTS: Record<string, { layout: LayoutKey; primaryColor: string; font: string }> = {
  // Education
  kwizzo:            { layout: 'topnav',       primaryColor: '#7c3aed', font: 'Cal Sans' },
  nudge:             { layout: 'centered',     primaryColor: '#10b981', font: 'Plus Jakarta Sans' },
  questly:           { layout: 'sidebar-left', primaryColor: '#3b82f6', font: 'DM Sans' },
  // Language / Learning
  'language-learning-bot': { layout: 'topnav', primaryColor: '#f59e0b', font: 'Nunito' },
  // Finance / Data
  'ai-investment-tracker': { layout: 'dashboard', primaryColor: '#22d3ee', font: 'DM Mono' },
  agenttrace:        { layout: 'dashboard',    primaryColor: '#a855f7', font: 'JetBrains Mono' },
  // Travel / Lifestyle
  'ai-travel-planner': { layout: 'magazine',  primaryColor: '#f97316', font: 'Playfair Display' },
  tradespot:         { layout: 'topnav',       primaryColor: '#f97316', font: 'Plus Jakarta Sans' },
  // Media / Content
  'yt-portal':       { layout: 'sidebar-left', primaryColor: '#ef4444', font: 'Roboto' },
  'ai-social-content': { layout: 'topnav',    primaryColor: '#ec4899', font: 'Cal Sans' },
  // Career
  'ai-resume-builder': { layout: 'centered',  primaryColor: '#6366f1', font: 'Inter' },
  'ai-jobs-portal':  { layout: 'topnav',       primaryColor: '#0ea5e9', font: 'Inter' },
  // Health / Productivity
  'health-tracker':  { layout: 'dashboard',    primaryColor: '#22c55e', font: 'Plus Jakarta Sans' },
  complybuddy:       { layout: 'sidebar-left', primaryColor: '#64748b', font: 'Inter' },
  // Gaming
  pixelforge:        { layout: 'fullscreen',   primaryColor: '#a855f7', font: 'Rajdhani' },
  // AI OS
  neuralos:          { layout: 'sidebar-mini', primaryColor: '#818cf8', font: 'Geist' },
  // Cultural / Tamil
  nammatamil:        { layout: 'magazine',     primaryColor: '#dc2626', font: 'Noto Sans Tamil' },
}
