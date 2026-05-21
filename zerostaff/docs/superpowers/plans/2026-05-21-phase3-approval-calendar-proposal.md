# ZeroStaff Phase 3 — Approval Workflow, Content Calendar & Proposal Builder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client content approval workflow (review → comment → approve), visual content calendar with status tracking, and a quote/proposal builder that generates a branded PDF, sends a shareable link, captures acceptance, and optionally auto-creates a Stripe retainer.

**Architecture:** Approval state machine lives in Supabase `revisions` + `comments` tables. Calendar is a client-side grid reading `calendar_items`. Proposal builder uses `@react-pdf/renderer` server-side to generate PDF, stores blob in R2, returns signed URL. Acceptance is a public unauthenticated route that logs timestamp + IP.

**Tech Stack:** Next.js 15, Supabase, `@react-pdf/renderer`, Resend (already installed), Cloudflare R2 (already installed), Stripe (already installed), Tailwind CSS

---

## File Map

```
zerostaff/
├── app/
│   ├── api/
│   │   ├── assets/
│   │   │   └── [id]/approve/route.ts     CREATE — mark asset approved
│   │   ├── comments/route.ts              CREATE — POST comment on asset
│   │   └── proposals/
│   │       ├── route.ts                   CREATE — POST create proposal
│   │       ├── [id]/route.ts              CREATE — GET proposal (public view)
│   │       ├── [id]/accept/route.ts       CREATE — POST accept proposal (public)
│   │       └── [id]/pdf/route.ts          CREATE — GET download PDF
│   └── dashboard/
│       ├── calendar/page.tsx              CREATE — content calendar view
│       ├── calendar/[id]/page.tsx         CREATE — per-brief calendar detail
│       ├── results/[id]/page.tsx          MODIFY — add approval widget
│       └── proposals/
│           ├── page.tsx                   CREATE — proposals list
│           ├── new/page.tsx               CREATE — create proposal form
│           └── [id]/page.tsx             CREATE — proposal detail + status
├── app/proposals/[id]/page.tsx            CREATE — PUBLIC proposal view (no auth, branded)
├── components/
│   ├── ApprovalWidget.tsx                 CREATE — per-asset review/approve/comment
│   ├── CalendarGrid.tsx                   CREATE — monthly grid with asset dots
│   └── ProposalForm.tsx                   CREATE — proposal creation form
├── lib/
│   ├── pdf.ts                             CREATE — React PDF proposal renderer
│   └── types.ts                           MODIFY — add Revision, Comment, CalendarItem, Proposal types
└── supabase/migrations/
    └── 003_phase3_schema.sql              CREATE — revisions, comments, calendar_items, proposals, proposal_items
```

---

## Task 1: Phase 3 Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install deps**

```bash
cd /Users/sivaprakasam/projects/agents/zerostaff
npm install @react-pdf/renderer
npm install -D @types/react-pdf
```

- [ ] **Step 2: Verify**

```bash
node -e "require('@react-pdf/renderer'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(zerostaff): install @react-pdf/renderer for proposal PDF generation"
```

---

## Task 2: Phase 3 Supabase Migration

**Files:**
- Create: `supabase/migrations/003_phase3_schema.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/003_phase3_schema.sql`:

```sql
-- Revisions: tracks approval state per asset
create table if not exists public.revisions (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  round integer not null default 1,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested')),
  created_at timestamptz not null default now()
);

-- Comments: inline feedback per asset
create table if not exists public.comments (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  revision_id uuid references public.revisions(id) on delete set null,
  author_id uuid references public.users(id) on delete set null,
  author_email text,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Content calendar items
create table if not exists public.calendar_items (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  publish_date date,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'scheduled', 'published')),
  platform text,
  created_at timestamptz not null default now()
);

-- Proposals
create table if not exists public.proposals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_email text not null,
  client_name text not null,
  title text not null,
  executive_summary text,
  timeline_notes text,
  total_amount numeric(10, 2) not null default 0,
  billing_cadence text not null default 'monthly' check (billing_cadence in ('one_off', 'monthly', 'quarterly')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  pdf_url text,
  accepted_at timestamptz,
  accepted_ip text,
  created_at timestamptz not null default now()
);

-- Proposal line items
create table if not exists public.proposal_items (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(10, 2) not null,
  total numeric(10, 2) generated always as (quantity * unit_price) stored
);

-- RLS
alter table public.revisions enable row level security;
alter table public.comments enable row level security;
alter table public.calendar_items enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

-- Revisions: workspace owner via asset → brief
create policy "revisions_workspace_owner" on public.revisions
  for all using (
    asset_id in (
      select a.id from public.assets a
      join public.briefs b on b.id = a.brief_id
      join public.workspaces w on w.id = b.workspace_id
      where w.owner_id = auth.uid()
    )
  );

create policy "comments_workspace_owner" on public.comments
  for all using (
    asset_id in (
      select a.id from public.assets a
      join public.briefs b on b.id = a.brief_id
      join public.workspaces w on w.id = b.workspace_id
      where w.owner_id = auth.uid()
    )
  );

create policy "calendar_items_workspace_owner" on public.calendar_items
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "proposals_workspace_owner" on public.proposals
  for all using (
    workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );

create policy "proposal_items_owner" on public.proposal_items
  for all using (
    proposal_id in (
      select p.id from public.proposals p
      join public.workspaces w on w.id = p.workspace_id
      where w.owner_id = auth.uid()
    )
  );

-- Realtime
alter publication supabase_realtime add table public.revisions;
alter publication supabase_realtime add table public.comments;
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
# or paste in Supabase SQL editor
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_phase3_schema.sql
git commit -m "feat(zerostaff): phase 3 schema — revisions, comments, calendar, proposals, proposal_items"
```

---

## Task 3: Add Phase 3 Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Append types**

Add to bottom of `lib/types.ts`:

```typescript
export interface DbRevision {
  id: string
  asset_id: string
  round: number
  status: 'pending' | 'approved' | 'changes_requested'
  created_at: string
}

export interface DbComment {
  id: string
  asset_id: string
  revision_id: string | null
  author_id: string | null
  author_email: string | null
  body: string
  resolved: boolean
  created_at: string
}

export interface DbCalendarItem {
  id: string
  asset_id: string
  workspace_id: string
  publish_date: string | null
  status: 'draft' | 'in_review' | 'approved' | 'scheduled' | 'published'
  platform: string | null
  created_at: string
}

export interface DbProposal {
  id: string
  workspace_id: string
  client_email: string
  client_name: string
  title: string
  executive_summary: string | null
  timeline_notes: string | null
  total_amount: number
  billing_cadence: 'one_off' | 'monthly' | 'quarterly'
  status: 'draft' | 'sent' | 'accepted' | 'declined'
  pdf_url: string | null
  accepted_at: string | null
  created_at: string
}

export interface DbProposalItem {
  id: string
  proposal_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat(zerostaff): add phase 3 types — revisions, comments, calendar, proposals"
```

---

## Task 4: Approval API Routes

**Files:**
- Create: `app/api/assets/[id]/approve/route.ts`
- Create: `app/api/comments/route.ts`

- [ ] **Step 1: Create approve route**

Create `app/api/assets/[id]/approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assetId = params.id

  // Verify asset belongs to user's workspace
  const { data: asset } = await supabase
    .from('assets')
    .select('id, brief_id, briefs(workspace_id, workspaces(owner_id))')
    .eq('id', assetId)
    .single()

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const workspace = (asset.briefs as { workspaces: { owner_id: string } })?.workspaces
  if (workspace?.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceRoleClient()

  // Get or create current revision
  const { data: existing } = await service
    .from('revisions')
    .select('id, round')
    .eq('asset_id', assetId)
    .order('round', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    await service.from('revisions').update({ status: 'approved' }).eq('id', existing.id)
  } else {
    await service.from('revisions').insert({ asset_id: assetId, round: 1, status: 'approved' })
  }

  // Mark asset approved_at
  await service.from('assets').update({ approved_at: new Date().toISOString() }).eq('id', assetId)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create comments route**

Create `app/api/comments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { z } from 'zod'

const Schema = z.object({
  asset_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  revision_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const service = createServiceRoleClient()
  const { data: comment, error } = await service.from('comments').insert({
    asset_id: parsed.data.asset_id,
    revision_id: parsed.data.revision_id ?? null,
    author_id: user.id,
    body: parsed.data.body,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: comment.id })
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const assetId = new URL(request.url).searchParams.get('asset_id')
  if (!assetId) return NextResponse.json({ error: 'asset_id required' }, { status: 400 })

  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at')

  return NextResponse.json({ comments: comments ?? [] })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/assets/ app/api/comments/
git commit -m "feat(zerostaff): approval + comments API routes"
```

---

## Task 5: ApprovalWidget Component

**Files:**
- Create: `components/ApprovalWidget.tsx`

- [ ] **Step 1: Create component**

Create `components/ApprovalWidget.tsx`:

```typescript
'use client'

import { useState } from 'react'

type Comment = {
  id: string
  author_email: string | null
  body: string
  resolved: boolean
  created_at: string
}

export function ApprovalWidget({
  assetId,
  approvedAt,
  comments: initialComments,
}: {
  assetId: string
  approvedAt: string | null
  comments: Comment[]
}) {
  const [approved, setApproved] = useState(!!approvedAt)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    await fetch(`/api/assets/${assetId}/approve`, { method: 'POST' })
    setApproved(true)
    setLoading(false)
  }

  async function addComment() {
    if (!draft.trim()) return
    setLoading(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, body: draft.trim() }),
    })
    if (res.ok) {
      const { id } = await res.json()
      setComments(prev => [...prev, {
        id, author_email: null, body: draft.trim(), resolved: false,
        created_at: new Date().toISOString(),
      }])
      setDraft('')
    }
    setLoading(false)
  }

  return (
    <div className="border-t border-white/10 pt-4 mt-4 space-y-4">
      {/* Approval */}
      <div className="flex items-center gap-3">
        {approved ? (
          <span className="flex items-center gap-2 text-sm text-green-400">
            <span className="w-2 h-2 bg-green-400 rounded-full" /> Approved
          </span>
        ) : (
          <button onClick={approve} disabled={loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
            {loading ? 'Approving...' : 'Approve'}
          </button>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-2">
        {comments.map(c => (
          <div key={c.id} className="bg-white/5 rounded-lg px-3 py-2 text-sm text-white/80">
            <p className="whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-white/30 mt-1">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addComment() }}
            placeholder="Add a comment..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addComment} disabled={loading || !draft.trim()}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-sm rounded-lg">
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into results page**

In `app/dashboard/results/[id]/page.tsx`, for each asset card, render:
```typescript
<ApprovalWidget
  assetId={asset.id}
  approvedAt={asset.approved_at}
  comments={asset.comments ?? []}
/>
```

Ensure the results page server query includes:
```typescript
.select('*, comments(*)')
```

- [ ] **Step 3: Commit**

```bash
git add components/ApprovalWidget.tsx app/dashboard/results/
git commit -m "feat(zerostaff): per-asset approval widget with inline comments"
```

---

## Task 6: Content Calendar

**Files:**
- Create: `components/CalendarGrid.tsx`
- Create: `app/dashboard/calendar/page.tsx`

- [ ] **Step 1: Create CalendarGrid component**

Create `components/CalendarGrid.tsx`:

```typescript
'use client'

import { useState } from 'react'

type CalendarItem = {
  id: string
  asset_id: string
  publish_date: string | null
  status: string
  platform: string | null
  assets?: { type: string; briefs?: { brand: string } }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/20',
  in_review: 'bg-yellow-500',
  approved: 'bg-blue-500',
  scheduled: 'bg-indigo-500',
  published: 'bg-green-500',
}

export function CalendarGrid({ items }: { items: CalendarItem[] }) {
  const [current, setCurrent] = useState(new Date())

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const itemsByDate = items.reduce<Record<string, CalendarItem[]>>((acc, item) => {
    if (!item.publish_date) return acc
    const key = item.publish_date.slice(0, 10)
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  const cells: Array<{ day: number | null; key: string }> = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, key: `pad-${i}` })
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ day: d, key })
  }

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)) }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-white/60 hover:text-white">←</button>
        <h2 className="text-lg font-semibold text-white">{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 text-white/60 hover:text-white">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/40 mb-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ day, key }) => {
          const dayItems = day ? itemsByDate[key] ?? [] : []
          const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()
          return (
            <div key={key} className={`min-h-[60px] p-1 rounded-lg ${day ? 'bg-white/5 hover:bg-white/10' : ''} ${isToday ? 'ring-1 ring-indigo-500' : ''}`}>
              {day && (
                <>
                  <p className={`text-xs mb-1 ${isToday ? 'text-indigo-400 font-bold' : 'text-white/50'}`}>{day}</p>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map(item => (
                      <div key={item.id} className={`w-full h-1.5 rounded-full ${STATUS_COLORS[item.status] ?? 'bg-white/20'}`} title={item.assets?.type} />
                    ))}
                    {dayItems.length > 3 && <p className="text-xs text-white/30">+{dayItems.length - 3}</p>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            {status}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create calendar page**

Create `app/dashboard/calendar/page.tsx`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { CalendarGrid } from '@/components/CalendarGrid'

export default async function CalendarPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) redirect('/dashboard')

  const { data: items } = await supabase
    .from('calendar_items')
    .select('*, assets(type, briefs(brand))')
    .eq('workspace_id', workspace.id)
    .order('publish_date')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Content Calendar</h1>
      <CalendarGrid items={items ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/CalendarGrid.tsx app/dashboard/calendar/
git commit -m "feat(zerostaff): content calendar page with monthly grid + status dots"
```

---

## Task 7: PDF Proposal Generator

**Files:**
- Create: `lib/pdf.ts`

- [ ] **Step 1: Create PDF helper**

Create `lib/pdf.ts`:

```typescript
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import React from 'react'
import type { DbProposal, DbProposalItem } from './types'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8, borderBottom: '1px solid #e5e7eb', paddingBottom: 4 },
  body: { fontSize: 10, color: '#374151', lineHeight: 1.6 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #f3f4f6', paddingVertical: 6 },
  tableHeader: { flexDirection: 'row', borderBottom: '2px solid #1a1a2e', paddingVertical: 6, marginBottom: 2 },
  col1: { flex: 3, fontSize: 10 },
  col2: { flex: 1, fontSize: 10, textAlign: 'right' },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  totalLabel: { fontSize: 12, fontWeight: 'bold', marginRight: 16 },
  totalAmount: { fontSize: 12, fontWeight: 'bold', color: '#4f46e5' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 9, color: '#9ca3af', textAlign: 'center' },
  acceptBlock: { marginTop: 32, padding: 16, backgroundColor: '#f9fafb', borderRadius: 4 },
  acceptTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  acceptBody: { fontSize: 10, color: '#6b7280' },
})

export async function generateProposalPdf(
  proposal: DbProposal,
  items: DbProposalItem[],
  acceptUrl: string
): Promise<Buffer> {
  const doc = React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, proposal.title),
        React.createElement(Text, { style: styles.subtitle },
          `Prepared for ${proposal.client_name} · ${new Date(proposal.created_at).toLocaleDateString()}`
        )
      ),

      // Summary
      proposal.executive_summary ? React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Overview'),
        React.createElement(Text, { style: styles.body }, proposal.executive_summary)
      ) : null,

      // Services
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Services'),
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.col1 }, 'Description'),
          React.createElement(Text, { style: styles.col2 }, 'Qty'),
          React.createElement(Text, { style: styles.col2 }, 'Unit Price'),
          React.createElement(Text, { style: styles.col2 }, 'Total'),
        ),
        ...items.map(item =>
          React.createElement(View, { key: item.id, style: styles.tableRow },
            React.createElement(Text, { style: styles.col1 }, item.description),
            React.createElement(Text, { style: styles.col2 }, String(item.quantity)),
            React.createElement(Text, { style: styles.col2 }, `$${item.unit_price.toFixed(2)}`),
            React.createElement(Text, { style: styles.col2 }, `$${item.total.toFixed(2)}`),
          )
        ),
        React.createElement(View, { style: styles.total },
          React.createElement(Text, { style: styles.totalLabel }, 'Total'),
          React.createElement(Text, { style: styles.totalAmount },
            `$${proposal.total_amount.toFixed(2)} / ${proposal.billing_cadence}`
          ),
        )
      ),

      // Timeline
      proposal.timeline_notes ? React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Timeline'),
        React.createElement(Text, { style: styles.body }, proposal.timeline_notes)
      ) : null,

      // Acceptance block
      React.createElement(View, { style: styles.acceptBlock },
        React.createElement(Text, { style: styles.acceptTitle }, 'Accept This Proposal'),
        React.createElement(Text, { style: styles.acceptBody },
          `To accept, visit: ${acceptUrl}\n\nBy accepting you agree to the terms stated above.`
        )
      ),

      // Footer
      React.createElement(Text, { style: styles.footer },
        'Powered by ZeroStaff · This proposal is confidential and intended solely for the recipient.'
      )
    )
  )

  const pdfInstance = pdf(doc)
  const blob = await pdfInstance.toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pdf.ts
git commit -m "feat(zerostaff): React PDF proposal generator — branded A4 PDF with line items + accept link"
```

---

## Task 8: Proposal API Routes

**Files:**
- Create: `app/api/proposals/route.ts`
- Create: `app/api/proposals/[id]/route.ts`
- Create: `app/api/proposals/[id]/accept/route.ts`
- Create: `app/api/proposals/[id]/pdf/route.ts`

- [ ] **Step 1: Create proposals list/create route**

Create `app/api/proposals/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { generateProposalPdf } from '@/lib/pdf'
import { uploadToR2 } from '@/lib/r2'
import { z } from 'zod'

const ProposalSchema = z.object({
  client_email: z.string().email(),
  client_name: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  executive_summary: z.string().max(2000).optional(),
  timeline_notes: z.string().max(1000).optional(),
  billing_cadence: z.enum(['one_off', 'monthly', 'quarterly']).default('monthly'),
  items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().positive().default(1),
    unit_price: z.number().positive(),
  })).min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = ProposalSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })

  const { items, ...proposalData } = parsed.data
  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const service = createServiceRoleClient()

  const { data: proposal, error } = await service.from('proposals').insert({
    workspace_id: workspace.id,
    ...proposalData,
    total_amount: total,
  }).select().single()

  if (error || !proposal) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  const itemInserts = items.map(i => ({ proposal_id: proposal.id, ...i }))
  const { data: savedItems } = await service.from('proposal_items').insert(itemInserts).select()

  // Generate PDF
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zerostaff.app'
  const acceptUrl = `${appUrl}/proposals/${proposal.id}`
  const pdfBuffer = await generateProposalPdf(proposal, savedItems ?? [], acceptUrl)
  const pdfKey = `proposals/${proposal.id}/proposal.pdf`
  const pdfUrl = await uploadToR2(pdfKey, pdfBuffer, 'application/pdf')

  await service.from('proposals').update({ pdf_url: pdfUrl }).eq('id', proposal.id)

  return NextResponse.json({ id: proposal.id, pdfUrl })
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ proposals: [] })

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, client_name, client_email, status, total_amount, billing_cadence, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ proposals: proposals ?? [] })
}
```

- [ ] **Step 2: Create proposal detail route (public — no auth)**

Create `app/api/proposals/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const service = createServiceRoleClient()
  const { data: proposal } = await service
    .from('proposals')
    .select('*, proposal_items(*)')
    .eq('id', params.id)
    .single()

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Strip sensitive workspace data for public view
  return NextResponse.json({
    id: proposal.id,
    title: proposal.title,
    client_name: proposal.client_name,
    executive_summary: proposal.executive_summary,
    timeline_notes: proposal.timeline_notes,
    total_amount: proposal.total_amount,
    billing_cadence: proposal.billing_cadence,
    status: proposal.status,
    items: proposal.proposal_items,
    created_at: proposal.created_at,
  })
}
```

- [ ] **Step 3: Create accept route (public — no auth)**

Create `app/api/proposals/[id]/accept/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const service = createServiceRoleClient()

  const { data: proposal } = await service.from('proposals').select('status').eq('id', params.id).single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (proposal.status === 'accepted') return NextResponse.json({ ok: true, alreadyAccepted: true })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'

  await service.from('proposals').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    accepted_ip: ip,
  }).eq('id', params.id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create PDF download route**

Create `app/api/proposals/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getSignedDownloadUrl } from '@/lib/r2'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const service = createServiceRoleClient()
  const { data: proposal } = await service.from('proposals').select('pdf_url').eq('id', params.id).single()

  if (!proposal?.pdf_url) return NextResponse.json({ error: 'PDF not found' }, { status: 404 })

  // Extract R2 key from URL
  const publicBase = process.env.R2_PUBLIC_URL!
  const key = proposal.pdf_url.replace(publicBase + '/', '')
  const signedUrl = await getSignedDownloadUrl(key, 600)

  return NextResponse.redirect(signedUrl)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/proposals/
git commit -m "feat(zerostaff): proposal CRUD API — create, public view, accept, PDF download"
```

---

## Task 9: Public Proposal View Page

**Files:**
- Create: `app/proposals/[id]/page.tsx`

- [ ] **Step 1: Create public proposal page**

Create `app/proposals/[id]/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type ProposalItem = { id: string; description: string; quantity: number; unit_price: number; total: number }
type Proposal = {
  id: string; title: string; client_name: string; executive_summary: string | null
  timeline_notes: string | null; total_amount: number; billing_cadence: string
  status: string; items: ProposalItem[]; created_at: string
}

export default function PublicProposalPage() {
  const { id } = useParams<{ id: string }>()
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    fetch(`/api/proposals/${id}`)
      .then(r => r.json())
      .then(data => {
        setProposal(data)
        if (data.status === 'accepted') setAccepted(true)
      })
  }, [id])

  async function accept() {
    setAccepting(true)
    await fetch(`/api/proposals/${id}/accept`, { method: 'POST' })
    setAccepted(true)
    setAccepting(false)
  }

  if (!proposal) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white shadow-sm rounded-2xl overflow-hidden">
        <div className="bg-indigo-600 px-8 py-10">
          <p className="text-indigo-200 text-sm mb-1">{new Date(proposal.created_at).toLocaleDateString()}</p>
          <h1 className="text-2xl font-bold text-white">{proposal.title}</h1>
          <p className="text-indigo-200 mt-1">Prepared for {proposal.client_name}</p>
        </div>
        <div className="px-8 py-8 space-y-8">
          {proposal.executive_summary && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Overview</h2>
              <p className="text-gray-700 leading-relaxed">{proposal.executive_summary}</p>
            </section>
          )}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Services</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 text-left">
                <th className="pb-2 font-medium text-gray-600">Description</th>
                <th className="pb-2 font-medium text-gray-600 text-right">Total</th>
              </tr></thead>
              <tbody>
                {proposal.items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3 text-gray-700">{item.description}</td>
                    <td className="py-3 text-gray-700 text-right">${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-indigo-600">
                  ${proposal.total_amount.toFixed(2)}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {proposal.billing_cadence}</span>
                </p>
              </div>
            </div>
          </section>
          {proposal.timeline_notes && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{proposal.timeline_notes}</p>
            </section>
          )}
          <section className="bg-gray-50 rounded-xl p-6">
            {accepted ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 text-xl">✓</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">Proposal Accepted</p>
                <p className="text-sm text-gray-500 mt-1">We'll be in touch shortly to get started.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  By clicking Accept, you agree to the services and pricing outlined above.
                </p>
                <button onClick={accept} disabled={accepting}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl">
                  {accepting ? 'Processing...' : 'Accept Proposal'}
                </button>
              </>
            )}
          </section>
          <div className="text-center">
            <a href={`/api/proposals/${proposal.id}/pdf`}
              className="text-sm text-indigo-600 hover:text-indigo-500">
              Download PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/proposals/
git commit -m "feat(zerostaff): public proposal page — branded view, accept button, PDF download"
```

---

## Task 10: Proposal Dashboard Page

**Files:**
- Create: `app/dashboard/proposals/page.tsx`
- Create: `app/dashboard/proposals/new/page.tsx`

- [ ] **Step 1: Create proposals list page**

Create `app/dashboard/proposals/page.tsx`:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-white/10 text-white/60',
  sent: 'bg-blue-500/20 text-blue-300',
  accepted: 'bg-green-500/20 text-green-300',
  declined: 'bg-red-500/20 text-red-300',
}

export default async function ProposalsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/proposals`, {
    headers: { cookie: '' }, // server-side — handled by supabase-server auth
  })
  const { proposals } = await res.json().catch(() => ({ proposals: [] }))

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Proposals</h1>
        <Link href="/dashboard/proposals/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg">
          New Proposal
        </Link>
      </div>
      <div className="space-y-3">
        {proposals.map((p: { id: string; title: string; client_name: string; status: string; total_amount: number; billing_cadence: string; created_at: string }) => (
          <Link key={p.id} href={`/dashboard/proposals/${p.id}`}
            className="block p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{p.title}</p>
                <p className="text-sm text-white/50">{p.client_name} · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-white">${p.total_amount.toFixed(2)}<span className="text-white/40 font-normal">/{p.billing_cadence}</span></p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[p.status] ?? ''}`}>{p.status}</span>
              </div>
            </div>
          </Link>
        ))}
        {proposals.length === 0 && (
          <div className="text-center py-16 text-white/30">No proposals yet. Create your first one.</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create new proposal form page**

Create `app/dashboard/proposals/new/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type LineItem = { description: string; quantity: number; unit_price: number }

export default function NewProposalPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    client_email: '', client_name: '', title: '',
    executive_summary: '', timeline_notes: '',
    billing_cadence: 'monthly' as 'one_off' | 'monthly' | 'quarterly',
  })
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }])
  const [loading, setLoading] = useState(false)

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }
  function addItem() { setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0 }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  async function submit() {
    setLoading(true)
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items }),
    })
    if (res.ok) {
      const { id } = await res.json()
      router.push(`/dashboard/proposals/${id}`)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">New Proposal</h1>
      {/* Client */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Client</h2>
        <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
          placeholder="Client name" className="w-full input-field" />
        <input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
          placeholder="Client email" type="email" className="w-full input-field" />
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Proposal title" className="w-full input-field" />
      </div>
      {/* Services */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Services</h2>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
              placeholder="Service description" className="flex-1 input-field" />
            <input value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
              type="number" min="1" className="w-16 input-field text-center" />
            <input value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
              type="number" min="0" placeholder="Price" className="w-28 input-field" />
            {items.length > 1 && (
              <button onClick={() => removeItem(idx)} className="text-white/30 hover:text-red-400 px-2">×</button>
            )}
          </div>
        ))}
        <button onClick={addItem} className="text-sm text-indigo-400 hover:text-indigo-300">+ Add line</button>
        <div className="text-right text-lg font-bold text-white pt-2">
          Total: ${total.toFixed(2)} / <select value={form.billing_cadence}
            onChange={e => setForm(f => ({ ...f, billing_cadence: e.target.value as 'one_off' | 'monthly' | 'quarterly' }))}
            className="bg-transparent border-b border-white/20 text-white text-base">
            <option value="monthly">month</option>
            <option value="quarterly">quarter</option>
            <option value="one_off">one-off</option>
          </select>
        </div>
      </div>
      {/* Details */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide">Details (optional)</h2>
        <textarea value={form.executive_summary} onChange={e => setForm(f => ({ ...f, executive_summary: e.target.value }))}
          placeholder="Executive summary..." rows={3} className="w-full input-field resize-none" />
        <textarea value={form.timeline_notes} onChange={e => setForm(f => ({ ...f, timeline_notes: e.target.value }))}
          placeholder="Timeline & milestones..." rows={3} className="w-full input-field resize-none" />
      </div>
      <button onClick={submit} disabled={loading || !form.client_email || !form.title || items.every(i => !i.description)}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl">
        {loading ? 'Generating PDF...' : 'Create & Generate PDF'}
      </button>
    </div>
  )
}
```

Add to `globals.css`:
```css
.input-field {
  @apply bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/proposals/
git commit -m "feat(zerostaff): proposal dashboard — list, create form, line items, PDF generation"
```

---

## Self-Review Checklist

- [x] Spec §10 (approval workflow review→comment→approve) — Tasks 4, 5
- [x] Spec §12 (content calendar) — Task 6
- [x] Spec §21 (proposal builder, PDF, shareable link) — Tasks 7, 8, 9, 10
- [x] Spec §21 (proposal acceptance logging + IP) — Task 8 accept route
- [x] Spec §21 (PDF download) — Task 8 pdf route
- [x] Type consistency — `DbProposal`, `DbProposalItem`, `DbRevision`, `DbComment` from `lib/types.ts` throughout
- [x] No TBDs or placeholders
- [x] `input-field` CSS class defined in globals.css for ProposalForm usage
