# ZeroStaff — AI Automation Agency Platform Design Spec

**Date:** 2026-05-20  
**Status:** Approved — expanded to full Agency OS

---

## 1. Product Vision

One brief in → 8 content assets out. Zero employees. Full agency operating system: content generation, client onboarding, approval workflows, invoicing, in-portal email, content calendar, lead gen — everything an agency needs to run clients without hiring.

Market gap: no platform combines end-to-end content generation (text + real MP3 + real faceless video) with a white-label client OS and lead gen deliverables at sub-$200/mo. GoHighLevel = $497+/mo, no content gen, no podcast, no video.

---

## 2. Platform Model

Hybrid (Direction C — own agency + SaaS reseller):
- **Layer A — Own Agency:** Run ZeroStaff as content agency. Direct clients pay $500–2k/mo retainers. Platform auto-delivers. Zero hires.
- **Layer B — SaaS Reseller:** Other agencies/freelancers subscribe ($99–199/mo) to white-label ZeroStaff. They bring clients. Two revenue streams, one codebase.

Lead gen is a deliverable: platform auto-generates LinkedIn outreach sequences, cold email campaigns, and lead magnet copy in every content package. Agencies run outbound on behalf of clients.

---

## 3. Content Engine — 8 Outputs Per Brief

Input: one content brief (topic, brand profile, audience, tone, keywords).

| # | Output | How Generated | Tier |
|---|--------|--------------|------|
| 1 | SEO Blog Post (1,200 words) | Groq llama-3.3-70b | Free+ |
| 2 | Podcast MP3 | Groq (script) → ElevenLabs TTS | Pro+ |
| 3 | Faceless Video | Groq (storyboard) → fal.ai Kling | Pro+ |
| 4 | LinkedIn Posts (3 angles) | Groq | Free+ |
| 5 | Email Sequence (5-email nurture) | Groq | Pro+ |
| 6 | Short Clips / TikTok Captions (10) | Groq | Pro+ |
| 7 | Lead Gen Pack (DM + cold email + LinkedIn outreach) | Groq | Pro+ |
| 8 | Client Report (strategy + content calendar) | Groq | Pro+ |

Free tier: outputs 1 + 4 only, watermarked report.

---

## 4. Architecture — 3 Layers

### Layer 1 — Intake
- Brief form (topic, brand profile, audience targeting, tone/style config)
- Client onboarding form (brand questionnaire, asset upload, ICP definition)
- Brand profile saved per workspace, reused across briefs
- Google Drive MCP: clients attach brand assets (logo, style guide, past content) directly from Drive

### Layer 2 — Engine (async job queue)
- Submit brief → enqueue 7–8 parallel jobs via Upstash QStash
- Each job: Groq text gen → optional ElevenLabs TTS → optional fal.ai video
- Progress streamed to frontend via Supabase Realtime
- Generated files (MP3, video) uploaded to Cloudflare R2
- Results saved to Supabase with signed download URLs

### Layer 3 — Delivery (Agency OS)
- **Creator Dashboard** — brief submission, job progress, download center
- **Client Portal (white-label)** — branded subdomain, approval workflow, messaging, calendar
- **Agency OS** — sub-account management, run-on-behalf, client billing, invoicing
- **Email System** — full send/receive in-portal (Resend API + inbound webhook)

---

## 5. Generation Pipeline

```
Brief submitted
  → 7-8 parallel jobs queued (Upstash QStash)
    → Groq generates all text assets in parallel
    → ElevenLabs converts podcast script → MP3 (Pro+)
    → fal.ai Kling renders video scenes (Pro+)
  → Assets uploaded to R2
  → DB updated, Supabase Realtime notifies frontend
  → Client notified via in-portal email (Resend)
  → Download links served + approval workflow triggered
```

Typical turnaround: text < 30s, MP3 < 60s, video 3–5 min.

---

## 6. User Tiers & Pricing

| Tier | Price | Briefs | Outputs | Agency OS Features |
|------|-------|--------|---------|-------------------|
| Free | $0/mo | 2/mo | Text only (blog + LinkedIn) | Watermarked report |
| Pro | $99/mo | 20/mo | All 8 (real MP3 + video) | Lead gen, client portal, email, calendar |
| Agency | $199/mo | Unlimited | All 8 | White-label, sub-accounts, run-on-behalf, API, custom domain, invoicing, team roles |

---

## 7. White-Label & Agency OS

Agency tier unlocks:
- **Sub-accounts:** Each client = own workspace. Agency sees all from master account.
- **Run-on-behalf:** Agency submits briefs under client brand profile.
- **White-label portal:** `content.agencyname.com` — no ZeroStaff branding visible.
- **Custom domain:** CNAME mapping per client portal.
- **API access:** Programmatic brief submission + result webhooks.
- **Team roles:** Owner → Manager → Editor → Viewer. Assign team members per client workspace.

---

## 8. Lead Gen as Deliverable

Every Pro/Agency brief generates a Lead Gen Pack:
- 5 LinkedIn connection message variants (targeted to client's ICP)
- 3 cold email templates (personalized to ICP + offer)
- 1 lead magnet CTA copy block
- 5-step DM follow-up sequence
- AI-generated pitch deck outline (1-pager, export as PDF)

Agencies run outbound for clients — ZeroStaff writes all copy, agency sends via their CRM or manually.

---

## 9. Client Onboarding System

Full onboarding flow when agency adds a new client:

1. **Invite client** — agency sends branded invite email (Resend)
2. **Brand questionnaire** — client fills: company name, ICP, tone, competitors, offer, goals
3. **Asset upload** — logo, brand colors, style guide, sample content (direct upload or Google Drive link)
4. **Brief template** — system auto-generates a suggested brief template from questionnaire answers
5. **Retainer setup** — agency sets monthly price, Stripe recurring invoice auto-created
6. **Portal provisioned** — white-labeled subdomain live within minutes

---

## 10. Client Approval Workflow

Every generated content package goes through approval before client can download:

```
Content generated → Status: "Awaiting Review"
  → Agency reviews first (optional internal review step)
  → Client notified by email: "Your content is ready for review"
  → Client logs into portal, views each asset
  → Client leaves inline comments per asset (or bulk approve)
  → Agency responds to comments in portal thread
  → Client clicks "Approve" → Download unlocks
  → Status: "Approved — {date}"
  → Agency receives notification
```

Revision tracking: each round of feedback timestamped, stored in `revisions` table.

---

## 11. In-Portal Email System (Send + Receive)

Full transactional + conversational email, all within the portal. No external email client needed.

### Outbound (Send)
- **Provider:** Resend API (transactional email, custom domain sending)
- **Sending domain:** `mail.zerostaff.app` default, or `mail.agencyname.com` (Agency tier with custom domain)
- **Triggered emails (automated):**
  - Client invite
  - Content ready for review
  - Content approved / changes requested
  - Invoice generated / payment received / overdue reminder
  - Monthly content report
  - Brief submitted confirmation
  - New message in portal thread

### Inbound (Receive)
- **Provider:** Resend inbound webhooks (or Postmark inbound)
- **Flow:** Client replies to any notification email → reply captured via inbound webhook → stored as message in portal thread → agency notified in dashboard
- **Email-to-thread routing:** Each email has `Reply-To: thread-{threadId}@mail.zerostaff.app` → inbound parses `threadId` from address → appends to correct thread

### In-Portal Messaging
- Every project/brief has a messaging thread (like Basecamp / Linear comments)
- Agency and client both post in thread
- Email notification on each new message (Resend)
- Client replies via email or portal — both work
- Attachments supported (uploaded to R2, linked in thread)

### Data model additions:
- `threads` — workspace_id, brief_id (nullable for general), subject
- `messages` — thread_id, sender_id, body, attachments[], source (portal | email), created_at
- `email_addresses` — workspace custom inbound addresses

---

## 12. Content Calendar & Publishing Queue

Visual calendar per client workspace:

- All approved content plotted on calendar by type (blog, podcast, video, social)
- Agency sets publish dates per asset
- Status per asset: Draft → In Review → Approved → Scheduled → Published
- **Google Calendar MCP sync:** Push content calendar events to client's Google Calendar (Agency tier)
- **Export:** Download full calendar as CSV or PDF for client handoff
- No direct social publishing (v1) — calendar is a planning/coordination tool

---

## 13. Invoicing & Retainer Billing

Agency tier: full invoicing system for billing their own clients (separate from what agency pays ZeroStaff).

### Retainer invoices (recurring)
- Agency sets monthly retainer amount per client workspace
- Stripe Billing creates recurring invoice automatically
- Client pays via Stripe-hosted invoice link (card or bank)
- Payment status synced back to portal: Paid / Overdue / Pending
- Agency sees revenue dashboard: MRR, per-client billing, overdue list

### One-off project invoices
- Agency creates ad-hoc invoice: line items, amount, due date
- PDF invoice auto-generated (React PDF or Puppeteer)
- Sent to client via in-portal email (Resend)
- Client pays via Stripe link embedded in email

### ZeroStaff's own billing (what agency pays)
- Stripe subscriptions: Free / Pro $99 / Agency $199
- Usage metering for ElevenLabs + fal.ai costs (pass-through or absorbed)

---

## 14. Analytics & Reporting

### For agencies (dashboard)
- Total briefs generated this month
- Output breakdown (blog/podcast/video/social per client)
- Client activity (last login, pending approvals, overdue reviews)
- Revenue: MRR from retainer clients, outstanding invoices
- Lead gen pack usage (how many outbound emails sent, DMs logged)

### For clients (in portal)
- Monthly auto-generated content report (Groq-written, PDF export)
- Content calendar view
- Download history
- Approval history

---

## 15. Tech Stack (expanded)

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Tailwind CSS |
| Text AI | Groq llama-3.3-70b-versatile (free) + fallback chain |
| Audio | ElevenLabs TTS API |
| Video | fal.ai Kling v1.5 pro (text-to-video) |
| Database + Auth | Supabase (Postgres + RLS + Realtime + Storage) |
| Job Queue | Upstash QStash (serverless async jobs) |
| File Storage | Cloudflare R2 (MP3, video, brand assets, attachments) |
| Email (outbound) | Resend API (transactional, custom domain) |
| Email (inbound) | Resend inbound webhooks → thread routing |
| PDF generation | @react-pdf/renderer (invoices, reports) |
| Calendar sync | Google Calendar MCP (Agency tier) |
| File attach (onboarding) | Google Drive MCP (brand asset import) |
| Billing — ZeroStaff subs | Stripe Subscriptions |
| Billing — client invoicing | Stripe Billing + Invoices API |
| Deploy | Vercel |
| AI Fallback Chain | Groq → Gemini → Cerebras → Anthropic |

---

## 16. Data Model (Supabase — full)

**Core:**
- `users` — id, email, tier, stripe_customer_id, role
- `workspaces` — id, name, agency_id, brand_profile (jsonb), onboarding_complete
- `brand_profiles` — workspace_id, logo_url, colors, tone, icp, competitors, offer

**Content:**
- `briefs` — id, workspace_id, topic, tone, keywords, status, created_at
- `jobs` — id, brief_id, type, status, result_url, error, created_at
- `assets` — id, brief_id, type, file_url, download_count, approved_at

**Approval:**
- `revisions` — id, asset_id, round, status (pending/approved/changes), created_at
- `comments` — id, asset_id, revision_id, author_id, body, resolved

**Messaging:**
- `threads` — id, workspace_id, brief_id, subject, created_at
- `messages` — id, thread_id, sender_id, body, source (portal|email), attachments[], created_at

**Calendar:**
- `calendar_items` — id, asset_id, workspace_id, publish_date, status, platform

**Billing:**
- `invoices` — id, workspace_id, amount, status, stripe_invoice_id, due_date, paid_at
- `retainers` — id, workspace_id, monthly_amount, stripe_subscription_id, active

**RLS rules:**
- Users see only their workspace(s)
- Agency master accounts see all sub-workspace data
- Clients (portal login) see only their own workspace assets/threads/calendar

---

## 17. UI Screens (full list)

**Agency dashboard:**
1. Brief submission form (progressive disclosure)
2. Generation progress (live tiles per job)
3. Results / download center
4. Client workspace list (Agency OS home)
5. Client onboarding wizard
6. Content calendar (per client or all clients)
7. Messaging inbox (all threads)
8. Invoicing (retainers + one-off)
9. Analytics / revenue dashboard
10. Settings (brand, API keys, billing, team, domain)

**Client portal (white-labeled):**
1. Content package view (review + approve per asset)
2. Comment thread per asset
3. Content calendar
4. Invoice / payment history
5. Messaging thread
6. Brand profile (client fills onboarding questionnaire)

---

## 18. Phased Build Order

### Phase 1 — Core Engine
- Next.js 15 scaffold at `agents/zerostaff/`
- Supabase schema (users, workspaces, briefs, jobs, assets)
- Brief form → Groq parallel text gen → results page
- Download center (text outputs)
- Stripe Free + Pro tiers

### Phase 2 — Real Media + Email
- ElevenLabs TTS → podcast MP3
- fal.ai Kling → faceless video
- R2 file storage + signed URLs
- Upstash QStash + Supabase Realtime progress
- Resend outbound email (notifications)
- Resend inbound webhooks → thread routing
- In-portal messaging threads

### Phase 3 — Client Approval + Calendar
- Approval workflow (review → comment → approve)
- Content calendar with status tracking
- Google Calendar MCP sync (Agency tier)
- Google Drive MCP (brand asset import)
- PDF client report generation

### Phase 4 — Full Agency OS
- Sub-accounts + white-label portal
- Custom domain (CNAME)
- Run-on-behalf mode
- Client onboarding wizard
- Retainer invoicing (Stripe Billing)
- One-off PDF invoices (React PDF + Resend)
- Team roles + permissions
- Revenue analytics dashboard
- API access + webhooks
- Agency tier billing

---

## 19. Out of Scope (v1)

- Direct social scheduling/publishing (calendar is planning only)
- Voice cloning (ElevenLabs standard voices only)
- Video editing UI (fal.ai output is final)
- Multi-language content generation
- Native mobile app

---

## 20. Lead Research Scraper

Autonomous lead discovery pipeline — finds prospects matching the client's ICP, enriches them, and pre-fills outreach templates.

### Flow
1. Agency defines ICP per workspace: industry, title, company size, geography, keywords
2. Scraper runs on demand or scheduled (weekly):
   - **Apollo.io API** (primary) — search by title + industry + company size → returns name, email, LinkedIn URL, company, role
   - **Hunter.io** (fallback) — domain-based email finder
   - **Phantombuster** (optional, agency tier) — LinkedIn profile scraper for deeper enrichment
3. Results stored in `leads` table per workspace
4. AI enrichment pass (Groq): write personalised first-line for each lead based on their role + company
5. Auto-fill outreach templates: DM copy, cold email, LinkedIn connection message — pre-populated per lead
6. Export: CSV download or push to client's outreach tool (Instantly.ai webhook, optional)

### Data model additions
- `leads` — id, workspace_id, name, email, linkedin_url, company, title, industry, enriched_first_line, created_at, source
- `lead_lists` — id, workspace_id, name, icp_config (jsonb), created_at, lead_count

### Tier gating
- Free: 0 (manual only, no scraper)
- Pro: 50 leads/mo
- Agency: 500 leads/mo + scheduled scraping + CSV export + webhook push

### API routes
- `POST /api/leads/scrape` — triggers scrape for workspace ICP
- `GET /api/leads` — list leads with pagination
- `POST /api/leads/enrich` — AI first-line enrichment pass
- `GET /api/leads/export` — CSV download

---

## 21. Quote & Proposal Builder

Pre-sale document workflow: agency builds a branded proposal, client approves online, deal converts to retainer.

### Flow
1. Agency creates proposal: client name, services offered, pricing table, timeline, terms
2. System generates PDF (React PDF) — agency logo, brand colors, structured sections
3. Agency sends proposal link (Resend) — unique shareable URL, no login required for client
4. Client views proposal in browser (read-only branded view), clicks "Accept Proposal"
5. Acceptance logged with timestamp + IP
6. On acceptance: system optionally auto-creates retainer invoice (Stripe recurring) and provisions client workspace
7. Agency notified via email + dashboard alert

### Proposal sections
- Cover: agency name, client name, date, proposal title
- Executive summary (Groq-generated from brief if desired, editable)
- Services scope: line items with description + price
- Timeline: milestone table
- Pricing summary: subtotal, discount, total, billing cadence
- Terms & conditions (free-text, templated)
- Acceptance block: "I accept this proposal" button + name field

### Data model additions
- `proposals` — id, workspace_id, client_email, title, status (draft/sent/accepted/declined), accepted_at, created_at
- `proposal_items` — id, proposal_id, description, quantity, unit_price, total
- `proposal_terms` — proposal_id, body (free text)

### Tier gating
- Pro: 5 proposals/mo
- Agency: unlimited proposals + custom terms template + Stripe auto-conversion on acceptance

### API routes
- `POST /api/proposals` — create proposal
- `GET /api/proposals/:id/view` — public proposal view (no auth)
- `POST /api/proposals/:id/accept` — record acceptance
- `GET /api/proposals/:id/pdf` — download PDF

---

## 22. Voice Agent (Inbound + Outbound)

AI-powered voice agent for client intake (inbound) and lead outreach (outbound).

**Provider:** Vapi.ai (primary) — programmable voice AI, tool calls, custom LLM, call recording.

### 22a — Inbound Intake Agent

Handles inbound calls from prospective clients visiting the agency's site or calling a listed number.

**Number provisioning:** Vapi buys/assigns a US phone number per agency workspace (Agency tier). Published on agency's site + landing page.

**Call flow:**
```
Caller dials → Vapi routes to ZeroStaff inbound agent
  → Agent greets (ElevenLabs voice, agency-branded)
  → Collects: company name, industry, content needs, budget range, timeline
  → Checks calendar availability (Google Calendar MCP) → offers booking slot
  → Sends SMS summary + confirmation to caller
  → Stores transcript + lead record in ZeroStaff (`leads` table)
  → Notifies agency via email (Resend) + dashboard alert
  → If budget qualifies: auto-draft proposal (§21 builder)
```

**System prompt per workspace:** Agency fills in their offer, pricing range, FAQs in workspace settings → Vapi agent uses it as context.

### 22b — Outbound Sales Agent

Calls leads from the lead scraper (§20) on agency's behalf.

**Call flow:**
```
Agency selects leads from lead list → clicks "Run outbound campaign"
  → Vapi queues calls (rate-limited: 10/hr default, 50/hr Agency)
  → Agent calls each lead, identifies self as [agency name] team
  → Delivers 30-second pitch (Groq-generated from ICP + offer)
  → If interested → books meeting (Google Calendar link) or patches to live agency line
  → If not interested → logs outcome, respects do-not-call
  → All outcomes stored in `call_logs` table
  → Summary report auto-generated after campaign
```

### Data model additions
- `vapi_agents` — id, workspace_id, vapi_agent_id, type (inbound|outbound), phone_number, system_prompt
- `call_logs` — id, workspace_id, lead_id (nullable), vapi_call_id, type, outcome, duration_secs, transcript, recording_url, created_at
- `outbound_campaigns` — id, workspace_id, lead_list_id, status, calls_made, calls_answered, meetings_booked, created_at

### Tier gating
- Free/Pro: 0 (no voice agent)
- Agency: inbound agent (1 number) + outbound campaigns (500 calls/mo included)
- Add-on: extra numbers $10/mo each, extra outbound calls $0.05/min

### API routes
- `POST /api/voice/agents` — create/update Vapi agent for workspace
- `POST /api/voice/outbound/campaign` — launch outbound campaign
- `GET /api/voice/logs` — call log with transcript viewer
- `POST /api/voice/webhook` — Vapi webhook receiver (call events, transcripts)

### Key integrations
- **Vapi.ai** — VAPI_API_KEY, VAPI_PHONE_NUMBER_POOL
- **ElevenLabs** — voice ID per workspace (agency picks from preset voices)
- **Google Calendar MCP** — booking availability + event creation
- **Twilio** (optional fallback) — if Vapi not available in a region

---

## 23. Updated Tech Stack

| Added | Technology | Purpose |
|-------|-----------|---------|
| Lead scraping | Apollo.io API + Hunter.io | ICP-matched lead discovery |
| Lead enrichment | Groq | AI first-line personalisation |
| Voice agents | Vapi.ai | Inbound intake + outbound calling |
| Proposal PDF | @react-pdf/renderer | Branded proposal generation |
| Proposal delivery | Resend (already in stack) | Proposal share link email |

---

## 24. Updated Phased Build Order

### Phase 1 — Core Engine (DONE)
- Brief form → Groq text gen → results + download center + Stripe

### Phase 2 — Real Media + Email
- ElevenLabs podcast MP3
- fal.ai Kling video
- R2 file storage + Upstash QStash + Supabase Realtime
- Resend outbound + inbound email
- In-portal messaging threads

### Phase 3 — Client Approval + Calendar + Proposal
- Approval workflow
- Content calendar
- **Quote & Proposal Builder** (§21) ← new
- Google Calendar MCP sync

### Phase 4 — Lead Research + Voice
- **Lead Research Scraper** (§20) ← new
- **Voice Agent — Inbound + Outbound** (§22) ← new
- Vapi.ai integration + call logs + campaign runner

### Phase 5 — Full Agency OS
- Sub-accounts + white-label portal
- Custom domain, run-on-behalf, team roles
- Retainer invoicing (Stripe Billing)
- Revenue analytics dashboard
- API access + webhooks

---

## 25. Out of Scope (v1)

- Direct social scheduling/publishing
- Voice cloning (ElevenLabs standard voices only)
- Video editing UI
- Multi-language content generation
- Native mobile app
- Built-in CRM beyond lead list (use Instantly.ai / HubSpot via webhook)
