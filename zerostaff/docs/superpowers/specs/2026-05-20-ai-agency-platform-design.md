# ZeroStaff — AI Automation Agency Platform Design Spec

**Date:** 2026-05-20  
**Status:** Approved (brainstorm complete, ready for implementation plan)

---

## 1. Product Vision

One brief in → 8 content assets out. Zero employees. Run as own agency or white-label to other agencies.

Market gap: no platform combines end-to-end content generation (text + real MP3 audio + real faceless video) with a white-label client portal and lead gen deliverables at sub-$200/mo pricing. Closest competitor (GoHighLevel) costs $497+/mo, has no content gen, no podcast, no video.

---

## 2. Platform Model

Hybrid (Direction C):
- **Layer A — Own Agency:** User runs ZeroStaff as their own content agency. Direct clients pay $500–2k/mo retainers. Platform auto-delivers. No hires needed.
- **Layer B — SaaS Reseller:** Other agencies and freelancers subscribe ($99–199/mo) to white-label ZeroStaff. They bring their own clients. Two revenue streams from one codebase.

Lead gen is a deliverable: platform auto-generates LinkedIn outreach sequences, cold email campaigns, and lead magnet copy as part of every content package. Agencies can also use this to prospect on behalf of their own clients.

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
| 7 | Lead Gen Pack (DM templates + cold email + LinkedIn outreach) | Groq | Pro+ |
| 8 | Client Report (strategy + content calendar) | Groq | Pro+ |

Free tier: outputs 1 + 4 only, watermarked report.

---

## 4. Architecture — 3 Layers

### Layer 1 — Intake
- Brief form (topic, brand profile, audience targeting, tone/style config)
- Brand profile saved per workspace (reused across briefs)
- Stored in Supabase

### Layer 2 — Engine (async job queue)
- Submit brief → enqueue 7–8 parallel jobs via Upstash QStash
- Each job: Groq text generation → optional ElevenLabs TTS → optional fal.ai video
- Progress streamed to frontend via Supabase Realtime
- Generated files (MP3, video) uploaded to Cloudflare R2 (or AWS S3)
- Results saved to Supabase with signed download URLs

### Layer 3 — Delivery
- **Creator Dashboard** — brief submission, job progress, download center
- **Client Portal (white-label)** — branded subdomain for agency clients; they download their content here
- **Agency OS** — sub-account management, run-on-behalf mode, client billing

---

## 5. Generation Pipeline

```
Brief submitted
  → 7-8 parallel jobs queued (Upstash QStash)
    → Groq generates all text assets in parallel
    → ElevenLabs converts podcast script → MP3 (Pro+)
    → fal.ai Kling renders video scenes (Pro+)
  → Assets uploaded to R2/S3
  → DB updated, Supabase Realtime notifies frontend
  → Download links served, email/webhook optional
```

Typical turnaround: text < 30s, MP3 < 60s, video < 3–5 min.

---

## 6. User Tiers & Pricing

| Tier | Price | Briefs | Outputs | Features |
|------|-------|--------|---------|----------|
| Free | $0/mo | 2/mo | Text only (blog + LinkedIn) | Watermarked report |
| Pro | $99/mo | 20/mo | All 8 (real MP3 + video) | Lead gen pack, client portal |
| Agency | $199/mo | Unlimited | All 8 | White-label portal, sub-accounts, run-on-behalf, API access, custom domain |

---

## 7. White-Label & Agency OS

Agency tier unlocks:
- **Sub-accounts:** Each client gets their own workspace. Agency sees all from master account.
- **Run-on-behalf:** Agency submits briefs for client brands (uses client's brand profile).
- **White-label portal:** Clients access a branded URL (e.g., `content.agencyname.com`) — no ZeroStaff branding.
- **Custom domain:** CNAME mapping to client portal.
- **API access:** Programmatic brief submission + result webhooks for agency automations.

---

## 8. Lead Gen as Deliverable

Every Pro/Agency brief generates a Lead Gen Pack:
- 5 LinkedIn connection message variants (for client's ideal prospect)
- 3 cold email templates (personalized to ICP)
- 1 lead magnet CTA (linked to client's offer)
- DM sequence (5-step follow-up)

Agencies can use this to run outbound on behalf of their clients — the platform does the copy, the agency sends or automates delivery via their CRM.

---

## 9. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Tailwind CSS |
| Text AI | Groq llama-3.3-70b-versatile (free) |
| Audio | ElevenLabs TTS API |
| Video | fal.ai Kling v1.5 pro (text-to-video) |
| Database + Auth | Supabase (Postgres + Row-Level Security) |
| Job Queue | Upstash QStash (serverless, no Redis to manage) |
| File Storage | Cloudflare R2 (S3-compatible, egress-free) |
| Billing | Stripe (subscriptions + usage metering) |
| Deploy | Vercel |
| AI Fallback Chain | Groq → Gemini → Cerebras → Anthropic (canonical ai.ts) |

---

## 10. Data Model (Supabase)

**Tables:**
- `users` — auth, tier, stripe_customer_id
- `workspaces` — brand profile, owner, agency_id (nullable for sub-accounts)
- `briefs` — topic, tone, keywords, workspace_id, status
- `jobs` — brief_id, type (blog/podcast/video/...), status, result_url
- `client_portals` — workspace_id, custom_domain, branding (logo, colors)

**RLS:** Users see only their workspace data. Agency accounts see all sub-workspace data.

---

## 11. UI / UX

Design direction: dark theme, professional, high-contrast. Not playful — this is a business tool.

Key screens:
1. **Brief submission form** — single page, progressive disclosure (basic → advanced brand config)
2. **Generation progress view** — live job status tiles, animated progress per output type
3. **Results dashboard** — download center, preview cards per output, re-generate single output
4. **Client portal** — white-labeled, minimal, branded header, download-only view
5. **Agency OS** — sub-account list, client brief overview, billing per client
6. **Settings** — brand profile, API keys (ElevenLabs, fal.ai), billing, custom domain

Design skills to apply: `/frontend-design` + `/emil-design-eng` + `/animate` + `/interface-design`

---

## 12. Phased Build Order

### Phase 1 — Core Engine (ship first)
- Next.js 15 scaffold at `agents/zerostaff/`
- Supabase schema + auth
- Brief form → Groq parallel text generation → results page
- Download center (text outputs only)
- Stripe Free + Pro tiers

### Phase 2 — Real Media
- ElevenLabs TTS integration → podcast MP3
- fal.ai Kling integration → faceless video
- R2 file storage + signed URLs
- Upstash QStash job queue + Supabase Realtime progress

### Phase 3 — Agency OS
- Sub-accounts + white-label portal
- Custom domain (CNAME)
- Run-on-behalf mode
- API access + webhooks
- Agency tier billing

---

## 13. Out of Scope (v1)

- Direct social scheduling/publishing (download only, no OAuth to social platforms)
- Voice cloning (ElevenLabs standard voice only)
- Video editing UI (fal.ai output is final)
- Multi-language support
- Built-in CRM
