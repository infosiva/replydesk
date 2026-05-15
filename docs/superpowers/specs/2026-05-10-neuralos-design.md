# NeuralOS — Agentic OS Design Spec

**Date:** 2026-05-10  
**Status:** Approved for implementation  
**Owner:** Siva

---

## Vision

NeuralOS is a personal + team Agentic OS. It gives anyone — developer, creator, business owner, student — a single intelligent workspace where memory, agents, tools, and actions are unified. Obsidian-compatible vault is the brain. Agents read context from it and write results back. Users never switch apps again.

**Tagline:** *Your AI brain. Your agents. Your OS.*

---

## What Nobody Else Has Combined

| Competitor | Gap NeuralOS fills |
|------------|-------------------|
| Obsidian | Has memory, no agents, no actions |
| ChatGPT | Has chat, no persistent memory, no integrations |
| Notion AI | Cloud-only, no agents, no offline |
| Zapier | Has automation, no memory, no AI brain |
| Replit Agent | Dev-only, no memory vault, no personal OS |

NeuralOS = Memory + Agents + Actions + Offline + Bundled tools. Nobody has all five.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  COMMAND PALETTE (/)                  │
│         Single entry point — type anything            │
├──────────────────────────────────────────────────────┤
│                    AGENT LAYER                        │
│  Missions · Workflows · Schedulers · Auto-triggers    │
├─────────────────────┬────────────────────────────────┤
│    MEMORY VAULT     │         SKILL ENGINE            │
│  Obsidian-compat    │  Built-in + Marketplace skills  │
│  Local .md files    │  Website, Chatbot, Email, Code  │
│  Vector search      │  Social, Finance, Legal, Travel │
├─────────────────────┼────────────────────────────────┤
│    TOOL PLUGINS     │      BUNDLED PRODUCTS           │
│  Gmail · GitHub     │  resumevault · draftcal         │
│  Slack · Calendar   │  kwizzo · speakiq · roamplan    │
│  Notion · Telegram  │  trackwealth · agentlogs        │
│  Web · Code runner  │  pixelforge · complybuddy       │
├─────────────────────┴────────────────────────────────┤
│              NOTIFICATION + ALERT ENGINE              │
│       Email · Telegram · Push · SMS · Voice Call      │
├──────────────────────────────────────────────────────┤
│           AI ENGINE (free-first fallback chain)       │
│   Ollama (offline) → Groq → Gemini → Cerebras →      │
│   NVidia NIM → Kimi → OpenAI → Anthropic              │
└──────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Memory Vault

**What:** Obsidian-compatible local vault. Every piece of knowledge, context, conversation result, and agent output stored as `.md` files. Full-text + vector search.

**Features:**
- Import existing Obsidian vault (drag + drop)
- Auto-tagging and linking (backlinks, graph view)
- Vector embeddings for semantic search (local: `nomic-embed-text` via Ollama)
- Memory scopes: Personal / Project / Team
- Time-decay ranking (recent memories rank higher)
- Agent context injection: before any agent runs, relevant vault notes auto-injected as context

**Storage:** Local-first (`.neuralvault/` folder). Optional encrypted cloud sync (Pro tier).

---

### 2. Agent Layer

**What:** Agents that DO things, not just chat. Each agent has a role, memory access, tools, and output target.

**Agent types built-in:**

| Agent | What it does |
|-------|-------------|
| Research Agent | Web search → summarise → save to vault |
| Writer Agent | Draft blog, email, social post with vault context |
| Code Agent | Write, run, debug code in sandboxed runner |
| Monitor Agent | Watch URLs/prices/news → alert on change |
| Schedule Agent | Run any mission on cron schedule |
| Outreach Agent | Draft + send emails/DMs with personalisation from vault |
| Data Agent | Fetch CSV/API → analyse → save chart + summary to vault |
| Voice Agent | Text-to-speech alerts + incoming call transcription |

**Missions:** Multi-step agent workflows. Example:
```
Mission: "Daily Business Brief"
  1. Research Agent → fetch top 5 news in my niche
  2. Data Agent → pull yesterday's revenue from Stripe
  3. Writer Agent → write 200-word brief using vault context
  4. Notification Engine → send brief via email at 8am
```

**Triggers:** Manual · Schedule (cron) · Webhook · Event (file change, email received, price alert)

---

### 3. Built-in Skill Library

Every skill is a pre-built agent mission users activate in one click.

**AI Space Skills:**
- Website Builder — generate full Next.js site from prompt, deploy to Vercel
- Chatbot Builder — build + deploy custom chatbot with your knowledge base
- AI Model Tester — benchmark prompts across Groq/Gemini/Cerebras/Claude
- Prompt Library — save, version, share prompts with vault context
- Fine-tune Prep — format data from vault for fine-tuning datasets

**Productivity Skills:**
- Daily Brief — news + tasks + revenue summary every morning
- Meeting Notes — transcribe + summarise + action items → vault
- Email Drafter — write emails using vault contact context
- Content Calendar — plan + schedule social posts (wraps draftcal)
- Invoice Generator — generate PDF invoices (wraps invoice-ai)

**Business Skills:**
- Lead Research — find + profile leads, save to vault CRM
- Competitor Monitor — track competitor sites/prices/posts
- Compliance Checker — scan docs against rules (wraps complybuddy)
- Resume Builder — AI resume from vault career data (wraps resumevault)
- Job Alerts — monitor job boards → filter by vault preferences

**Finance Skills:**
- Portfolio Tracker — pull stock/crypto prices → daily summary (wraps trackwealth)
- Expense Analyser — parse bank statements → categorise → save to vault
- Invoice Monitor — watch for unpaid invoices → alert

**Communication + Alerting Skills:**
- Email Alerts — send formatted alerts via SMTP/SendGrid
- Telegram Alerts — push to Telegram bot (already wired in existing projects)
- Push Notifications — browser push + mobile PWA
- SMS Alerts — via Twilio (configurable)
- Voice Call Alerts — Twilio voice call for critical alerts
- Webhook Relay — forward events to any URL

**Learning Skills:**
- Quiz Generator — generate quiz from any vault notes (wraps kwizzo)
- Tutor Mode — AI tutor using vault as knowledge base (wraps tutiq/speakiq)
- Flashcard Maker — generate Anki-compatible flashcards from vault

**Travel + Lifestyle Skills:**
- Trip Planner — full itinerary from preferences in vault (wraps roamplan)
- Flight Monitor — track prices + alert on drop (wraps flightbrain)
- Health Tracker — log + analyse health data in vault

**Developer Skills:**
- Agent Logger — trace + debug AI agents (wraps agentlogs)
- API Monitor — watch endpoints → alert on downtime (wraps site-watchdog)
- Code Reviewer — review PRs using vault coding standards
- Deployment Monitor — watch Vercel/Railway deploys

---

### 4. Tool Plugin System

Users connect external services. Each plugin is a set of actions + triggers.

**Tier 1 (launch day):**
- Gmail / SMTP (send, read, search)
- GitHub (create PR, comment, read issues)
- Telegram (send message, receive commands)
- Slack (send message, read channel)
- Google Calendar (create event, read schedule)
- Notion (read/write pages)
- Stripe (read revenue, invoices)
- Twilio (SMS + voice calls)
- Web scraper (any URL)
- Code runner (Node.js + Python sandbox)

**Tier 2 (post-launch):**
- WhatsApp Business API
- Twitter/X posting
- LinkedIn posting
- Airtable
- Zapier webhook bridge
- HubSpot CRM

---

### 5. Notification + Alert Engine

Unified delivery layer. Every agent, monitor, and mission routes alerts here.

**Channels:**
- Email (SMTP / SendGrid / Resend)
- Telegram bot (instant, free)
- Browser push notifications (PWA)
- SMS via Twilio
- Voice call via Twilio (critical alerts only)
- Webhook (forward to any URL)

**Alert types:**
- Info (daily brief, completed mission)
- Warning (price threshold, site slow)
- Critical (site down, payment failed) — triggers voice call

**Rules engine:** Per-alert routing. "If severity=critical → call + Telegram. If severity=info → email only."

---

### 6. Bundled Products (Day 1 Value)

All existing products accessible as native skills inside NeuralOS. No separate login.

| Product | As NeuralOS skill |
|---------|------------------|
| resumevault.app | Resume Builder skill |
| draftcal.app | Content Calendar skill |
| kwizzo.app | Quiz Generator skill |
| tutiq.app | Tutor Mode skill |
| speakiq.app | Language Learning skill |
| roamplan.app | Trip Planner skill |
| trackwealth.app | Portfolio Tracker skill |
| agentlogs.app | Agent Logger skill |
| arcadeforge.app | Game Builder skill |
| complybuddy | Compliance Checker skill |
| flightbrain.app | Flight Monitor skill |
| site-watchdog | API Monitor skill |

---

### 7. Mission Marketplace

Users share and sell agent missions (workflows).

**How it works:**
- Creator builds mission → publishes to marketplace
- Buyers install with one click → runs in their NeuralOS
- Pricing: free or paid (creator sets price)
- NeuralOS takes 20% cut
- Top missions featured on homepage

**Example missions for sale:**
- "Daily Indie Hacker Dashboard" — $4.99
- "Lead Gen Machine" — $9.99/mo
- "Content Factory" — $14.99/mo

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 App Router + Tailwind + shadcn/ui |
| Desktop app | Tauri (Rust wrapper, optional offline) |
| Backend | Next.js API routes + edge functions |
| Vault storage | Local filesystem `.neuralvault/` (markdown) |
| Cloud sync | Vercel Blob + encrypted at rest |
| Vector search | pgvector (Supabase free tier) or local Chroma |
| AI engine | Existing `lib/ai.ts` fallback chain |
| Auth | NextAuth.js (magic link — already built in pixelforge) |
| Payments | Stripe (subscriptions + marketplace payouts) |
| Notifications | Resend (email) + Telegram bot + Twilio |
| Deployment | Vercel (frontend) + VPS for heavy agent jobs |
| Scheduling | Vercel Cron (free tier: 2 crons) + node-cron on VPS |

---

## Pricing

```
FREE                PRO                 TEAM
$0/mo               $12/mo              $29/seat/mo

Local vault only     Cloud sync          Shared team vault
3 active agents      Unlimited agents    Unlimited agents
10 skills            All skills          All skills
Basic plugins        All Tier 1 plugins  All plugins + Tier 2
5 missions/mo        Unlimited missions  Shared missions
Email alerts only    All alert channels  All channels + voice
                     Mission marketplace Mission marketplace
                     All bundled tools   All bundled tools
                     Priority AI budget  Team AI budget pool
```

**Revenue projections:**
- 500 Pro = $6,000/mo
- 1,000 Pro = $12,000/mo
- 100 Team seats = $2,900/mo
- Marketplace 20% cut (modest) = $500-2,000/mo
- **Target 12-month:** $15,000-20,000/mo ARR

---

## Go-To-Market

**Phase 1 — Obsidian community (weeks 1-4)**
- Post in r/ObsidianMD (750K members) — "I built agents on top of Obsidian"
- Product Hunt launch
- Obsidian forum post
- Target: 500 free signups → 50 Pro conversions = $600/mo

**Phase 2 — AI/indie maker community (weeks 5-8)**
- IndieHackers post
- HackerNews "Show HN"
- Twitter/X build-in-public thread
- Target: 2,000 free → 200 Pro = $2,400/mo

**Phase 3 — Content SEO (months 3-6)**
- Blog: "Replace Zapier + Notion AI + ChatGPT with one tool"
- YouTube demos of each skill
- Target: organic 5,000 users → 500 Pro = $6,000/mo

**Phase 4 — B2B team push (months 6-12)**
- Cold outreach to small agencies + dev shops
- Team plan upsell
- Target: 50 teams × 5 seats = $7,250/mo

---

## MVP Scope (Phase 1 — ship in 4 weeks)

Ship these, nothing else:

1. Command palette UI (Next.js)
2. Vault reader/writer (local markdown files)
3. 3 agents: Research, Writer, Monitor
4. 5 skills: Daily Brief, Website Builder, Email Drafter, Content Calendar, API Monitor
5. 3 plugins: Gmail, Telegram, GitHub
6. 2 alert channels: Email + Telegram
7. Auth + Stripe subscription (Free + Pro)
8. 5 bundled products wired as skills (resumevault, draftcal, agentlogs, kwizzo, site-watchdog)

**Not in MVP:** Marketplace, Team plan, Desktop app, Voice calls, SMS

---

## What Makes It Defensible

1. **Obsidian vault portability** — memory is YOUR files, not our database. Trust + retention.
2. **Free AI chain** — near-zero marginal cost per user. Competitors pay per token.
3. **15 bundled tools** — day-1 value no competitor can match without years of building.
4. **Offline mode** — Ollama + local vault. Privacy-first users pay premium for this.
5. **Mission Marketplace** — network effect. More missions = more value = more users.
