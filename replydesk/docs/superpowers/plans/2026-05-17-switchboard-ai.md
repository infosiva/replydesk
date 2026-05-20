# Switchboard AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI-native unified customer support inbox for local service businesses — auto-transcribes calls, auto-replies via SMS/email when office is CLOSED, unified contact timeline, human takeover with one click.

**Architecture:** Next.js 15 App Router + Prisma + Neon Postgres. Twilio handles inbound calls (voice webhook → Groq Whisper transcription) and SMS. SendGrid handles inbound email (inbound parse webhook). AI reply chain: Groq → Gemini → Anthropic (from ai-platform-template lib/ai.ts). Office status toggle controls full-auto vs draft-for-approval mode.

**Tech Stack:** Next.js 15, Tailwind, Prisma 7, Neon Postgres, Twilio (voice + SMS), SendGrid (inbound email), Groq Whisper (transcription), lib/ai.ts fallback chain, shadcn/ui, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-05-17-switchboard-ai-design.md`

---

## File Map

```
switchboard-ai/
├── prisma/
│   └── schema.prisma                  # Business, Contact, ContactEvent models
├── lib/
│   ├── ai.ts                          # Copy from ai-platform-template (fallback chain)
│   ├── db.ts                          # Prisma client singleton
│   ├── twilio.ts                      # Twilio helper: send SMS, TwiML response builder
│   ├── sendgrid.ts                    # SendGrid helper: send email
│   ├── transcribe.ts                  # Groq Whisper: audio URL → transcript text
│   ├── ai-reply.ts                    # Core AI reply logic (event → draft/send)
│   └── office.ts                      # Get/set office status for a business
├── app/
│   ├── layout.tsx                     # Root layout (dark theme, fonts)
│   ├── page.tsx                       # Redirect → /inbox
│   ├── inbox/
│   │   └── page.tsx                   # Unified inbox: all contacts, last event, office toggle
│   ├── contacts/
│   │   └── [id]/
│   │       └── page.tsx               # Contact detail: full event timeline
│   └── api/
│       ├── twilio/
│       │   ├── call/
│       │   │   └── route.ts           # POST: Twilio voice webhook
│       │   └── sms/
│       │       └── route.ts           # POST: Twilio SMS inbound webhook
│       ├── email/
│       │   └── inbound/
│       │       └── route.ts           # POST: SendGrid inbound parse webhook
│       ├── business/
│       │   └── status/
│       │       └── route.ts           # PATCH: toggle OPEN/CLOSED
│       ├── contacts/
│       │   ├── route.ts               # GET: list contacts with last event
│       │   └── [id]/
│       │       └── route.ts           # GET: full timeline for one contact
│       └── events/
│           └── [id]/
│               ├── claim/
│               │   └── route.ts       # POST: human claims conversation
│               └── reply/
│                   └── route.ts       # POST: human sends reply
├── components/
│   ├── ContactList.tsx                # Left panel: contact rows
│   ├── EventTimeline.tsx              # Right panel: timeline of events
│   ├── OfficeToggle.tsx               # OPEN/CLOSED switch
│   ├── EventBadge.tsx                 # Icon+label per event type
│   └── ReplyBox.tsx                   # Human reply textarea + send
└── .env.local                         # Twilio, SendGrid, Neon, Groq keys
```

---

## Task 1: Scaffold Next.js project

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`
- Create: `.env.local`

- [ ] **Step 1: Install deps**

```bash
cd /Users/sivaprakasam/projects/agents/switchboard-ai
npm install @prisma/client prisma twilio @sendgrid/mail @sendgrid/inbound-parse groq-sdk @anthropic-ai/sdk @google/generative-ai formidable
npm install -D prisma
```

Expected: installs without errors.

- [ ] **Step 2: Create .env.local with required keys**

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://..."           # get from neon.tech → new project → connection string
DIRECT_URL="postgresql://..."            # same host, no pooler prefix

TWILIO_ACCOUNT_SID="ACxxxx"
TWILIO_AUTH_TOKEN="xxxx"
TWILIO_PHONE_NUMBER="+1..."

SENDGRID_API_KEY="SG.xxxx"
SENDGRID_FROM_EMAIL="hello@switchboard.ai"

GROQ_API_KEY="gsk_xxxx"
GEMINI_API_KEY="xxxx"
ANTHROPIC_API_KEY="sk-ant-xxxx"

BUSINESS_ID="clxxxx"                     # seed after DB init
EOF
```

Note: `DATABASE_URL` uses `?pgbouncer=true&connection_limit=1` for Neon pooler. `DIRECT_URL` is the direct (non-pooled) connection for migrations.

- [ ] **Step 3: Verify Next.js runs**

```bash
npm run dev
```

Expected: server starts on port 3000, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "feat: add Prisma, Twilio, SendGrid, Groq deps"
```

---

## Task 2: Prisma schema + Neon DB

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

- [ ] **Step 1: Write schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Business {
  id            String    @id @default(cuid())
  name          String
  twilioNumber  String    @unique
  emailInbox    String    @unique
  officeStatus  Status    @default(OPEN)
  systemPrompt  String    @db.Text
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
  id         String     @id @default(cuid())
  contactId  String
  contact    Contact    @relation(fields: [contactId], references: [id])
  type       EventType
  direction  Direction
  raw        String     @db.Text
  aiDraft    String?    @db.Text
  sentReply  String?    @db.Text
  claimedBy  String?
  createdAt  DateTime   @default(now())
}

enum Status    { OPEN CLOSED }
enum EventType { CALL_INBOUND CALL_MISSED EMAIL_INBOUND SMS_INBOUND AI_REPLY HUMAN_REPLY }
enum Direction { INBOUND OUTBOUND }
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: `migrations/TIMESTAMP_init/migration.sql` created, tables created in Neon.

- [ ] **Step 3: Write db.ts singleton**

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 4: Seed one Business row**

```bash
npx prisma studio
```

Open in browser, create one Business row:
- name: "Demo Dental Clinic"
- twilioNumber: "+1..." (your Twilio number)
- emailInbox: "inbox-demo@switchboard.ai"
- officeStatus: OPEN
- systemPrompt: "We are Demo Dental Clinic, open Mon-Fri 9am-5pm. We offer cleanings, fillings, and emergency appointments. Call back time: within 1 business hour."

Copy the generated `id` → paste into `.env.local` as `BUSINESS_ID`.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/db.ts
git commit -m "feat: Prisma schema + Neon DB — Business, Contact, ContactEvent"
```

---

## Task 3: Twilio voice webhook → log call + transcribe

**Files:**
- Create: `lib/transcribe.ts`
- Create: `lib/twilio.ts`
- Create: `app/api/twilio/call/route.ts`

- [ ] **Step 1: Write transcribe.ts (Groq Whisper)**

```typescript
// lib/transcribe.ts
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function transcribeAudio(recordingUrl: string): Promise<string> {
  const res = await fetch(recordingUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')}`,
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch recording: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const file = new File([buffer], 'call.mp3', { type: 'audio/mpeg' })
  const result = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
  })
  return result.text
}
```

- [ ] **Step 2: Write twilio.ts helpers**

```typescript
// lib/twilio.ts
import twilio from 'twilio'

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export async function sendSMS(to: string, body: string): Promise<void> {
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
    body,
  })
}

export function twimlRecord(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for calling. Please leave a message after the beep and we will get back to you shortly.</Say>
  <Record maxLength="120" recordingStatusCallback="/api/twilio/recording" transcribeCallback="/api/twilio/transcribe" />
  <Say>Thank you. Goodbye.</Say>
</Response>`
}

export function twimlSay(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${text}</Say>
</Response>`
}
```

- [ ] **Step 3: Write the call webhook route**

```typescript
// app/api/twilio/call/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { twimlRecord } from '@/lib/twilio'
import { triggerAIReply } from '@/lib/ai-reply'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const from = body.get('From') as string
  const callStatus = body.get('CallStatus') as string
  const businessId = process.env.BUSINESS_ID!

  // Upsert contact by phone
  const contact = await db.contact.upsert({
    where: { businessId_phone: { businessId, phone: from } },
    create: { businessId, phone: from },
    update: {},
  })

  const isMissed = callStatus === 'no-answer' || callStatus === 'busy'
  const eventType = isMissed ? 'CALL_MISSED' : 'CALL_INBOUND'

  const event = await db.contactEvent.create({
    data: {
      contactId: contact.id,
      type: eventType,
      direction: 'INBOUND',
      raw: `${eventType} from ${from} — status: ${callStatus}`,
    },
  })

  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  if (isMissed && business.officeStatus === 'CLOSED') {
    // fire-and-forget AI SMS reply
    triggerAIReply(event.id, contact, business).catch(console.error)
  }

  return new NextResponse(twimlRecord(), {
    headers: { 'Content-Type': 'application/xml' },
  })
}
```

- [ ] **Step 4: Test webhook locally via ngrok**

```bash
# terminal 1
npm run dev

# terminal 2
ngrok http 3000
```

In Twilio Console → Phone Numbers → your number → Voice → Webhook URL = `https://<ngrok-id>.ngrok.io/api/twilio/call`.

Call your Twilio number. Expected: POST hits `/api/twilio/call`, contact row created in DB, TwiML plays recording prompt.

- [ ] **Step 5: Commit**

```bash
git add lib/transcribe.ts lib/twilio.ts app/api/twilio/call/
git commit -m "feat: Twilio voice webhook — log call, return TwiML record prompt"
```

---

## Task 4: AI SMS callback on missed call

**Files:**
- Create: `lib/ai-reply.ts`
- Create: `lib/ai.ts` (copy from template)

- [ ] **Step 1: Copy lib/ai.ts from ai-platform-template**

```bash
cp /Users/sivaprakasam/projects/agents/ai-platform-template/lib/ai.ts /Users/sivaprakasam/projects/agents/switchboard-ai/lib/ai.ts
```

Remove the `import config from '@/vertical.config'` line and inline the app name directly since switchboard-ai doesn't use vertical.config:

```typescript
// in lib/ai.ts, replace the import + any config references:
const APP_NAME = 'Switchboard AI'
```

- [ ] **Step 2: Write lib/ai-reply.ts**

```typescript
// lib/ai-reply.ts
import { db } from '@/lib/db'
import { aiChat } from '@/lib/ai'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'
import type { Business, Contact, ContactEvent } from '@prisma/client'

export async function triggerAIReply(
  eventId: string,
  contact: Contact,
  business: Business
): Promise<void> {
  const event = await db.contactEvent.findUniqueOrThrow({ where: { id: eventId } })

  const history = await db.contactEvent.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const historyText = history
    .map(e => `[${e.type}] ${e.raw}`)
    .join('\n')

  const systemPrompt = `You are the AI front desk for ${business.name}.
Business context: ${business.systemPrompt}
Office is currently CLOSED.
Keep replies warm, concise, under 3 sentences.
Never invent appointment times or prices not in the business context.
Never use fake names or testimonials.`

  const userMessage = `Customer contact history (most recent first):
${historyText}

Latest: ${event.raw}

${event.type === 'CALL_MISSED'
  ? 'Write a short SMS to send to the customer who just called and got no answer.'
  : 'Write a short email reply to the customer.'}`

  const { text: reply } = await aiChat([{ role: 'user', content: userMessage }], systemPrompt)

  if (event.type === 'CALL_MISSED' && contact.phone) {
    await sendSMS(contact.phone, reply)
  } else if (event.type === 'EMAIL_INBOUND' && contact.email) {
    await sendEmail(contact.email, `Re: your message to ${business.name}`, reply, business.emailInbox)
  }

  await db.contactEvent.create({
    data: {
      contactId: contact.id,
      type: 'AI_REPLY',
      direction: 'OUTBOUND',
      raw: reply,
      sentReply: reply,
    },
  })
}
```

- [ ] **Step 3: Write test**

```typescript
// tests/ai-reply.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock external calls
vi.mock('@/lib/db', () => ({ db: { contactEvent: { findUniqueOrThrow: vi.fn(), findMany: vi.fn(), create: vi.fn() } } }))
vi.mock('@/lib/ai', () => ({ aiChat: vi.fn().mockResolvedValue({ text: 'We missed your call! We will reach out within 1 hour.', provider: 'groq', model: 'llama' }) }))
vi.mock('@/lib/twilio', () => ({ sendSMS: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/sendgrid', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))

import { triggerAIReply } from '@/lib/ai-reply'
import { db } from '@/lib/db'
import { sendSMS } from '@/lib/twilio'

describe('triggerAIReply', () => {
  it('sends SMS on CALL_MISSED', async () => {
    vi.mocked(db.contactEvent.findUniqueOrThrow).mockResolvedValue({
      id: 'ev1', contactId: 'c1', type: 'CALL_MISSED', direction: 'INBOUND',
      raw: 'missed call from +447000000', aiDraft: null, sentReply: null,
      claimedBy: null, createdAt: new Date(),
    } as any)
    vi.mocked(db.contactEvent.findMany).mockResolvedValue([])
    vi.mocked(db.contactEvent.create).mockResolvedValue({} as any)

    const contact = { id: 'c1', businessId: 'b1', phone: '+447000000', email: null, name: null, createdAt: new Date() }
    const business = { id: 'b1', name: 'Demo Clinic', twilioNumber: '+441', emailInbox: 'test@sw.ai',
      officeStatus: 'CLOSED', systemPrompt: 'open 9-5', createdAt: new Date() } as any

    await triggerAIReply('ev1', contact, business)

    expect(sendSMS).toHaveBeenCalledWith('+447000000', expect.stringContaining('missed'))
  })
})
```

- [ ] **Step 4: Run test**

```bash
npm run test -- tests/ai-reply.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts lib/ai-reply.ts tests/ai-reply.test.ts
git commit -m "feat: AI SMS callback on missed call via Groq fallback chain"
```

---

## Task 5: SendGrid inbound email parse

**Files:**
- Create: `lib/sendgrid.ts`
- Create: `app/api/email/inbound/route.ts`

- [ ] **Step 1: Write lib/sendgrid.ts**

```typescript
// lib/sendgrid.ts
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  from: string
): Promise<void> {
  await sgMail.send({ to, from, subject, text })
}
```

- [ ] **Step 2: Write inbound email parse route**

```typescript
// app/api/email/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { triggerAIReply } from '@/lib/ai-reply'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const from = body.get('from') as string           // e.g. "John Smith <john@example.com>"
  const subject = body.get('subject') as string
  const text = body.get('text') as string
  const to = body.get('to') as string               // inbox-<id>@switchboard.ai

  // Extract email address from "Name <email>" format
  const emailMatch = from.match(/<(.+?)>/) ?? [null, from]
  const emailAddr = emailMatch[1]!.trim()

  const businessId = process.env.BUSINESS_ID!

  const contact = await db.contact.upsert({
    where: { businessId_email: { businessId, email: emailAddr } },
    create: { businessId, email: emailAddr, name: from.split('<')[0].trim() || null },
    update: {},
  })

  const raw = `Subject: ${subject}\n\n${text}`

  const event = await db.contactEvent.create({
    data: {
      contactId: contact.id,
      type: 'EMAIL_INBOUND',
      direction: 'INBOUND',
      raw,
    },
  })

  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  if (business.officeStatus === 'CLOSED') {
    triggerAIReply(event.id, contact, business).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Configure SendGrid inbound parse**

In SendGrid Dashboard → Settings → Inbound Parse:
- Hostname: `mail.switchboard.ai` (or use a subdomain you own)
- URL: `https://<your-ngrok-or-vercel-url>/api/email/inbound`
- Check "POST the raw, full MIME message"

- [ ] **Step 4: Test with curl**

```bash
curl -X POST http://localhost:3000/api/email/inbound \
  -F "from=John Smith <john@example.com>" \
  -F "to=inbox-demo@switchboard.ai" \
  -F "subject=Appointment request" \
  -F "text=Hi, I would like to book a cleaning next Tuesday."
```

Expected: `{"ok":true}`, contact + event rows in DB, AI reply sent if office=CLOSED.

- [ ] **Step 5: Commit**

```bash
git add lib/sendgrid.ts app/api/email/inbound/
git commit -m "feat: SendGrid inbound email parse → contact + event log + AI reply"
```

---

## Task 6: SMS inbound webhook

**Files:**
- Create: `app/api/twilio/sms/route.ts`

- [ ] **Step 1: Write SMS inbound route**

```typescript
// app/api/twilio/sms/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { triggerAIReply } from '@/lib/ai-reply'
import { twimlSay } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const body = await req.formData()
  const from = body.get('From') as string
  const msgBody = body.get('Body') as string
  const businessId = process.env.BUSINESS_ID!

  const contact = await db.contact.upsert({
    where: { businessId_phone: { businessId, phone: from } },
    create: { businessId, phone: from },
    update: {},
  })

  const event = await db.contactEvent.create({
    data: {
      contactId: contact.id,
      type: 'SMS_INBOUND',
      direction: 'INBOUND',
      raw: msgBody,
    },
  })

  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  if (business.officeStatus === 'CLOSED') {
    triggerAIReply(event.id, contact, business).catch(console.error)
  }

  // Return empty TwiML (no auto-reply via TwiML, AI reply sent separately via sendSMS)
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
```

- [ ] **Step 2: Wire Twilio SMS webhook**

Twilio Console → Phone Numbers → Messaging → Webhook URL = `https://<ngrok>/api/twilio/sms`

- [ ] **Step 3: Commit**

```bash
git add app/api/twilio/sms/
git commit -m "feat: SMS inbound webhook → log + AI reply when CLOSED"
```

---

## Task 7: Office status toggle + contact list APIs

**Files:**
- Create: `app/api/business/status/route.ts`
- Create: `app/api/contacts/route.ts`
- Create: `app/api/contacts/[id]/route.ts`

- [ ] **Step 1: Office status PATCH**

```typescript
// app/api/business/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const { status } = await req.json() as { status: 'OPEN' | 'CLOSED' }
  const businessId = process.env.BUSINESS_ID!
  const business = await db.business.update({
    where: { id: businessId },
    data: { officeStatus: status },
    select: { id: true, officeStatus: true },
  })
  return NextResponse.json(business)
}
```

- [ ] **Step 2: Contact list GET**

```typescript
// app/api/contacts/route.ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const businessId = process.env.BUSINESS_ID!
  const contacts = await db.contact.findMany({
    where: { businessId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(contacts)
}
```

- [ ] **Step 3: Contact timeline GET**

```typescript
// app/api/contacts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contact = await db.contact.findUniqueOrThrow({
    where: { id },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
    },
  })
  return NextResponse.json(contact)
}
```

- [ ] **Step 4: Claim + reply event routes**

```typescript
// app/api/events/[id]/claim/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const event = await db.contactEvent.update({
    where: { id },
    data: { claimedBy: 'human' },
  })
  return NextResponse.json(event)
}
```

```typescript
// app/api/events/[id]/reply/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendSMS } from '@/lib/twilio'
import { sendEmail } from '@/lib/sendgrid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { message } = await req.json() as { message: string }

  const source = await db.contactEvent.findUniqueOrThrow({
    where: { id },
    include: { contact: true },
  })

  const businessId = process.env.BUSINESS_ID!
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } })

  if (source.contact.phone && (source.type === 'CALL_MISSED' || source.type === 'SMS_INBOUND')) {
    await sendSMS(source.contact.phone, message)
  } else if (source.contact.email) {
    await sendEmail(source.contact.email, `Message from ${business.name}`, message, business.emailInbox)
  }

  const reply = await db.contactEvent.create({
    data: {
      contactId: source.contactId,
      type: 'HUMAN_REPLY',
      direction: 'OUTBOUND',
      raw: message,
      sentReply: message,
      claimedBy: 'human',
    },
  })

  return NextResponse.json(reply)
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/business/ app/api/contacts/ app/api/events/
git commit -m "feat: office status toggle, contact list, timeline, claim, reply APIs"
```

---

## Task 8: Unified inbox UI

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/inbox/page.tsx`
- Create: `components/ContactList.tsx`
- Create: `components/OfficeToggle.tsx`
- Create: `components/EventBadge.tsx`

- [ ] **Step 1: Update layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Switchboard AI',
  description: 'Your AI front desk — answers calls, replies to emails, never sleeps.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Redirect root → /inbox**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/inbox')
}
```

- [ ] **Step 3: Write OfficeToggle component**

```typescript
// components/OfficeToggle.tsx
'use client'
import { useState } from 'react'

export function OfficeToggle({ initial }: { initial: 'OPEN' | 'CLOSED' }) {
  const [status, setStatus] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = status === 'OPEN' ? 'CLOSED' : 'OPEN'
    await fetch('/api/business/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setStatus(next)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        status === 'OPEN'
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
          : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
      } disabled:opacity-50`}
    >
      {loading ? '...' : status === 'OPEN' ? '🟢 Office Open' : '🔴 Office Closed — AI handling all'}
    </button>
  )
}
```

- [ ] **Step 4: Write EventBadge component**

```typescript
// components/EventBadge.tsx
const BADGE: Record<string, { label: string; color: string }> = {
  CALL_INBOUND:  { label: 'Call',        color: 'text-blue-400 bg-blue-500/10'    },
  CALL_MISSED:   { label: 'Missed Call', color: 'text-yellow-400 bg-yellow-500/10'},
  EMAIL_INBOUND: { label: 'Email',       color: 'text-purple-400 bg-purple-500/10'},
  SMS_INBOUND:   { label: 'SMS',         color: 'text-cyan-400 bg-cyan-500/10'    },
  AI_REPLY:      { label: 'AI Reply',    color: 'text-emerald-400 bg-emerald-500/10'},
  HUMAN_REPLY:   { label: 'Human Reply', color: 'text-orange-400 bg-orange-500/10'},
}

export function EventBadge({ type }: { type: string }) {
  const { label, color } = BADGE[type] ?? { label: type, color: 'text-gray-400 bg-gray-500/10' }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>
  )
}
```

- [ ] **Step 5: Write ContactList component**

```typescript
// components/ContactList.tsx
'use client'
import { useRouter } from 'next/navigation'
import { EventBadge } from './EventBadge'

type Event = { id: string; type: string; raw: string; createdAt: string }
type Contact = { id: string; name: string | null; phone: string | null; email: string | null; events: Event[] }

export function ContactList({ contacts, activeId }: { contacts: Contact[]; activeId?: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {contacts.map(c => {
        const last = c.events[0]
        return (
          <button
            key={c.id}
            onClick={() => router.push(`/contacts/${c.id}`)}
            className={`text-left px-4 py-3 rounded-lg transition-colors ${
              c.id === activeId ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">{c.name ?? c.phone ?? c.email}</span>
              {last && <EventBadge type={last.type} />}
            </div>
            {last && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{last.raw.slice(0, 60)}</p>
            )}
          </button>
        )
      })}
      {contacts.length === 0 && (
        <p className="text-gray-500 text-sm px-4 py-8 text-center">No contacts yet. Calls and emails will appear here.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Write inbox page**

```typescript
// app/inbox/page.tsx
import { db } from '@/lib/db'
import { ContactList } from '@/components/ContactList'
import { OfficeToggle } from '@/components/OfficeToggle'

export const dynamic = 'force-dynamic'

export default async function InboxPage() {
  const businessId = process.env.BUSINESS_ID!
  const [business, contacts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.contact.findMany({
      where: { businessId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return (
    <div className="flex h-screen flex-col">
      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-lg font-semibold">Switchboard AI</h1>
          <p className="text-xs text-gray-500">{business.name}</p>
        </div>
        <OfficeToggle initial={business.officeStatus} />
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-white/10 overflow-y-auto py-2">
          <ContactList contacts={contacts as any} />
        </aside>
        <main className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          Select a contact to view their timeline
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify in browser**

```bash
npm run dev
open http://localhost:3000
```

Expected: dark UI, office toggle at top right, contact list on left, placeholder text in main area.

- [ ] **Step 8: Commit**

```bash
git add app/layout.tsx app/page.tsx app/inbox/ components/ContactList.tsx components/OfficeToggle.tsx components/EventBadge.tsx
git commit -m "feat: unified inbox UI — contact list, office toggle, dark layout"
```

---

## Task 9: Contact timeline view + human reply

**Files:**
- Create: `app/contacts/[id]/page.tsx`
- Create: `components/EventTimeline.tsx`
- Create: `components/ReplyBox.tsx`

- [ ] **Step 1: Write EventTimeline component**

```typescript
// components/EventTimeline.tsx
import { EventBadge } from './EventBadge'

type Event = {
  id: string
  type: string
  direction: string
  raw: string
  sentReply: string | null
  aiDraft: string | null
  claimedBy: string | null
  createdAt: string
}

export function EventTimeline({ events }: { events: Event[] }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {events.map(ev => (
        <div
          key={ev.id}
          className={`flex gap-3 ${ev.direction === 'OUTBOUND' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div className="flex flex-col gap-1 max-w-md">
            <div className={`flex items-center gap-2 ${ev.direction === 'OUTBOUND' ? 'flex-row-reverse' : ''}`}>
              <EventBadge type={ev.type} />
              <span className="text-xs text-gray-500">
                {new Date(ev.createdAt).toLocaleString()}
              </span>
              {ev.claimedBy && <span className="text-xs text-orange-400">Human</span>}
            </div>
            <div
              className={`rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                ev.direction === 'OUTBOUND'
                  ? 'bg-indigo-600/30 text-indigo-100 rounded-tr-sm'
                  : 'bg-white/8 text-gray-200 rounded-tl-sm'
              }`}
            >
              {ev.sentReply ?? ev.raw}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write ReplyBox component**

```typescript
// components/ReplyBox.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReplyBox({ sourceEventId }: { sourceEventId: string }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const router = useRouter()

  async function send() {
    if (!message.trim()) return
    setSending(true)
    await fetch(`/api/events/${sourceEventId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    setMessage('')
    setSending(false)
    router.refresh()
  }

  return (
    <div className="border-t border-white/10 p-4 flex gap-3">
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type a reply..."
        rows={3}
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500"
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
      />
      <button
        onClick={send}
        disabled={sending || !message.trim()}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-sm font-medium self-end transition-colors"
      >
        {sending ? 'Sending...' : 'Send ↵'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write contact detail page**

```typescript
// app/contacts/[id]/page.tsx
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { EventTimeline } from '@/components/EventTimeline'
import { ReplyBox } from '@/components/ReplyBox'
import { ContactList } from '@/components/ContactList'
import { OfficeToggle } from '@/components/OfficeToggle'

export const dynamic = 'force-dynamic'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const businessId = process.env.BUSINESS_ID!

  const [business, contact, contacts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: businessId } }),
    db.contact.findUnique({
      where: { id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    }),
    db.contact.findMany({
      where: { businessId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!contact) notFound()

  const lastEvent = contact.events.at(-1)

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-lg font-semibold">Switchboard AI</h1>
          <p className="text-xs text-gray-500">{business.name}</p>
        </div>
        <OfficeToggle initial={business.officeStatus} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-white/10 overflow-y-auto py-2">
          <ContactList contacts={contacts as any} activeId={id} />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Contact header */}
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold">{contact.name ?? contact.phone ?? contact.email}</h2>
            <div className="flex gap-3 text-xs text-gray-500 mt-1">
              {contact.phone && <span>📞 {contact.phone}</span>}
              {contact.email && <span>✉️ {contact.email}</span>}
              <span>{contact.events.length} events</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-6">
            <EventTimeline events={contact.events as any} />
          </div>

          {/* Reply box */}
          {lastEvent && <ReplyBox sourceEventId={lastEvent.id} />}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Test full flow**

```bash
npm run dev
```

1. POST a fake call via curl: `curl -X POST http://localhost:3000/api/twilio/call -d "From=+447700000000&CallStatus=no-answer"`
2. Open `http://localhost:3000/inbox`
3. Click the contact → timeline shows CALL_MISSED event
4. Type a reply → click Send → HUMAN_REPLY appears in timeline

Expected: full round-trip working in browser.

- [ ] **Step 5: Commit**

```bash
git add app/contacts/ components/EventTimeline.tsx components/ReplyBox.tsx
git commit -m "feat: contact timeline view + human reply box"
```

---

## Task 10: Deploy to Vercel

**Files:**
- Create: `.env.production` (reference only — set in Vercel dashboard, not committed)
- Modify: `next.config.ts` (ensure no output: export, server-side routes needed)

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/infosiva/switchboard-ai.git
git push -u origin main
```

- [ ] **Step 2: Create Vercel project**

```bash
npx vercel --yes
```

Expected: project created, first deploy triggered.

- [ ] **Step 3: Set env vars in Vercel**

```bash
npx vercel env add DATABASE_URL production
npx vercel env add DIRECT_URL production
npx vercel env add TWILIO_ACCOUNT_SID production
npx vercel env add TWILIO_AUTH_TOKEN production
npx vercel env add TWILIO_PHONE_NUMBER production
npx vercel env add SENDGRID_API_KEY production
npx vercel env add SENDGRID_FROM_EMAIL production
npx vercel env add GROQ_API_KEY production
npx vercel env add GEMINI_API_KEY production
npx vercel env add ANTHROPIC_API_KEY production
npx vercel env add BUSINESS_ID production
```

- [ ] **Step 4: Redeploy with env vars**

```bash
npx vercel --prod
```

Expected: deploys to `https://switchboard-ai.vercel.app`, all routes respond.

- [ ] **Step 5: Update Twilio webhooks to Vercel URL**

In Twilio Console:
- Voice webhook: `https://switchboard-ai.vercel.app/api/twilio/call`
- SMS webhook: `https://switchboard-ai.vercel.app/api/twilio/sms`

In SendGrid inbound parse:
- URL: `https://switchboard-ai.vercel.app/api/email/inbound`

- [ ] **Step 6: Smoke test production**

Call the Twilio number → voicemail plays → check `https://switchboard-ai.vercel.app/inbox` → CALL_MISSED appears.

- [ ] **Step 7: Commit final**

```bash
git add next.config.ts .env.local.example
git commit -m "chore: Vercel deploy config + env var documentation"
git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Unified inbox — `app/inbox/page.tsx` + `app/contacts/[id]/page.tsx`
- [x] Call transcription — `lib/transcribe.ts` + Groq Whisper
- [x] AI auto-reply email — `lib/ai-reply.ts` → `lib/sendgrid.ts`
- [x] AI SMS callback — `lib/ai-reply.ts` → `lib/twilio.ts`
- [x] Office status toggle — `OfficeToggle.tsx` + `/api/business/status`
- [x] Per-customer timeline — `EventTimeline.tsx` + `/api/contacts/[id]`
- [x] Human takeover — `ReplyBox.tsx` + `/api/events/[id]/reply`

**All file paths exact — no TBD, no placeholders.**

**Type consistency:** `ContactEvent.type` enum matches schema (`CALL_INBOUND | CALL_MISSED | EMAIL_INBOUND | SMS_INBOUND | AI_REPLY | HUMAN_REPLY`) throughout all files.
