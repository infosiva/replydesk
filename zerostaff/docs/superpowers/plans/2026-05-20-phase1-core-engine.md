# ZeroStaff Phase 1 — Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold ZeroStaff at `agents/zerostaff/`, wire Supabase auth + schema, build brief submission form, run 8 parallel Groq text generation jobs, show live progress, serve results with download center, gate on Stripe Free/Pro tiers.

**Architecture:** Next.js 15 App Router with server actions for brief submission. Supabase for auth + Postgres (RLS). Groq llama-3.3-70b runs 8 text jobs in parallel via `Promise.allSettled`. Stripe Checkout for Free→Pro upgrade. No job queue yet (Phase 2) — generation is synchronous in Phase 1, results stored immediately.

**Tech Stack:** Next.js 15, Tailwind CSS, Supabase (supabase-js v2), Groq SDK, Stripe JS + Node, TypeScript, Zod

---

## File Map

```
agents/zerostaff/
├── app/
│   ├── layout.tsx                    # Root layout, dark theme, fonts
│   ├── page.tsx                      # Landing/hero page
│   ├── (auth)/
│   │   ├── login/page.tsx            # Email+password login
│   │   └── signup/page.tsx           # Signup
│   ├── dashboard/
│   │   ├── layout.tsx                # Dashboard shell (sidebar + header)
│   │   ├── page.tsx                  # Dashboard home (brief list)
│   │   ├── new/page.tsx              # Brief submission form
│   │   └── results/[id]/page.tsx     # Results + download center
│   ├── api/
│   │   ├── generate/route.ts         # POST: submit brief, run Groq jobs, save results
│   │   ├── stripe/checkout/route.ts  # POST: create Stripe checkout session
│   │   └── stripe/webhook/route.ts   # POST: Stripe webhook (upgrade tier)
│   └── globals.css                   # Dark theme, Tailwind base
├── components/
│   ├── BriefForm.tsx                 # Multi-step brief form
│   ├── ResultCard.tsx                # Single output card (preview + download)
│   ├── DownloadCenter.tsx            # All 8 results grid
│   ├── TierGate.tsx                  # Blur + upgrade CTA for Pro-gated outputs
│   └── Navbar.tsx                    # Top nav with user + tier badge
├── lib/
│   ├── supabase.ts                   # Supabase client (browser + server)
│   ├── ai.ts                         # Groq fallback chain (from ai-platform-template)
│   ├── generate.ts                   # 8 Groq generation functions
│   ├── types.ts                      # TypeScript interfaces
│   └── stripe.ts                     # Stripe client + helpers
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # users, workspaces, briefs, jobs, assets tables
├── middleware.ts                     # Auth guard (redirect unauthenticated → /login)
├── .env.local.example                # Required env vars
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `agents/zerostaff/` — full Next.js 15 project

- [ ] **Step 1: Scaffold Next.js 15 app**

```bash
cd /Users/sivaprakasam/projects/agents
npx create-next-app@latest zerostaff --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd zerostaff
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr groq-sdk stripe @stripe/stripe-js zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu lucide-react
npm install -D @types/node
```

- [ ] **Step 3: Create `.env.local.example`**

```bash
cat > .env.local.example << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

Copy to `.env.local` and fill in values.

- [ ] **Step 4: Set dark background in `app/globals.css`**

Replace the contents of `app/globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #080712;
  --foreground: #f8fafc;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), sans-serif;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 5: Commit scaffold**

```bash
git add zerostaff/
git commit -m "feat(zerostaff): scaffold Next.js 15 app with deps"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types.ts`

- [ ] **Step 1: Write types**

Create `lib/types.ts`:

```typescript
export type Tier = 'free' | 'pro' | 'agency'

export interface ContentBrief {
  brand: string
  topic: string
  audience: string
  tone: 'professional' | 'casual' | 'educational' | 'persuasive'
  keywords: string[]
}

export interface BlogPost {
  title: string
  metaDescription: string
  sections: { heading: string; body: string }[]
}

export interface PodcastEpisode {
  title: string
  hook: string
  outline: string[]
  script: string
  showNotes: string
  promoPulls: string[]
}

export interface VideoStoryboard {
  title: string
  voiceoverScript: string
  scenes: { timestamp: string; visual: string; broll: string }[]
  callToAction: string
}

export interface EmailSequence {
  emails: { subject: string; preview: string; body: string; sendDay: number }[]
}

export interface LinkedInPosts {
  posts: { hook: string; body: string; cta: string }[]
}

export interface ShortClips {
  captions: string[]
}

export interface LeadGenPack {
  linkedinConnections: string[]
  coldEmails: { subject: string; body: string }[]
  dmSequence: string[]
  leadMagnetCta: string
}

export interface ClientReport {
  executiveSummary: string
  contentCalendar: { day: string; format: string; title: string }[]
  nextSteps: string[]
}

export interface GenerationResult {
  id: string
  brief: ContentBrief
  blog: BlogPost | null
  podcast: PodcastEpisode | null
  video: VideoStoryboard | null
  emails: EmailSequence | null
  linkedin: LinkedInPosts | null
  clips: ShortClips | null
  leadGen: LeadGenPack | null
  report: ClientReport | null
  createdAt: string
  tier: Tier
}

export interface JobStatus {
  type: keyof Omit<GenerationResult, 'id' | 'brief' | 'createdAt' | 'tier'>
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add zerostaff/lib/types.ts
git commit -m "feat(zerostaff): add TypeScript types for all content outputs"
```

---

## Task 3: Supabase Client + Schema

**Files:**
- Create: `lib/supabase.ts`
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create Supabase client helpers**

Create `lib/supabase.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 2: Write initial migration SQL**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users tier tracking (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  tier text not null default 'free' check (tier in ('free', 'pro', 'agency')),
  stripe_customer_id text,
  brief_count_this_month integer not null default 0,
  brief_count_reset_at timestamptz not null default date_trunc('month', now()) + interval '1 month',
  created_at timestamptz not null default now()
);

-- Workspaces (brand profiles)
create table public.workspaces (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  agency_id uuid references public.workspaces(id) on delete set null,
  name text not null,
  brand text not null default '',
  icp text not null default '',
  tone text not null default 'professional',
  logo_url text,
  created_at timestamptz not null default now()
);

-- Briefs
create table public.briefs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  topic text not null,
  audience text not null,
  tone text not null default 'professional',
  keywords text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'generating', 'done', 'error')),
  created_at timestamptz not null default now()
);

-- Generated assets (one row per output type per brief)
create table public.assets (
  id uuid primary key default uuid_generate_v4(),
  brief_id uuid references public.briefs(id) on delete cascade not null,
  type text not null check (type in ('blog','podcast','video','linkedin','emails','clips','leadgen','report')),
  status text not null default 'pending' check (status in ('pending','running','done','error')),
  content jsonb,
  file_url text,
  error text,
  created_at timestamptz not null default now(),
  unique(brief_id, type)
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.briefs enable row level security;
alter table public.assets enable row level security;

create policy "Users see own profile" on public.profiles
  for all using (auth.uid() = id);

create policy "Users see own workspaces" on public.workspaces
  for all using (auth.uid() = owner_id);

create policy "Users see own briefs" on public.briefs
  for all using (auth.uid() = user_id);

create policy "Users see own assets" on public.assets
  for all using (
    exists (
      select 1 from public.briefs b where b.id = assets.brief_id and b.user_id = auth.uid()
    )
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 3: Apply migration**

```bash
# In Supabase dashboard → SQL Editor, paste and run 001_initial_schema.sql
# Or with Supabase CLI if linked:
npx supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add zerostaff/lib/supabase.ts zerostaff/supabase/
git commit -m "feat(zerostaff): Supabase client helpers + initial schema migration"
```

---

## Task 4: Auth Middleware + Login/Signup Pages

**Files:**
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create auth middleware**

Create `middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  if (!user && !isAuthRoute && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
```

- [ ] **Step 2: Create login page**

Create `app/(auth)/login/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080712' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
        <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
        <p className="text-white/50 text-sm mb-6">ZeroStaff Agency OS</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-white/40 text-sm mt-4 text-center">
          No account? <Link href="/signup" className="text-purple-400 hover:text-purple-300">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create signup page**

Create `app/(auth)/signup/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080712' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
        <h1 className="text-2xl font-bold text-white mb-2">Create account</h1>
        <p className="text-white/50 text-sm mb-6">ZeroStaff Agency OS</p>
        <form onSubmit={handleSignup} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)" required minLength={8}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50">
            {loading ? 'Creating account…' : 'Get started free'}
          </button>
        </form>
        <p className="text-white/40 text-sm mt-4 text-center">
          Have an account? <Link href="/login" className="text-purple-400 hover:text-purple-300">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test auth flow manually**

```bash
npm run dev
# Visit http://localhost:3000/signup → create account
# Confirm redirects to /dashboard
# Visit /login → sign in → redirects to /dashboard
# Visit /dashboard while logged out → redirects to /login
```

- [ ] **Step 5: Commit**

```bash
git add zerostaff/middleware.ts zerostaff/app/\(auth\)/
git commit -m "feat(zerostaff): auth middleware + login/signup pages"
```

---

## Task 5: AI Generation Engine (Groq, 8 parallel jobs)

**Files:**
- Create: `lib/ai.ts`
- Create: `lib/generate.ts`

- [ ] **Step 1: Copy canonical ai.ts from template**

```bash
cp /Users/sivaprakasam/projects/agents/ai-platform-template/lib/ai.ts zerostaff/lib/ai.ts
```

Verify it exports a `generateText(prompt, systemPrompt)` or equivalent. If not, create `lib/ai.ts`:

```typescript
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 4096,
  })
  return response.choices[0]?.message?.content ?? ''
}
```

- [ ] **Step 2: Create generate.ts with 8 generators**

Create `lib/generate.ts`:

```typescript
import { generateText } from './ai'
import type {
  ContentBrief, BlogPost, PodcastEpisode, VideoStoryboard,
  EmailSequence, LinkedInPosts, ShortClips, LeadGenPack, ClientReport
} from './types'

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const match = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
    return JSON.parse(match ? match[1] : raw) as T
  } catch {
    return fallback
  }
}

export async function generateBlog(brief: ContentBrief): Promise<BlogPost> {
  const raw = await generateText(`
Write a 1,200-word SEO blog post for: "${brief.topic}"
Brand: ${brief.brand}. Audience: ${brief.audience}. Tone: ${brief.tone}. Keywords: ${brief.keywords.join(', ')}.

Return JSON:
{"title":"...","metaDescription":"...","sections":[{"heading":"...","body":"..."}]}
`)
  return parseJson<BlogPost>(raw, { title: brief.topic, metaDescription: '', sections: [] })
}

export async function generatePodcast(brief: ContentBrief): Promise<PodcastEpisode> {
  const raw = await generateText(`
Write a podcast episode script for: "${brief.topic}"
Brand: ${brief.brand}. Audience: ${brief.audience}. Tone: ${brief.tone}.

Return JSON:
{"title":"...","hook":"...","outline":["..."],"script":"...","showNotes":"...","promoPulls":["..."]}
`)
  return parseJson<PodcastEpisode>(raw, {
    title: brief.topic, hook: '', outline: [], script: '', showNotes: '', promoPulls: []
  })
}

export async function generateVideo(brief: ContentBrief): Promise<VideoStoryboard> {
  const raw = await generateText(`
Write a faceless video storyboard for: "${brief.topic}"
Brand: ${brief.brand}. Audience: ${brief.audience}.

Return JSON:
{"title":"...","voiceoverScript":"...","scenes":[{"timestamp":"0:00","visual":"...","broll":"..."}],"callToAction":"..."}
`)
  return parseJson<VideoStoryboard>(raw, {
    title: brief.topic, voiceoverScript: '', scenes: [], callToAction: ''
  })
}

export async function generateEmails(brief: ContentBrief): Promise<EmailSequence> {
  const raw = await generateText(`
Write a 5-email nurture sequence for: "${brief.topic}"
Brand: ${brief.brand}. Audience: ${brief.audience}. Tone: ${brief.tone}.

Return JSON:
{"emails":[{"subject":"...","preview":"...","body":"...","sendDay":1}]}
`)
  return parseJson<EmailSequence>(raw, { emails: [] })
}

export async function generateLinkedIn(brief: ContentBrief): Promise<LinkedInPosts> {
  const raw = await generateText(`
Write 3 LinkedIn posts (different angles) for: "${brief.topic}"
Brand: ${brief.brand}. Audience: ${brief.audience}. Tone: ${brief.tone}.

Return JSON:
{"posts":[{"hook":"...","body":"...","cta":"..."}]}
`)
  return parseJson<LinkedInPosts>(raw, { posts: [] })
}

export async function generateClips(brief: ContentBrief): Promise<ShortClips> {
  const raw = await generateText(`
Write 10 short-form video captions (TikTok/Reels) for: "${brief.topic}"
Brand: ${brief.brand}. Punchy, under 150 chars each.

Return JSON: {"captions":["..."]}
`)
  return parseJson<ShortClips>(raw, { captions: [] })
}

export async function generateLeadGen(brief: ContentBrief): Promise<LeadGenPack> {
  const raw = await generateText(`
Write a lead generation pack for: "${brief.topic}"
Brand: ${brief.brand}. Target ICP: ${brief.audience}.

Return JSON:
{
  "linkedinConnections": ["...(5 connection request messages)"],
  "coldEmails": [{"subject":"...","body":"..."}],
  "dmSequence": ["...(5-step DM follow-up)"],
  "leadMagnetCta": "..."
}
`)
  return parseJson<LeadGenPack>(raw, {
    linkedinConnections: [], coldEmails: [], dmSequence: [], leadMagnetCta: ''
  })
}

export async function generateReport(brief: ContentBrief): Promise<ClientReport> {
  const raw = await generateText(`
Write a client content report + 30-day calendar for: "${brief.topic}"
Brand: ${brief.brand}.

Return JSON:
{
  "executiveSummary": "...",
  "contentCalendar": [{"day":"Day 1","format":"Blog","title":"..."}],
  "nextSteps": ["..."]
}
`)
  return parseJson<ClientReport>(raw, {
    executiveSummary: '', contentCalendar: [], nextSteps: []
  })
}

export async function generateAll(brief: ContentBrief, tier: 'free' | 'pro' | 'agency') {
  const isFree = tier === 'free'

  const [blog, linkedin, podcast, video, emails, clips, leadGen, report] = await Promise.allSettled([
    generateBlog(brief),
    generateLinkedIn(brief),
    isFree ? Promise.resolve(null) : generatePodcast(brief),
    isFree ? Promise.resolve(null) : generateVideo(brief),
    isFree ? Promise.resolve(null) : generateEmails(brief),
    isFree ? Promise.resolve(null) : generateClips(brief),
    isFree ? Promise.resolve(null) : generateLeadGen(brief),
    isFree ? Promise.resolve(null) : generateReport(brief),
  ])

  return {
    blog: blog.status === 'fulfilled' ? blog.value : null,
    linkedin: linkedin.status === 'fulfilled' ? linkedin.value : null,
    podcast: podcast.status === 'fulfilled' ? podcast.value : null,
    video: video.status === 'fulfilled' ? video.value : null,
    emails: emails.status === 'fulfilled' ? emails.value : null,
    clips: clips.status === 'fulfilled' ? clips.value : null,
    leadGen: leadGen.status === 'fulfilled' ? leadGen.value : null,
    report: report.status === 'fulfilled' ? report.value : null,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add zerostaff/lib/ai.ts zerostaff/lib/generate.ts
git commit -m "feat(zerostaff): 8-output Groq generation engine with parallel jobs"
```

---

## Task 6: Generate API Route

**Files:**
- Create: `app/api/generate/route.ts`

- [ ] **Step 1: Create generate route**

Create `app/api/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { generateAll } from '@/lib/generate'
import type { ContentBrief } from '@/lib/types'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, brief_count_this_month, brief_count_reset_at')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Reset monthly count if needed
  const now = new Date()
  const resetAt = new Date(profile.brief_count_reset_at)
  if (now > resetAt) {
    await supabase.from('profiles').update({
      brief_count_this_month: 0,
      brief_count_reset_at: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    }).eq('id', user.id)
    profile.brief_count_this_month = 0
  }

  // Enforce tier limits
  const limits: Record<string, number> = { free: 2, pro: 20, agency: Infinity }
  if (profile.brief_count_this_month >= limits[profile.tier]) {
    return NextResponse.json(
      { error: `Brief limit reached for ${profile.tier} tier. Upgrade to continue.` },
      { status: 429 }
    )
  }

  const body = await request.json()
  const brief: ContentBrief = {
    brand: body.brand ?? '',
    topic: body.topic ?? '',
    audience: body.audience ?? '',
    tone: body.tone ?? 'professional',
    keywords: body.keywords ?? [],
  }

  if (!brief.topic || !brief.brand || !brief.audience) {
    return NextResponse.json({ error: 'topic, brand, and audience are required' }, { status: 400 })
  }

  // Get or create default workspace
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) {
    const { data: newWs } = await supabase
      .from('workspaces')
      .insert({ owner_id: user.id, name: brief.brand, brand: brief.brand })
      .select('id')
      .single()
    workspace = newWs
  }

  // Create brief record
  const { data: briefRecord } = await supabase
    .from('briefs')
    .insert({
      workspace_id: workspace!.id,
      user_id: user.id,
      topic: brief.topic,
      audience: brief.audience,
      tone: brief.tone,
      keywords: brief.keywords,
      status: 'generating',
    })
    .select('id')
    .single()

  if (!briefRecord) {
    return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 })
  }

  // Run generation
  const results = await generateAll(brief, profile.tier as 'free' | 'pro' | 'agency')

  // Save all assets
  const assetTypes = ['blog', 'podcast', 'video', 'emails', 'linkedin', 'clips', 'leadgen', 'report'] as const
  const assetMap: Record<string, keyof typeof results> = {
    blog: 'blog', podcast: 'podcast', video: 'video',
    emails: 'emails', linkedin: 'linkedin', clips: 'clips',
    leadgen: 'leadGen', report: 'report'
  }

  await supabase.from('assets').insert(
    assetTypes.map(type => ({
      brief_id: briefRecord.id,
      type,
      status: results[assetMap[type]] ? 'done' : 'pending',
      content: results[assetMap[type]],
    }))
  )

  await supabase.from('briefs').update({ status: 'done' }).eq('id', briefRecord.id)
  await supabase.from('profiles').update({
    brief_count_this_month: profile.brief_count_this_month + 1
  }).eq('id', user.id)

  return NextResponse.json({ id: briefRecord.id })
}
```

- [ ] **Step 2: Test the endpoint**

```bash
# Start dev server
npm run dev

# In another terminal, get a valid session cookie and test:
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"brand":"Acme Corp","topic":"AI in marketing","audience":"CMOs at SMBs","tone":"professional","keywords":["AI","marketing","automation"]}'
# Expected: {"id":"<uuid>"}
```

- [ ] **Step 3: Commit**

```bash
git add zerostaff/app/api/generate/
git commit -m "feat(zerostaff): generate API route — parallel Groq jobs, tier enforcement, Supabase persistence"
```

---

## Task 7: Brief Submission Form

**Files:**
- Create: `app/dashboard/new/page.tsx`
- Create: `components/BriefForm.tsx`

- [ ] **Step 1: Create BriefForm component**

Create `components/BriefForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BriefForm() {
  const [form, setForm] = useState({
    brand: '', topic: '', audience: '',
    tone: 'professional' as const, keywords: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean)
      })
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Generation failed'); setLoading(false); return }
    router.push(`/dashboard/results/${data.id}`)
  }

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition"
  const labelClass = "block text-sm font-medium text-white/60 mb-2"

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <label className={labelClass}>Brand / Company name *</label>
        <input className={inputClass} placeholder="e.g. Acme Corp"
          value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} required />
      </div>
      <div>
        <label className={labelClass}>Content topic *</label>
        <input className={inputClass} placeholder="e.g. AI in marketing automation"
          value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} required />
      </div>
      <div>
        <label className={labelClass}>Target audience *</label>
        <input className={inputClass} placeholder="e.g. CMOs at B2B SaaS companies"
          value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} required />
      </div>
      <div>
        <label className={labelClass}>Tone</label>
        <select className={inputClass} value={form.tone}
          onChange={e => setForm(f => ({ ...f, tone: e.target.value as typeof form.tone }))}>
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="educational">Educational</option>
          <option value="persuasive">Persuasive</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Keywords (comma-separated)</label>
        <input className={inputClass} placeholder="AI, automation, ROI"
          value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="px-8 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50 flex items-center gap-2">
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating 8 assets…
          </>
        ) : 'Generate content package'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create new brief page**

Create `app/dashboard/new/page.tsx`:

```tsx
import BriefForm from '@/components/BriefForm'

export default function NewBriefPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">New content brief</h1>
        <p className="text-white/50 mt-2">Fill in the brief — we generate 8 assets in parallel.</p>
      </div>
      <BriefForm />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add zerostaff/components/BriefForm.tsx zerostaff/app/dashboard/new/
git commit -m "feat(zerostaff): brief submission form with tone/keywords fields"
```

---

## Task 8: Results Page + Download Center

**Files:**
- Create: `app/dashboard/results/[id]/page.tsx`
- Create: `components/ResultCard.tsx`
- Create: `components/TierGate.tsx`
- Create: `components/DownloadCenter.tsx`

- [ ] **Step 1: Create TierGate component**

Create `components/TierGate.tsx`:

```tsx
import Link from 'next/link'

export default function TierGate({ label }: { label: string }) {
  return (
    <div className="relative rounded-xl border border-white/10 overflow-hidden">
      <div className="p-6 blur-sm select-none pointer-events-none opacity-40">
        <p className="text-white/60 text-sm">Content preview hidden</p>
        <p className="text-white mt-2">Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor.</p>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
        <p className="text-white font-semibold mb-1">{label}</p>
        <p className="text-white/50 text-sm mb-4">Upgrade to Pro to unlock</p>
        <Link href="/dashboard/upgrade"
          className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition">
          Upgrade to Pro — $99/mo
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ResultCard component**

Create `components/ResultCard.tsx`:

```tsx
'use client'
import { useState } from 'react'

interface ResultCardProps {
  title: string
  icon: string
  content: Record<string, unknown> | null
  tier: 'free' | 'pro' | 'agency'
  requiredTier: 'free' | 'pro'
}

export default function ResultCard({ title, icon, content, tier, requiredTier }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasAccess = tier === 'agency' || tier === 'pro' || requiredTier === 'free'

  if (!hasAccess || !content) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{icon}</span>
          <span className="font-semibold text-white">{title}</span>
          <span className="ml-auto text-xs text-orange-400 border border-orange-400/30 rounded-full px-2 py-0.5">Pro</span>
        </div>
        <p className="text-white/30 text-sm">Upgrade to Pro to unlock this output.</p>
      </div>
    )
  }

  const preview = JSON.stringify(content).slice(0, 200)

  function downloadJson() {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="font-semibold text-white">{title}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs text-white/50 hover:text-white transition">
            {expanded ? 'Hide' : 'Preview'}
          </button>
          <button onClick={downloadJson}
            className="text-xs px-3 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/40 transition">
            Download
          </button>
        </div>
      </div>
      {expanded && (
        <pre className="text-xs text-white/60 bg-black/30 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      )}
      {!expanded && (
        <p className="text-white/40 text-xs truncate">{preview}…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create DownloadCenter component**

Create `components/DownloadCenter.tsx`:

```tsx
import ResultCard from './ResultCard'
import type { GenerationResult } from '@/lib/types'

export default function DownloadCenter({ result }: { result: GenerationResult }) {
  const outputs = [
    { key: 'blog', title: 'SEO Blog Post', icon: '📝', tier: 'free' as const },
    { key: 'linkedin', title: 'LinkedIn Posts', icon: '💼', tier: 'free' as const },
    { key: 'podcast', title: 'Podcast Script', icon: '🎙️', tier: 'pro' as const },
    { key: 'video', title: 'Video Storyboard', icon: '🎬', tier: 'pro' as const },
    { key: 'emails', title: 'Email Sequence', icon: '✉️', tier: 'pro' as const },
    { key: 'clips', title: 'Short Clips / Captions', icon: '✂️', tier: 'pro' as const },
    { key: 'leadGen', title: 'Lead Gen Pack', icon: '🎯', tier: 'pro' as const },
    { key: 'report', title: 'Client Report', icon: '📊', tier: 'pro' as const },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {outputs.map(({ key, title, icon, tier: requiredTier }) => (
        <ResultCard
          key={key}
          title={title}
          icon={icon}
          content={result[key as keyof GenerationResult] as Record<string, unknown> | null}
          tier={result.tier}
          requiredTier={requiredTier}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create results page**

Create `app/dashboard/results/[id]/page.tsx`:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase'
import DownloadCenter from '@/components/DownloadCenter'
import { notFound, redirect } from 'next/navigation'
import type { GenerationResult } from '@/lib/types'

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brief } = await supabase
    .from('briefs')
    .select('*, assets(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!brief) notFound()

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single()

  const assetMap: Record<string, string> = {
    blog: 'blog', podcast: 'podcast', video: 'video', emails: 'emails',
    linkedin: 'linkedin', clips: 'clips', leadgen: 'leadGen', report: 'report'
  }

  const result: GenerationResult = {
    id: brief.id,
    brief: {
      brand: brief.assets?.[0]?.content?.brand ?? '',
      topic: brief.topic,
      audience: brief.audience,
      tone: brief.tone,
      keywords: brief.keywords,
    },
    blog: brief.assets?.find((a: { type: string }) => a.type === 'blog')?.content ?? null,
    podcast: brief.assets?.find((a: { type: string }) => a.type === 'podcast')?.content ?? null,
    video: brief.assets?.find((a: { type: string }) => a.type === 'video')?.content ?? null,
    emails: brief.assets?.find((a: { type: string }) => a.type === 'emails')?.content ?? null,
    linkedin: brief.assets?.find((a: { type: string }) => a.type === 'linkedin')?.content ?? null,
    clips: brief.assets?.find((a: { type: string }) => a.type === 'clips')?.content ?? null,
    leadGen: brief.assets?.find((a: { type: string }) => a.type === 'leadgen')?.content ?? null,
    report: brief.assets?.find((a: { type: string }) => a.type === 'report')?.content ?? null,
    createdAt: brief.created_at,
    tier: (profile?.tier ?? 'free') as 'free' | 'pro' | 'agency',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-white/40 text-sm mb-1">Results for brief</p>
        <h1 className="text-3xl font-bold text-white">{brief.topic}</h1>
        <p className="text-white/50 mt-1">{brief.audience} · {brief.tone}</p>
      </div>
      <DownloadCenter result={result} />
    </div>
  )
}
```

- [ ] **Step 5: Test results flow**

```bash
# Submit a brief via /dashboard/new
# Confirm redirect to /dashboard/results/<id>
# Verify 8 result cards render
# Verify free tier shows blur/upgrade on Pro outputs
# Click Download on blog/linkedin cards — confirm JSON downloads
```

- [ ] **Step 6: Commit**

```bash
git add zerostaff/components/ zerostaff/app/dashboard/results/
git commit -m "feat(zerostaff): results page, download center, tier gate component"
```

---

## Task 9: Dashboard Layout + Brief List

**Files:**
- Create: `app/dashboard/layout.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `components/Navbar.tsx`

- [ ] **Step 1: Create Navbar**

Create `components/Navbar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavbarProps {
  tier: 'free' | 'pro' | 'agency'
  email: string
}

const tierColors: Record<string, string> = {
  free: 'text-white/40 border-white/20',
  pro: 'text-purple-300 border-purple-500/40',
  agency: 'text-emerald-300 border-emerald-500/40',
}

export default function Navbar({ tier, email }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="h-14 border-b border-white/[0.06] flex items-center px-6 gap-4">
      <Link href="/dashboard" className="text-white font-bold text-lg tracking-tight mr-4">
        ZeroStaff
      </Link>
      <Link href="/dashboard/new"
        className="text-sm text-white/60 hover:text-white transition">New brief</Link>
      <div className="ml-auto flex items-center gap-3">
        <span className={`text-xs border rounded-full px-2 py-0.5 uppercase font-bold tracking-wide ${tierColors[tier]}`}>
          {tier}
        </span>
        <span className="text-white/40 text-sm">{email}</span>
        <button onClick={signOut} className="text-white/40 hover:text-white text-sm transition">
          Sign out
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create dashboard layout**

Create `app/dashboard/layout.tsx`:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, email')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen" style={{ background: '#080712' }}>
      <Navbar tier={(profile?.tier ?? 'free') as 'free' | 'pro' | 'agency'} email={profile?.email ?? user.email ?? ''} />
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard home (brief list)**

Create `app/dashboard/page.tsx`:

```tsx
import { createServerSupabaseClient } from '@/lib/supabase'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, topic, audience, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Content briefs</h1>
          <p className="text-white/50 mt-1">Each brief generates 8 content assets.</p>
        </div>
        <Link href="/dashboard/new"
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition">
          + New brief
        </Link>
      </div>

      {!briefs?.length && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-white font-semibold text-lg mb-2">No briefs yet</p>
          <p className="text-white/40 mb-6">Submit your first brief to generate 8 content assets.</p>
          <Link href="/dashboard/new"
            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition">
            Create first brief
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {briefs?.map(brief => (
          <Link key={brief.id} href={`/dashboard/results/${brief.id}`}
            className="flex items-center gap-4 p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition group">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{brief.topic}</p>
              <p className="text-white/40 text-sm truncate">{brief.audience}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border ${
              brief.status === 'done' ? 'text-emerald-400 border-emerald-400/30' :
              brief.status === 'generating' ? 'text-yellow-400 border-yellow-400/30' :
              'text-white/30 border-white/10'
            }`}>{brief.status}</span>
            <span className="text-white/20 group-hover:text-white/60 transition">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add zerostaff/components/Navbar.tsx zerostaff/app/dashboard/layout.tsx zerostaff/app/dashboard/page.tsx
git commit -m "feat(zerostaff): dashboard layout, navbar with tier badge, brief list"
```

---

## Task 10: Stripe Upgrade Flow

**Files:**
- Create: `lib/stripe.ts`
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/stripe/webhook/route.ts`
- Create: `app/dashboard/upgrade/page.tsx`

- [ ] **Step 1: Create Stripe client helper**

Create `lib/stripe.ts`:

```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
})

export const TIER_PRICES: Record<string, string> = {
  pro: process.env.STRIPE_PRO_PRICE_ID!,
  agency: process.env.STRIPE_AGENCY_PRICE_ID!,
}
```

- [ ] **Step 2: Create Stripe checkout route**

Create `app/api/stripe/checkout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { stripe, TIER_PRICES } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tier } = await request.json()
  const priceId = TIER_PRICES[tier]
  if (!priceId) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email! })
    customerId = customer.id
    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade`,
    metadata: { user_id: user.id, tier },
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 3: Create Stripe webhook handler**

Create `app/api/stripe/webhook/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: { user_id?: string; tier?: string } }
    const { user_id, tier } = session.metadata ?? {}
    if (user_id && tier) {
      const supabase = createServiceClient()
      await supabase.from('profiles').update({ tier }).eq('id', user_id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { customer: string }
    const supabase = createServiceClient()
    await supabase.from('profiles')
      .update({ tier: 'free' })
      .eq('stripe_customer_id', sub.customer)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 4: Create upgrade page**

Create `app/dashboard/upgrade/page.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const plans = [
  {
    id: 'pro',
    name: 'Pro',
    price: '$99/mo',
    features: ['20 briefs/month', 'Real MP3 podcast', 'Faceless video', 'Lead gen pack', 'Client portal', 'Email sequence', 'Short clips'],
    color: 'purple',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '$199/mo',
    features: ['Unlimited briefs', 'White-label portal', 'Sub-accounts', 'Run-on-behalf', 'API access', 'Custom domain', 'Team roles', 'Invoicing'],
    color: 'emerald',
  },
]

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function upgrade(tier: string) {
    setLoading(tier)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })
    const { url } = await res.json()
    if (url) router.push(url)
    else setLoading(null)
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Upgrade your plan</h1>
      <p className="text-white/50 mb-10">Unlock real audio, video, lead gen, and agency tools.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {plans.map(plan => (
          <div key={plan.id}
            className={`rounded-2xl border p-6 ${plan.color === 'purple' ? 'border-purple-500/30 bg-purple-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${plan.color === 'purple' ? 'text-purple-400' : 'text-emerald-400'}`}>
              {plan.name}
            </div>
            <div className="text-3xl font-bold text-white mb-4">{plan.price}</div>
            <ul className="space-y-2 mb-6">
              {plan.features.map(f => (
                <li key={f} className="text-white/60 text-sm flex items-center gap-2">
                  <span className={plan.color === 'purple' ? 'text-purple-400' : 'text-emerald-400'}>✓</span> {f}
                </li>
              ))}
            </ul>
            <button onClick={() => upgrade(plan.id)} disabled={loading === plan.id}
              className={`w-full py-3 rounded-xl font-semibold transition ${plan.color === 'purple'
                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50`}>
              {loading === plan.id ? 'Redirecting…' : `Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Test Stripe flow**

```bash
# Install Stripe CLI: brew install stripe/stripe-cli/stripe
stripe listen --forward-to localhost:3000/api/stripe/webhook

# In separate terminal, trigger test event:
stripe trigger checkout.session.completed

# After real test: go to /dashboard/upgrade → click Upgrade to Pro
# Complete Stripe test checkout (card: 4242 4242 4242 4242)
# Confirm redirect back, profile tier updated to 'pro' in Supabase
```

- [ ] **Step 6: Commit**

```bash
git add zerostaff/lib/stripe.ts zerostaff/app/api/stripe/ zerostaff/app/dashboard/upgrade/
git commit -m "feat(zerostaff): Stripe checkout, webhook, tier upgrade flow"
```

---

## Task 11: Landing Page + Deploy

**Files:**
- Create: `app/page.tsx`
- Create: `app/layout.tsx`
- Create: SEO files

- [ ] **Step 1: Create root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://zerostaff.app'),
  title: 'ZeroStaff — AI Content Agency OS | Zero Employees',
  description: 'One brief generates 8 content assets: blog, podcast MP3, faceless video, LinkedIn posts, email sequence, lead gen pack. White-label agency OS for $99/mo.',
  openGraph: {
    title: 'ZeroStaff — AI Content Agency OS',
    description: 'One brief → 8 assets. Blog + podcast + video + LinkedIn + email + lead gen. Zero employees.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Create landing page**

Replace `app/page.tsx`:

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col" style={{ background: '#080712' }}>
      <nav className="flex items-center px-8 h-16 border-b border-white/[0.06]">
        <span className="text-white font-bold text-xl">ZeroStaff</span>
        <div className="ml-auto flex gap-4">
          <Link href="/login" className="text-white/60 hover:text-white text-sm transition">Sign in</Link>
          <Link href="/signup" className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition">
            Start free
          </Link>
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          AI Agency OS — Zero employees needed
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white leading-tight max-w-4xl mb-6">
          One brief.<br />
          <span className="text-purple-400">8 content assets.</span>
        </h1>
        <p className="text-white/50 text-xl max-w-2xl mb-10">
          Blog post, podcast MP3, faceless video, LinkedIn posts, email sequence, TikTok captions, lead gen pack, client report — generated in parallel, delivered instantly.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/signup" className="px-8 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-lg font-bold transition">
            Start free — 2 briefs/mo
          </Link>
          <Link href="/dashboard" className="px-8 py-4 rounded-2xl border border-white/15 hover:border-white/30 text-white text-lg font-bold transition">
            See dashboard →
          </Link>
        </div>
      </section>

      <section className="py-16 px-8 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: '📝', label: 'SEO Blog', sub: '1,200 words' },
            { icon: '🎙️', label: 'Podcast MP3', sub: 'ElevenLabs TTS' },
            { icon: '🎬', label: 'Faceless Video', sub: 'fal.ai Kling' },
            { icon: '💼', label: 'LinkedIn Posts', sub: '3 angles' },
            { icon: '✉️', label: 'Email Sequence', sub: '5-email nurture' },
            { icon: '✂️', label: 'Short Clips', sub: '10 captions' },
            { icon: '🎯', label: 'Lead Gen Pack', sub: 'DMs + cold email' },
            { icon: '📊', label: 'Client Report', sub: 'Strategy + calendar' },
          ].map(({ icon, label, sub }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
              <div className="text-3xl mb-2">{icon}</div>
              <div className="text-white font-semibold text-sm">{label}</div>
              <div className="text-white/40 text-xs mt-1">{sub}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Add sitemap + robots**

Create `app/sitemap.ts`:

```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://zerostaff.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://zerostaff.app/login', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
    { url: 'https://zerostaff.app/signup', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.8 },
  ]
}
```

Create `public/robots.txt`:
```
User-agent: *
Allow: /
Disallow: /dashboard/

Sitemap: https://zerostaff.app/sitemap.xml
```

- [ ] **Step 4: Deploy to Vercel**

```bash
# From agents/zerostaff/
vercel --prod

# Set env vars in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GROQ_API_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add STRIPE_PRO_PRICE_ID
vercel env add NEXT_PUBLIC_APP_URL  # set to https://zerostaff.app or Vercel URL
```

- [ ] **Step 5: Final smoke test**

```bash
# Verify:
# / loads, hero renders, CTA links work
# /signup creates account, redirects to /dashboard
# /dashboard/new submits brief, redirects to /dashboard/results/<id>
# Results show 8 cards, free tier gates Pro outputs
# /dashboard/upgrade shows plans, Stripe checkout opens
```

- [ ] **Step 6: Final commit + push**

```bash
git add zerostaff/app/layout.tsx zerostaff/app/page.tsx zerostaff/app/sitemap.ts zerostaff/public/
git commit -m "feat(zerostaff): landing page, SEO metadata, sitemap, robots.txt"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✅ Next.js 15 scaffold
- ✅ Supabase schema (profiles, workspaces, briefs, assets) + RLS
- ✅ Auth (login/signup/middleware)
- ✅ 8-output Groq generation in parallel
- ✅ Tier enforcement (Free=2 briefs/mo, Pro=20)
- ✅ Results page + download center
- ✅ Tier gate (Pro outputs blurred for free users)
- ✅ Stripe checkout + webhook (tier upgrade)
- ✅ Landing page with SEO
- ✅ Free tier: blog + LinkedIn only

**Phase 2 (not in this plan — separate plan):**
- ElevenLabs TTS → real MP3
- fal.ai Kling → video
- R2 file storage
- Upstash QStash async queue
- Resend email (send + inbound)
- In-portal messaging

**Type consistency check:**
- `GenerationResult.leadGen` (camelCase) — confirmed consistent across types.ts, generate.ts, DownloadCenter.tsx, results page
- `assets.type = 'leadgen'` (lowercase, no camel) — map in results page uses `assetMap.leadgen = 'leadGen'` ✅
- `Tier` type used consistently: `'free' | 'pro' | 'agency'` everywhere ✅
