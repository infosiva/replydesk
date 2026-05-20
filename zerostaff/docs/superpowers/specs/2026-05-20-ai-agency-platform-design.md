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
- Built-in CRM contact database
- Native mobile app
