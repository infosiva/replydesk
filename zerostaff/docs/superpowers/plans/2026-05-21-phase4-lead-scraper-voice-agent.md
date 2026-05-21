# ZeroStaff Phase 4 — Lead Research Scraper + Voice Agent (Inbound + Outbound)
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add autonomous lead discovery (Apollo.io + Hunter.io + Groq enrichment), and AI voice agents via Vapi.ai for inbound client intake and outbound sales campaigns.

**Architecture:**
- Lead scraper: Agency defines ICP → Apollo.io API search → Groq enriches each lead with a personalised first-line → stored in Supabase `leads` table → pre-fills outreach templates
- Voice agent: Vapi.ai provisions phone numbers and runs agent conversations. Inbound = caller intake → transcript → lead record → optional proposal auto-draft. Outbound = campaign runner calls leads from list → logs outcomes.

**Prerequisites:** Phase 1 complete (auth, Stripe, brief flow). Phase 3 `leads` table schema and `proposals` flow are recommended before Phase 4 to enable the full inbound-to-proposal pipeline, but Phase 4 can start independently.

**New env vars needed:**
```
APOLLO_API_KEY=        # apollo.io — free 50 credits/mo
HUNTER_API_KEY=        # hunter.io — free 25 searches/mo
VAPI_API_KEY=          # vapi.ai — pay-per-minute
VAPI_PHONE_NUMBER_ID=  # provisioned inbound number
ELEVENLABS_API_KEY=    # for voice ID selection (may already exist)
```

---

## Epic 1 — Database Schema

### Task 1.1 — Lead tables migration
- [ ] Create `supabase/migrations/004_leads.sql`:
  ```sql
  create table leads (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade not null,
    name text,
    email text,
    linkedin_url text,
    company text,
    title text,
    industry text,
    enriched_first_line text,
    source text default 'manual', -- 'apollo' | 'hunter' | 'manual'
    created_at timestamptz default now()
  );

  create table lead_lists (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade not null,
    name text not null,
    icp_config jsonb not null default '{}',
    lead_count int default 0,
    created_at timestamptz default now()
  );

  create table lead_list_members (
    lead_list_id uuid references lead_lists(id) on delete cascade,
    lead_id uuid references leads(id) on delete cascade,
    primary key (lead_list_id, lead_id)
  );

  alter table leads enable row level security;
  alter table lead_lists enable row level security;
  alter table lead_list_members enable row level security;

  create policy "workspace members can manage leads"
    on leads for all using (
      workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    );

  create policy "workspace members can manage lead lists"
    on lead_lists for all using (
      workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    );

  create policy "workspace members can manage lead list members"
    on lead_list_members for all using (
      lead_list_id in (
        select id from lead_lists where workspace_id in (
          select workspace_id from workspace_members where user_id = auth.uid()
        )
      )
    );
  ```
- [ ] Apply: `npx supabase db push` (or add to migration queue)

### Task 1.2 — Voice tables migration
- [ ] Create `supabase/migrations/005_voice.sql`:
  ```sql
  create table vapi_agents (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade not null,
    vapi_agent_id text not null,
    type text not null check (type in ('inbound', 'outbound')),
    phone_number text,
    system_prompt text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  );

  create table call_logs (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade not null,
    lead_id uuid references leads(id) on delete set null,
    vapi_call_id text unique,
    type text not null check (type in ('inbound', 'outbound')),
    outcome text, -- 'answered' | 'voicemail' | 'no_answer' | 'booked' | 'declined'
    duration_secs int,
    transcript text,
    recording_url text,
    created_at timestamptz default now()
  );

  create table outbound_campaigns (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid references workspaces(id) on delete cascade not null,
    lead_list_id uuid references lead_lists(id) on delete set null,
    status text default 'pending' check (status in ('pending', 'running', 'paused', 'completed', 'failed')),
    calls_made int default 0,
    calls_answered int default 0,
    meetings_booked int default 0,
    created_at timestamptz default now(),
    completed_at timestamptz
  );

  alter table vapi_agents enable row level security;
  alter table call_logs enable row level security;
  alter table outbound_campaigns enable row level security;

  create policy "workspace members can manage vapi agents"
    on vapi_agents for all using (
      workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    );

  create policy "workspace members can view call logs"
    on call_logs for all using (
      workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    );

  create policy "workspace members can manage campaigns"
    on outbound_campaigns for all using (
      workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())
    );
  ```

---

## Epic 2 — Lead Research Scraper

### Task 2.1 — Apollo.io client lib
- [ ] Create `lib/apollo.ts`:
  ```typescript
  const APOLLO_BASE = 'https://api.apollo.io/v1'

  export interface ApolloSearchParams {
    titles?: string[]
    industries?: string[]
    companySizes?: string[] // '1,10' | '11,50' | '51,200' | '201,500' | '501,1000' | '1001,5000' | '5001,10000' | '10001+'
    geographies?: string[]
    keywords?: string[]
    limit?: number
  }

  export interface ApolloLead {
    name: string
    email: string | null
    linkedin_url: string | null
    company: string
    title: string
    industry: string
  }

  export async function searchLeads(params: ApolloSearchParams): Promise<ApolloLead[]> {
    const res = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': process.env.APOLLO_API_KEY!,
      },
      body: JSON.stringify({
        q_person_titles: params.titles ?? [],
        q_organization_industry_tag_ids: params.industries ?? [],
        q_organization_num_employees_ranges: params.companySizes ?? [],
        person_locations: params.geographies ?? [],
        q_keywords: params.keywords?.join(' ') ?? '',
        per_page: Math.min(params.limit ?? 25, 100),
        page: 1,
      }),
    })
    if (!res.ok) throw new Error(`Apollo error: ${res.status}`)
    const data = await res.json()
    return (data.people ?? []).map((p: any) => ({
      name: p.name,
      email: p.email ?? null,
      linkedin_url: p.linkedin_url ?? null,
      company: p.organization?.name ?? '',
      title: p.title ?? '',
      industry: p.organization?.industry ?? '',
    }))
  }
  ```

### Task 2.2 — Hunter.io fallback client
- [ ] Create `lib/hunter.ts`:
  ```typescript
  const HUNTER_BASE = 'https://api.hunter.io/v2'

  export async function findEmailByDomain(domain: string, limit = 10): Promise<{ name: string; email: string; title: string }[]> {
    const url = new URL(`${HUNTER_BASE}/domain-search`)
    url.searchParams.set('domain', domain)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('api_key', process.env.HUNTER_API_KEY!)
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`Hunter error: ${res.status}`)
    const data = await res.json()
    return (data.data?.emails ?? []).map((e: any) => ({
      name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      email: e.value,
      title: e.position ?? '',
    }))
  }
  ```

### Task 2.3 — Groq enrichment (first-line personalisation)
- [ ] Create `lib/lead-enrichment.ts`:
  ```typescript
  import Groq from 'groq-sdk'
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  export async function enrichLeadFirstLine(lead: {
    name: string
    title: string
    company: string
    industry: string
  }): Promise<string> {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You write personalised cold outreach openers. One sentence, max 20 words. Natural, not salesy. Reference their role/company specifically.',
        },
        {
          role: 'user',
          content: `Name: ${lead.name}, Title: ${lead.title}, Company: ${lead.company}, Industry: ${lead.industry}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.7,
    })
    return res.choices[0].message.content?.trim() ?? ''
  }
  ```

### Task 2.4 — Lead scrape API route
- [ ] Create `app/api/leads/scrape/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { searchLeads } from '@/lib/apollo'
  import { enrichLeadFirstLine } from '@/lib/lead-enrichment'

  export async function POST(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { workspace_id, icp, list_name } = body as {
      workspace_id: string
      list_name: string
      icp: {
        titles?: string[]
        industries?: string[]
        companySizes?: string[]
        geographies?: string[]
        keywords?: string[]
        limit?: number
      }
    }

    // Tier check — Pro: 50/mo, Agency: 500/mo
    // TODO: implement usage counter check against workspace subscription

    // Scrape
    const leads = await searchLeads(icp)

    // Enrich in parallel (batch 5 at a time to avoid Groq rate limit)
    const enriched = []
    for (let i = 0; i < leads.length; i += 5) {
      const batch = leads.slice(i, i + 5)
      const results = await Promise.all(batch.map(l => enrichLeadFirstLine(l)))
      batch.forEach((l, idx) => enriched.push({ ...l, enriched_first_line: results[idx] }))
    }

    // Create lead list
    const { data: list, error: listErr } = await supabase
      .from('lead_lists')
      .insert({ workspace_id, name: list_name, icp_config: icp, lead_count: enriched.length })
      .select()
      .single()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    // Insert leads
    const rows = enriched.map(l => ({
      workspace_id,
      name: l.name,
      email: l.email,
      linkedin_url: l.linkedin_url,
      company: l.company,
      title: l.title,
      industry: l.industry,
      enriched_first_line: l.enriched_first_line,
      source: 'apollo',
    }))
    const { data: inserted, error: insertErr } = await supabase
      .from('leads')
      .insert(rows)
      .select('id')
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Link to list
    await supabase.from('lead_list_members').insert(
      inserted.map(l => ({ lead_list_id: list.id, lead_id: l.id }))
    )

    return NextResponse.json({ list_id: list.id, leads_created: inserted.length })
  }
  ```

### Task 2.5 — List leads + export routes
- [ ] Create `app/api/leads/route.ts` — GET with pagination:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'

  export async function GET(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const workspace_id = searchParams.get('workspace_id')!
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '25')
    const list_id = searchParams.get('list_id')

    let query = supabase.from('leads').select('*', { count: 'exact' }).eq('workspace_id', workspace_id)
    if (list_id) {
      const { data: members } = await supabase.from('lead_list_members').select('lead_id').eq('lead_list_id', list_id)
      const ids = members?.map(m => m.lead_id) ?? []
      query = query.in('id', ids)
    }
    const { data, count, error } = await query
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leads: data, total: count, page, limit })
  }
  ```

- [ ] Create `app/api/leads/export/route.ts` — CSV download:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'

  export async function GET(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const workspace_id = searchParams.get('workspace_id')!

    const { data } = await supabase.from('leads').select('*').eq('workspace_id', workspace_id)
    const header = 'Name,Email,LinkedIn,Company,Title,Industry,First Line'
    const rows = (data ?? []).map(l =>
      [l.name, l.email, l.linkedin_url, l.company, l.title, l.industry, `"${(l.enriched_first_line ?? '').replace(/"/g, '""')}"`].join(',')
    )
    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="leads.csv"',
      },
    })
  }
  ```

### Task 2.6 — Lead Research UI
- [ ] Create `app/(dashboard)/leads/page.tsx` — Lead list manager:
  - Sidebar nav item: "Leads" (under Outreach)
  - Left panel: list of lead lists with lead count + created date
  - Right panel: table of leads for selected list
    - Columns: Name, Title, Company, Email (masked if no email), First Line, Actions
  - Top toolbar: "New Lead Research" button → opens scraper form modal
  - Scraper form modal (`components/leads/ScrapeModal.tsx`):
    - List name input
    - ICP fields: Job Titles (tag input), Industries (tag input), Company Size (checkboxes: 1-10, 11-50, 51-200, 201-1000, 1001+), Geography (tag input), Keywords (tag input)
    - Lead limit: 25 / 50 / 100 (gated by tier)
    - Submit → loading spinner with "Researching leads..." → shows count on complete
  - Export CSV button (Agency tier only — locked with upgrade prompt otherwise)
  - "Use in Outreach" button per lead → copies first-line + pre-fills message composer

---

## Epic 3 — Voice Agent (Inbound + Outbound)

### Task 3.1 — Vapi.ai client lib
- [ ] `npm install @vapi-ai/server-sdk` (or use raw fetch — Vapi has a REST API)
- [ ] Create `lib/vapi.ts`:
  ```typescript
  const VAPI_BASE = 'https://api.vapi.ai'
  const headers = () => ({
    Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    'Content-Type': 'application/json',
  })

  export interface VapiAgentConfig {
    name: string
    firstMessage: string
    systemPrompt: string
    voiceId?: string // ElevenLabs voice ID
    modelProvider?: 'groq' | 'openai' // default groq
    modelId?: string // e.g. 'llama-3.3-70b-versatile'
  }

  export async function createVapiAssistant(config: VapiAgentConfig) {
    const res = await fetch(`${VAPI_BASE}/assistant`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: config.name,
        firstMessage: config.firstMessage,
        transcriber: { provider: 'deepgram', model: 'nova-2' },
        model: {
          provider: config.modelProvider ?? 'groq',
          model: config.modelId ?? 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: config.systemPrompt }],
        },
        voice: config.voiceId
          ? { provider: 'elevenlabs', voiceId: config.voiceId }
          : { provider: 'playht', voice: 'jennifer' },
        endCallFunctionEnabled: true,
        recordingEnabled: true,
      }),
    })
    return res.json()
  }

  export async function createPhoneCallOutbound(params: {
    assistantId: string
    phoneNumber: string // E.164 format
    fromNumber: string
  }) {
    const res = await fetch(`${VAPI_BASE}/call/phone`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        assistantId: params.assistantId,
        customer: { number: params.phoneNumber },
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      }),
    })
    return res.json()
  }

  export async function getCallTranscript(callId: string) {
    const res = await fetch(`${VAPI_BASE}/call/${callId}`, { headers: headers() })
    const data = await res.json()
    return { transcript: data.transcript, recording_url: data.recordingUrl, duration: data.duration }
  }
  ```

### Task 3.2 — Inbound agent setup route
- [ ] Create `app/api/voice/agents/route.ts` — create or update inbound Vapi agent for workspace:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { createVapiAssistant } from '@/lib/vapi'

  export async function POST(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspace_id, system_prompt, voice_id, agency_name } = await req.json()

    const assistant = await createVapiAssistant({
      name: `${agency_name} Intake Agent`,
      firstMessage: `Hi, thanks for calling ${agency_name}. I'm an AI assistant — I can gather some quick details and book you a meeting with the team. What's your name?`,
      systemPrompt: system_prompt,
      voiceId: voice_id,
    })

    await supabase.from('vapi_agents').upsert({
      workspace_id,
      vapi_agent_id: assistant.id,
      type: 'inbound',
      phone_number: process.env.VAPI_PHONE_NUMBER,
      system_prompt,
    }, { onConflict: 'workspace_id,type' })

    return NextResponse.json({ agent_id: assistant.id, phone: process.env.VAPI_PHONE_NUMBER })
  }
  ```

### Task 3.3 — Vapi webhook receiver
- [ ] Create `app/api/voice/webhook/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { Resend } from 'resend'

  const resend = new Resend(process.env.RESEND_API_KEY)

  export async function POST(req: NextRequest) {
    const event = await req.json()
    const supabase = createClient()

    if (event.type === 'call-ended') {
      const call = event.call
      // Find workspace by phone number or vapi_agent_id
      const { data: agent } = await supabase
        .from('vapi_agents')
        .select('workspace_id')
        .eq('vapi_agent_id', call.assistantId)
        .single()

      if (!agent) return NextResponse.json({ ok: true })

      // Store call log
      const { data: log } = await supabase.from('call_logs').insert({
        workspace_id: agent.workspace_id,
        vapi_call_id: call.id,
        type: call.type === 'inboundPhoneCall' ? 'inbound' : 'outbound',
        outcome: call.endedReason ?? 'ended',
        duration_secs: Math.round(call.duration ?? 0),
        transcript: call.transcript ?? '',
        recording_url: call.recordingUrl ?? null,
      }).select().single()

      // For inbound calls — create lead record from transcript
      if (call.type === 'inboundPhoneCall' && call.transcript) {
        // Groq extract lead data from transcript
        // TODO: call extractLeadFromTranscript(transcript) → upsert into leads
      }

      // Notify agency via email
      // TODO: fetch workspace owner email → send Resend summary email

      // Update outbound campaign if applicable
      if (call.metadata?.campaign_id) {
        await supabase.rpc('increment_campaign_calls', {
          p_campaign_id: call.metadata.campaign_id,
          p_answered: call.endedReason === 'customer-ended-call' ? 1 : 0,
        })
      }
    }

    return NextResponse.json({ ok: true })
  }
  ```

### Task 3.4 — Outbound campaign runner
- [ ] Create `app/api/voice/outbound/campaign/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'
  import { createPhoneCallOutbound } from '@/lib/vapi'

  export async function POST(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { workspace_id, lead_list_id } = await req.json()

    // Get outbound agent for workspace
    const { data: agent } = await supabase
      .from('vapi_agents')
      .select('vapi_agent_id')
      .eq('workspace_id', workspace_id)
      .eq('type', 'outbound')
      .single()
    if (!agent) return NextResponse.json({ error: 'No outbound agent configured' }, { status: 400 })

    // Get leads in list with phone numbers
    // Note: Apollo sometimes returns mobile numbers — need `phone` field in leads table
    const { data: members } = await supabase
      .from('lead_list_members')
      .select('leads(id, name, email, phone)')
      .eq('lead_list_id', lead_list_id)
    const leads = members?.map((m: any) => m.leads).filter(l => l?.phone) ?? []

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No leads with phone numbers in this list' }, { status: 400 })
    }

    // Create campaign record
    const { data: campaign } = await supabase.from('outbound_campaigns').insert({
      workspace_id,
      lead_list_id,
      status: 'running',
    }).select().single()

    // Queue calls (fire-and-forget, rate-limited 10/hr)
    // For simplicity in v1: queue via Upstash QStash or just call serially with 6s delay
    // Production: use QStash scheduled delivery
    const errors: string[] = []
    for (const lead of leads.slice(0, 10)) { // cap at 10 for v1
      try {
        await createPhoneCallOutbound({
          assistantId: agent.vapi_agent_id,
          phoneNumber: lead.phone,
          fromNumber: process.env.VAPI_PHONE_NUMBER!,
        })
      } catch (e: any) {
        errors.push(`${lead.name}: ${e.message}`)
      }
    }

    return NextResponse.json({
      campaign_id: campaign.id,
      calls_queued: leads.length - errors.length,
      errors,
    })
  }
  ```

### Task 3.5 — Call logs API
- [ ] Create `app/api/voice/logs/route.ts` — GET call logs with transcript:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { createClient } from '@/lib/supabase/server'

  export async function GET(req: NextRequest) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const workspace_id = searchParams.get('workspace_id')!
    const type = searchParams.get('type') // 'inbound' | 'outbound' | null

    let query = supabase.from('call_logs').select('*').eq('workspace_id', workspace_id)
    if (type) query = query.eq('type', type)
    const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ logs: data })
  }
  ```

### Task 3.6 — Transcript extractor (Groq)
- [ ] Create `lib/transcript-extract.ts` — extract lead info from inbound call transcript:
  ```typescript
  import Groq from 'groq-sdk'
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  export interface ExtractedLead {
    name?: string
    company?: string
    industry?: string
    budget_range?: string
    timeline?: string
    needs_summary?: string
  }

  export async function extractLeadFromTranscript(transcript: string): Promise<ExtractedLead> {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Extract lead details from this call transcript. Return JSON only with keys: name, company, industry, budget_range, timeline, needs_summary. Use null for unknown fields.',
        },
        { role: 'user', content: transcript },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    })
    return JSON.parse(res.choices[0].message.content ?? '{}')
  }
  ```
- [ ] Wire into `app/api/voice/webhook/route.ts` inbound call handler

---

## Epic 4 — Voice Agent UI

### Task 4.1 — Voice settings page
- [ ] Create `app/(dashboard)/voice/page.tsx`:
  - Two tabs: "Inbound Agent" and "Outbound Campaigns"

### Task 4.2 — Inbound agent setup form
- [ ] `app/(dashboard)/voice/inbound/page.tsx`:
  - Phone number display (provisioned Vapi number)
  - System prompt textarea: "Describe your offer, pricing, FAQs the agent should know"
  - Voice selector: 4–6 preset ElevenLabs voices with audio preview clips
  - Save button → POST /api/voice/agents
  - Status chip: Active / Not configured
  - Recent inbound calls table: caller number, duration, outcome, "View Transcript" button

### Task 4.3 — Transcript viewer modal
- [ ] `components/voice/TranscriptModal.tsx`:
  - Full call transcript, speaker-labelled (Agent / Caller)
  - Recording playback (`<audio>` tag if recording_url present)
  - Extracted lead info panel: name, company, needs summary
  - "Create Lead" button → POST /api/leads (manual insert from transcript data)

### Task 4.4 — Outbound campaigns list
- [ ] `app/(dashboard)/voice/outbound/page.tsx`:
  - Campaign cards: name, status, calls made, answered, meetings booked
  - "New Campaign" button → opens campaign launcher modal
  - Campaign launcher modal (`components/voice/CampaignModal.tsx`):
    - Lead list selector (from existing lead lists)
    - Call limit: 10 / 50 / 100 (gated by tier)
    - Start button → POST /api/voice/outbound/campaign
    - Live progress via Supabase Realtime subscribe to `outbound_campaigns` row

### Task 4.5 — Outbound agent configurator
- [ ] `app/(dashboard)/voice/outbound/setup/page.tsx`:
  - Agency name + offer description (used in call script)
  - Pitch generator: "Generate script from offer description" → Groq → editable textarea
  - Voice selector (same as inbound)
  - Save → POST /api/voice/agents (type: outbound)

---

## Epic 5 — Tier Gating

### Task 5.1 — Usage counters
- [ ] Add `leads_scraped_this_month` counter to workspace subscription tracking (Supabase function or simple count query)
- [ ] Middleware check in `/api/leads/scrape`:
  - Free: block entirely
  - Pro: allow up to 50/mo
  - Agency: allow up to 500/mo
- [ ] Middleware check in `/api/voice/outbound/campaign`:
  - Free/Pro: block (return 403 with upgrade message)
  - Agency: allow up to 500 calls/mo

### Task 5.2 — Upgrade prompts in UI
- [ ] Disable "New Lead Research" on Free tier — show "Upgrade to Pro" tooltip
- [ ] Disable "Export CSV" on Pro tier — show "Agency tier required"
- [ ] Disable Voice tab entirely on Free/Pro — show "Agency tier required" badge with pricing

---

## Epic 6 — Supabase DB Functions

### Task 6.1 — increment_campaign_calls RPC
- [ ] Add to migration:
  ```sql
  create or replace function increment_campaign_calls(
    p_campaign_id uuid,
    p_answered int
  ) returns void as $$
  begin
    update outbound_campaigns
    set calls_made = calls_made + 1,
        calls_answered = calls_answered + p_answered
    where id = p_campaign_id;
  end;
  $$ language plpgsql security definer;
  ```

---

## Epic 7 — Env Var Setup

### Task 7.1 — Local env
- [ ] Add to `zerostaff/.env.local`:
  ```
  APOLLO_API_KEY=
  HUNTER_API_KEY=
  VAPI_API_KEY=
  VAPI_PHONE_NUMBER_ID=
  VAPI_PHONE_NUMBER=
  ```

### Task 7.2 — Vercel env
- [ ] Add same vars to Vercel project via `npx vercel env add` or dashboard
- [ ] Add to `VAPI_WEBHOOK_SECRET` if Vapi supports webhook signing (verify in docs)
- [ ] Add `VAPI_WEBHOOK_URL` = `https://zerostaff.app/api/voice/webhook` in Vapi dashboard

---

## Epic 8 — Sidebar Nav Updates

### Task 8.1 — Add nav items
- [ ] Edit `components/layout/Sidebar.tsx` (or equivalent nav component):
  - Add "Leads" nav item under "Outreach" section
  - Add "Voice" nav item under "Outreach" section (with "Agency" badge)
- [ ] Add both routes to `middleware.ts` protected routes list

---

## Success Criteria

### Lead Scraper
- [ ] POST /api/leads/scrape returns leads with enriched first-line in < 30s for 25 leads
- [ ] Leads visible in dashboard table
- [ ] CSV export downloads valid file
- [ ] Tier limits enforced (Free = blocked, Pro = 50 cap)

### Voice — Inbound
- [ ] Inbound agent configured and shows phone number in settings
- [ ] Vapi webhook receives call-ended event and stores call_log row
- [ ] Transcript visible in dashboard modal
- [ ] Lead auto-created from inbound call transcript

### Voice — Outbound
- [ ] Outbound agent configured with custom pitch
- [ ] Campaign launches and calls first lead
- [ ] Call outcome logged in call_logs
- [ ] Campaign progress visible in real-time

---

## Build Order

1. Epic 1 (DB migrations) — always first
2. Epic 2 (lead scraper) — self-contained, can ship independently
3. Epic 6 (DB functions) — needed before outbound campaign tracking
4. Epic 3 (voice routes) — after migrations
5. Epic 4 (voice UI) — after routes
6. Epic 5 (tier gating) — final pass before prod
7. Epic 7 + 8 (env + nav) — throughout

**Estimated scope:** ~5 days engineering (solo), 2-3 days with parallel agents.
