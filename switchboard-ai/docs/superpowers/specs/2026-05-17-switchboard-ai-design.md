# Switchboard AI — Design Spec
**Date:** 2026-05-17  
**Status:** Approved  
**Stack:** Next.js 15, Twilio, Groq→Gemini→Anthropic, Prisma, Neon, Vercel

---

## Problem

Local service businesses (dental clinics, salons, law firms) lose 30–38% of inbound calls daily. Each missed call = $200–$300 lost revenue. No tool unifies calls + email in one AI-native inbox built for a non-technical owner.

Existing tools fail:
- Zendesk/Intercom: enterprise pricing ($55+/seat), no voice, built for tech companies
- AI receptionists (Upfirst, Smith.ai): calls only, no email, no unified view
- Freshdesk: fragmented tabs, no AI-native, weak on voice

---

## Product: Switchboard AI

**Tagline:** Your AI front desk — answers calls, replies to emails, never sleeps.

**Target buyer:** Owner of a dental clinic, salon, law firm, or similar local service business (5–50 staff, no IT team).

**Pricing:**
| Tier | Price | Channels |
|------|-------|----------|
| Starter | $49/mo | Email only + AI replies |
| Pro | $99/mo | Calls + Email + AI auto-reply |
| Growth | $199/mo | Multi-location + white-label |

---

## MVP Scope (Week 1–2) — Calls + Email Only

### Core Features

1. **Unified Inbox** — all calls (transcribed) + emails in one timeline per customer, sorted by recency
2. **Call Transcription** — Twilio webhook receives call → Groq Whisper transcribes → stored as contact event
3. **AI Auto-Reply (Email)** — after-hours email → AI drafts reply using business context → sends via SendGrid
4. **AI SMS Callback** — missed call → AI sends personalised SMS within 60 seconds ("Hi, we missed your call, here's how we can help...")
5. **Office Status Toggle** — "Open / Closed" switch in dashboard → controls AI behaviour
   - Closed: AI handles everything automatically
   - Open: AI drafts, human approves before send
6. **Per-Customer Timeline** — all contacts from same phone/email threaded together with full history
7. **Human Takeover** — one-click claim any conversation, AI pauses on that thread

### Explicitly Out of Scope (Week 1)
- WhatsApp, Instagram, live chat widget
- Booking/calendar integration
- Multi-location
- Analytics dashboard
- Mobile app

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT CHANNELS                    │
│   Phone Call (Twilio)    Email (SendGrid Inbound)   │
└──────────────┬───────────────────┬──────────────────┘
               │                   │
               ▼                   ▼
┌─────────────────────────────────────────────────────┐
│              WEBHOOK HANDLERS (Next.js API)          │
│  /api/twilio/call   /api/twilio/sms   /api/email    │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                  EVENT PROCESSOR                     │
│  1. Identify/create Contact (phone or email match)  │
│  2. Create ContactEvent (call/email/sms)            │
│  3. Transcribe if call (Groq Whisper)               │
│  4. Trigger AI Reply if office=CLOSED               │
└──────────────────────────┬──────────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
          ┌──────────────┐  ┌──────────────┐
          │  Neon DB     │  │  AI Chain    │
          │  (Prisma)    │  │  Groq→Gemini │
          │              │  │  →Anthropic  │
          └──────────────┘  └──────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              DASHBOARD (Next.js App Router)          │
│  Unified Inbox │ Contact Timeline │ Office Toggle   │
└─────────────────────────────────────────────────────┘
```

---

## Data Model (Prisma)

```prisma
model Business {
  id            String    @id @default(cuid())
  name          String
  twilioNumber  String    @unique   // provisioned Twilio number
  emailInbox    String    @unique   // forwarding address e.g. inbox-<id>@switchboard.ai
  officeStatus  Status    @default(OPEN)
  systemPrompt  String    // business context for AI (hours, services, FAQs)
  contacts      Contact[]
  createdAt     DateTime  @default(now())
}

model Contact {
  id         String         @id @default(cuid())
  businessId String
  business   Business       @relation(fields: [businessId], references: [id])
  name       String?
  phone      String?
  email      String?
  events     ContactEvent[]
  createdAt  DateTime       @default(now())

  @@unique([businessId, phone])
  @@unique([businessId, email])
}

model ContactEvent {
  id          String      @id @default(cuid())
  contactId   String
  contact     Contact     @relation(fields: [contactId], references: [id])
  type        EventType   // CALL_INBOUND | CALL_MISSED | EMAIL_INBOUND | SMS_INBOUND | AI_REPLY | HUMAN_REPLY
  direction   Direction   // INBOUND | OUTBOUND
  raw         String      // original body or transcript
  aiDraft     String?     // AI-generated reply draft (human reviews if office=OPEN)
  sentReply   String?     // what was actually sent
  claimedBy   String?     // user ID if human took over
  createdAt   DateTime    @default(now())
}

enum Status    { OPEN CLOSED }
enum EventType { CALL_INBOUND CALL_MISSED EMAIL_INBOUND SMS_INBOUND AI_REPLY HUMAN_REPLY }
enum Direction { INBOUND OUTBOUND }
```

---

## AI Reply Logic

```typescript
// Triggered when: office=CLOSED and new ContactEvent arrives
async function handleAIReply(event: ContactEvent, business: Business) {
  const history = await getContactHistory(event.contactId, limit=10)
  
  const prompt = `
You are the AI front desk for ${business.name}.
Business context: ${business.systemPrompt}
Office is currently CLOSED.

Customer contact history (most recent first):
${history.map(e => `[${e.type}] ${e.raw}`).join('\n')}

Latest message: ${event.raw}

Write a warm, helpful reply. If it's a missed call, send an SMS.
If it's an email, reply by email. Keep it under 3 sentences.
Never make up appointments or prices not in the business context.
`
  // Groq → Gemini → Anthropic fallback chain (from ai-platform-template)
  const reply = await generateWithFallback(prompt)
  
  if (event.type === 'CALL_MISSED') {
    await sendSMS(event.contact.phone, reply)
  } else if (event.type === 'EMAIL_INBOUND') {
    await sendEmail(event.contact.email, reply, business)
  }
  
  await saveEvent({ type: 'AI_REPLY', sentReply: reply, contactId: event.contactId })
}
```

---

## Key API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/twilio/call` | POST | Twilio voice webhook — logs call, triggers transcription |
| `/api/twilio/sms` | POST | Twilio SMS webhook — logs inbound SMS |
| `/api/email/inbound` | POST | SendGrid inbound parse — logs email |
| `/api/business/status` | PATCH | Toggle office OPEN/CLOSED |
| `/api/contacts` | GET | List all contacts with last event |
| `/api/contacts/[id]` | GET | Full timeline for one contact |
| `/api/events/[id]/claim` | POST | Human claims conversation |
| `/api/events/[id]/reply` | POST | Human sends reply (email or SMS) |

---

## Automated Client Acquisition Pipeline

Runs in n8n (self-hosted on VPS at `/root/n8n/`).

### Workflow

```
1. SCRAPE (daily, 9am)
   Apify: "dental clinic [city]" × 20 UK/US cities
   Output: name, phone, website, reviews, email
   Cost: ~$1/1000 leads

2. QUALIFY (AI scoring)
   Score 1-10 based on:
   - Has email? (+3)
   - Google reviews mention "no answer" / "couldn't reach"? (+4)
   - Last review < 6 months? (+2)
   - Has website but no chatbot? (+1)
   Keep: score >= 6

3. ENRICH
   Apollo free tier → owner first name, direct email
   Fallback: scrape website contact page

4. PERSONALISE (Groq — free)
   Generate cold email per lead:
   - Hook: their actual bad Google review quoted back
   - Problem: "38% of dental calls go unanswered, yours may too"
   - Solution: "60-second demo — I'll show you live"
   - CTA: Calendly link

5. SEND (Instantly.ai — $37/mo)
   Day 1: Problem hook email
   Day 4: Loom video demo link  
   Day 10: Free 30-day trial offer

6. CLASSIFY REPLIES (Instantly.ai built-in AI)
   "Interested" → Calendly auto-books demo
   "Not now" → 90-day nurture sequence
   "Angry/Unsubscribe" → removed immediately

7. NOTIFY (Telegram bot → your phone)
   "New demo booked: Dr. Smith, ABC Dental, Tuesday 3pm"
```

### Tools & Cost

| Tool | Purpose | Cost |
|------|---------|------|
| Apify | Google Maps scraper | $49/mo |
| Apollo | Lead enrichment | Free tier |
| Groq | Email personalisation | Free |
| Instantly.ai | Send + reply classify | $37/mo |
| n8n (VPS) | Orchestration | $0 (already running) |
| Calendly | Demo booking | Free |
| Telegram bot | Your notifications | Free |
| **Total** | | **~$86/mo** |

---

## Onboarding Flow (Client Live in 30 Min)

1. Client signs up → enters business name, hours, FAQs (5-min form)
2. System provisions Twilio number → client forwards their existing number to it
3. Client sets email forwarding to `inbox-<id>@switchboard.ai`
4. System prompt auto-generated from their answers
5. Office status defaulted to OPEN
6. Done — first missed call handled within seconds

---

## Revenue Projections

| Month | Clients | MRR |
|-------|---------|-----|
| 1 | 5 | $495 |
| 2 | 15 | $1,485 |
| 3 | 30 | $2,970 |
| 6 | 80 | $7,920 |
| 12 | 200 | $19,800 |

Running costs at 200 clients: ~$800/mo (Twilio usage + tools).
**Net margin at 200 clients: ~96%.**

---

## Build Order

### Week 1 — Core Product
- [ ] Prisma schema + Neon DB
- [ ] Twilio number provisioning + call webhook
- [ ] Groq Whisper transcription
- [ ] AI SMS callback on missed call
- [ ] SendGrid inbound email parse
- [ ] AI email auto-reply
- [ ] Unified inbox UI (Next.js, ai-platform-template base)
- [ ] Office status toggle
- [ ] Contact timeline view

### Week 2 — Client Machine
- [ ] n8n workflow: Apify → Apollo → Groq email → Instantly
- [ ] Instantly.ai AI reply classifier wired to Calendly
- [ ] Telegram notification bot
- [ ] Loom demo video recorded
- [ ] Landing page (switchboard.ai or similar domain)

### Week 3 — First Clients
- [ ] Machine running, scraping 500+ leads/day
- [ ] First 3–5 demos booked
- [ ] Close first clients on $99/mo trial
- [ ] Iterate on AI prompt quality from real calls

---

## Domain Options (check availability)
- switchboardai.app
- frondesk.ai
- replydesk.ai
- inboxai.app
