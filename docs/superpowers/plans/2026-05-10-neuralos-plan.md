# NeuralOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NeuralOS MVP — Agentic OS with Obsidian vault memory, 3 agents, 5 skills, 3 plugins, and notification engine — deployable in 4 weeks.

**Architecture:** Next.js 15 App Router monorepo at `agents/neuralos/`. Vault is local markdown files in `~/.neuralvault/` read/written via API routes. Agents run as server-side async jobs. AI uses existing `lib/ai.ts` fallback chain (Groq→Gemini→Cerebras→Anthropic).

**Tech Stack:** Next.js 15, TypeScript, Tailwind, shadcn/ui, Prisma + PostgreSQL (Supabase free), NextAuth.js magic link, Stripe, Resend (email), node-cron, pgvector, Playwright (QA)

---

## File Map

```
neuralos/
├── app/
│   ├── layout.tsx                    # Root layout, providers
│   ├── page.tsx                      # Landing / marketing page
│   ├── (auth)/
│   │   ├── login/page.tsx            # Magic link login
│   │   └── verify/page.tsx           # Email verification
│   ├── (app)/
│   │   ├── layout.tsx                # App shell with command palette
│   │   ├── dashboard/page.tsx        # Main dashboard
│   │   ├── vault/page.tsx            # Vault browser
│   │   ├── vault/[slug]/page.tsx     # Single note view/edit
│   │   ├── agents/page.tsx           # Agent list + status
│   │   ├── agents/[id]/page.tsx      # Agent detail + logs
│   │   ├── missions/page.tsx         # Mission list
│   │   ├── missions/new/page.tsx     # Mission builder
│   │   ├── skills/page.tsx           # Skill library
│   │   └── settings/page.tsx         # Plugins, alerts, billing
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # NextAuth
│       ├── vault/route.ts                # CRUD vault notes
│       ├── vault/search/route.ts         # Semantic search
│       ├── agents/route.ts               # List/create agents
│       ├── agents/[id]/run/route.ts      # Trigger agent run
│       ├── agents/[id]/logs/route.ts     # Stream agent logs
│       ├── missions/route.ts             # CRUD missions
│       ├── missions/[id]/run/route.ts    # Trigger mission
│       ├── skills/route.ts               # List skills
│       ├── skills/[slug]/run/route.ts    # Run a skill
│       ├── plugins/route.ts              # List/connect plugins
│       ├── notifications/route.ts        # Send notification
│       ├── webhooks/stripe/route.ts      # Stripe webhook
│       └── cron/route.ts                 # Vercel cron handler
├── components/
│   ├── command-palette.tsx           # Global / command palette
│   ├── vault-editor.tsx              # Markdown editor (MDX)
│   ├── agent-card.tsx                # Agent status card
│   ├── mission-builder.tsx           # Visual mission flow builder
│   ├── skill-card.tsx                # Skill tile
│   ├── notification-toast.tsx        # In-app alert toast
│   └── layout/
│       ├── sidebar.tsx               # Left nav
│       └── topbar.tsx                # Top bar + palette trigger
├── lib/
│   ├── ai.ts                         # Copy from ai-platform-template (fallback chain)
│   ├── vault.ts                      # Read/write/list vault notes (fs + cloud)
│   ├── vector.ts                     # Embed text + pgvector search
│   ├── agents/
│   │   ├── base.ts                   # BaseAgent class
│   │   ├── research.ts               # ResearchAgent
│   │   ├── writer.ts                 # WriterAgent
│   │   └── monitor.ts                # MonitorAgent
│   ├── skills/
│   │   ├── registry.ts               # Skill registry + loader
│   │   ├── daily-brief.ts            # Daily Brief skill
│   │   ├── website-builder.ts        # Website Builder skill
│   │   ├── email-drafter.ts          # Email Drafter skill
│   │   ├── content-calendar.ts       # Content Calendar skill (wraps draftcal)
│   │   └── api-monitor.ts            # API Monitor skill (wraps site-watchdog)
│   ├── plugins/
│   │   ├── registry.ts               # Plugin registry
│   │   ├── gmail.ts                  # Gmail plugin
│   │   ├── telegram.ts               # Telegram plugin
│   │   └── github.ts                 # GitHub plugin
│   ├── notifications/
│   │   ├── engine.ts                 # Route alerts to channels
│   │   ├── email.ts                  # Resend email sender
│   │   └── telegram.ts               # Telegram bot sender
│   ├── db.ts                         # Prisma client singleton
│   ├── auth.ts                       # NextAuth config
│   └── stripe.ts                     # Stripe client + helpers
├── prisma/
│   └── schema.prisma                 # DB schema
├── __tests__/
│   ├── vault.test.ts
│   ├── agents/research.test.ts
│   ├── agents/writer.test.ts
│   ├── agents/monitor.test.ts
│   ├── skills/daily-brief.test.ts
│   ├── notifications/engine.test.ts
│   └── api/vault.test.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `neuralos/package.json`
- Create: `neuralos/next.config.ts`
- Create: `neuralos/.env.example`
- Create: `neuralos/tsconfig.json`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/sivaprakasam/projects/agents
npx create-next-app@latest neuralos \
  --typescript --tailwind --app --src-dir=no \
  --import-alias "@/*" --no-git
cd neuralos
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client prisma next-auth@beta \
  @auth/prisma-adapter stripe resend \
  @radix-ui/react-dialog @radix-ui/react-command \
  cmdk lucide-react class-variance-authority clsx \
  tailwind-merge @tanstack/react-query \
  node-cron marked gray-matter remark remark-html \
  openai groq-sdk @google/generative-ai
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom \
  tsx
```

- [ ] **Step 3: Init Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 4: Create `.env.example`**

```env
# Database (Supabase free tier)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-hex-32"
NEXTAUTH_URL="http://localhost:3000"

# Email (Resend free: 3k emails/mo)
RESEND_API_KEY=""
EMAIL_FROM="noreply@neuralos.app"

# AI (free chain — all optional, fallback order)
GROQ_API_KEY=""
GEMINI_API_KEY=""
CEREBRAS_API_KEY=""
ANTHROPIC_API_KEY=""
OLLAMA_HOST="http://localhost:11434"

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRO_PRICE_ID=""

# Telegram (for alerts)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# GitHub plugin
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Vault
VAULT_DIR="~/.neuralvault"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

- [ ] **Step 5: Configure `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
```

- [ ] **Step 6: Configure vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 7: Commit**

```bash
git add -p  # stage only neuralos/ files
git commit -m "feat: scaffold neuralos next.js project"
```

---

## Task 2: Database Schema

**Files:**
- Modify: `neuralos/prisma/schema.prisma`

- [ ] **Step 1: Write failing test**

Create `neuralos/__tests__/db-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("Prisma schema", () => {
  it("schema file exists and has User model", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync("./prisma/schema.prisma", "utf-8");
    expect(schema).toContain("model User");
    expect(schema).toContain("model VaultNote");
    expect(schema).toContain("model Agent");
    expect(schema).toContain("model Mission");
    expect(schema).toContain("model AgentLog");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd neuralos && npx vitest run __tests__/db-schema.test.ts
```
Expected: FAIL — schema missing models

- [ ] **Step 3: Write schema**

Replace `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  plan          Plan      @default(FREE)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  accounts      Account[]
  sessions      Session[]
  vaultNotes    VaultNote[]
  agents        Agent[]
  missions      Mission[]
  pluginTokens  PluginToken[]
  alertRules    AlertRule[]
}

enum Plan {
  FREE
  PRO
  TEAM
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}

model VaultNote {
  id          String   @id @default(cuid())
  userId      String
  slug        String
  title       String
  content     String   @db.Text
  tags        String[]
  embedding   Float[]
  source      String   @default("manual")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, slug])
  @@index([userId])
}

model Agent {
  id          String      @id @default(cuid())
  userId      String
  name        String
  type        AgentType
  config      Json        @default("{}")
  status      AgentStatus @default(IDLE)
  lastRunAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs        AgentLog[]
  missions    MissionStep[]
}

enum AgentType {
  RESEARCH
  WRITER
  MONITOR
}

enum AgentStatus {
  IDLE
  RUNNING
  ERROR
}

model AgentLog {
  id        String   @id @default(cuid())
  agentId   String
  level     String   @default("info")
  message   String   @db.Text
  meta      Json     @default("{}")
  createdAt DateTime @default(now())
  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
}

model Mission {
  id          String        @id @default(cuid())
  userId      String
  name        String
  description String?       @db.Text
  schedule    String?
  enabled     Boolean       @default(true)
  lastRunAt   DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  steps       MissionStep[]
}

model MissionStep {
  id        String  @id @default(cuid())
  missionId String
  agentId   String
  order     Int
  config    Json    @default("{}")
  mission   Mission @relation(fields: [missionId], references: [id], onDelete: Cascade)
  agent     Agent   @relation(fields: [agentId], references: [id])
  @@index([missionId])
}

model PluginToken {
  id        String   @id @default(cuid())
  userId    String
  plugin    String
  token     String   @db.Text
  meta      Json     @default("{}")
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, plugin])
}

model AlertRule {
  id       String  @id @default(cuid())
  userId   String
  name     String
  channel  String
  severity String  @default("info")
  config   Json    @default("{}")
  enabled  Boolean @default(true)
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Run test — confirm passes**

```bash
npx vitest run __tests__/db-schema.test.ts
```
Expected: PASS

- [ ] **Step 5: Push schema to Supabase**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/ __tests__/db-schema.test.ts
git commit -m "feat: add neuralos prisma schema"
```

---

## Task 3: Auth (Magic Link)

**Files:**
- Create: `neuralos/lib/auth.ts`
- Create: `neuralos/lib/db.ts`
- Create: `neuralos/app/api/auth/[...nextauth]/route.ts`
- Create: `neuralos/app/(auth)/login/page.tsx`

- [ ] **Step 1: Write failing test**

Create `neuralos/__tests__/auth.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

describe("auth config", () => {
  it("exports authOptions with email provider", async () => {
    const { authOptions } = await import("@/lib/auth");
    const providers = authOptions.providers ?? [];
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].type).toBe("email");
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/auth.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create `lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 4: Create `lib/auth.ts`**

```typescript
import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  providers: [
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: process.env.EMAIL_FROM ?? "noreply@neuralos.app",
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).plan = (user as any).plan;
      }
      return session;
    },
  },
};
```

- [ ] **Step 5: Create API route**

Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 6: Create login page**

Create `app/(auth)/login/page.tsx`:
```typescript
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn("email", { email, redirect: false });
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <h1 className="text-2xl font-bold text-white mb-2">NeuralOS</h1>
        <p className="text-white/50 mb-8 text-sm">Your AI brain. Your agents. Your OS.</p>
        {sent ? (
          <p className="text-green-400 text-sm">Check your email for a magic link.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition"
            >
              Continue with Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run test — confirm passes**

```bash
npx vitest run __tests__/auth.test.ts
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/auth.ts lib/db.ts app/api/auth app/(auth) __tests__/auth.test.ts
git commit -m "feat: add magic link auth"
```

---

## Task 4: AI Engine

**Files:**
- Create: `neuralos/lib/ai.ts`

- [ ] **Step 1: Write failing test**

Create `neuralos/__tests__/ai.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

describe("ai fallback chain", () => {
  it("exports generateText function", async () => {
    const { generateText } = await import("@/lib/ai");
    expect(typeof generateText).toBe("function");
  });

  it("exports streamText function", async () => {
    const { streamText } = await import("@/lib/ai");
    expect(typeof streamText).toBe("function");
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/ai.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/ai.ts`** (copy + adapt canonical template)

```typescript
// AI fallback chain: Groq → Gemini → Cerebras → Anthropic
// Near-zero cost — free tiers first

export type AIMessage = { role: "user" | "assistant" | "system"; content: string };

export interface GenerateOptions {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ProviderConfig {
  name: string;
  available: () => boolean;
  generate: (opts: GenerateOptions) => Promise<string>;
}

async function tryGroq(opts: GenerateOptions): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "llama-3.3-70b-versatile",
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.7,
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function tryGemini(opts: GenerateOptions): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = opts.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function tryCerebras(opts: GenerateOptions): Promise<string> {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error("no cerebras key");
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1-70b",
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!res.ok) throw new Error(`cerebras ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function tryAnthropic(opts: GenerateOptions): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no anthropic key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: opts.maxTokens ?? 2048,
      messages: opts.messages.filter((m) => m.role !== "system"),
      system: opts.messages.find((m) => m.role === "system")?.content,
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

const providers = [tryGroq, tryGemini, tryCerebras, tryAnthropic];

export async function generateText(opts: GenerateOptions): Promise<string> {
  let lastError: Error | undefined;
  for (const provider of providers) {
    try {
      return await provider(opts);
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error("all AI providers failed");
}

// Streaming: yields chunks. Falls back to non-streaming if provider fails.
export async function* streamText(opts: GenerateOptions): AsyncGenerator<string> {
  const key = process.env.GROQ_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts.model ?? "llama-3.3-70b-versatile",
          messages: opts.messages,
          max_tokens: opts.maxTokens ?? 2048,
          stream: true,
        }),
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const json = line.slice(6);
            if (json === "[DONE]") return;
            try {
              const chunk = JSON.parse(json);
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) yield text;
            } catch {}
          }
        }
      }
    } catch {}
  }
  // Fallback: non-streaming
  const text = await generateText(opts);
  yield text;
}
```

- [ ] **Step 4: Run test — confirm passes**

```bash
npx vitest run __tests__/ai.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai.ts __tests__/ai.test.ts
git commit -m "feat: add ai fallback chain groq→gemini→cerebras→anthropic"
```

---

## Task 5: Vault (Memory Layer)

**Files:**
- Create: `neuralos/lib/vault.ts`
- Create: `neuralos/app/api/vault/route.ts`
- Create: `neuralos/app/api/vault/search/route.ts`

- [ ] **Step 1: Write failing tests**

Create `neuralos/__tests__/vault.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    vaultNote: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "1", slug: "test-note", title: "Test", content: "hello", tags: [], updatedAt: new Date() }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("vault", () => {
  it("parseNote extracts frontmatter title and tags", async () => {
    const { parseNote } = await import("@/lib/vault");
    const result = parseNote("---\ntitle: My Note\ntags: [ai, tools]\n---\n\n# Hello");
    expect(result.title).toBe("My Note");
    expect(result.tags).toEqual(["ai", "tools"]);
    expect(result.content).toContain("# Hello");
  });

  it("slugify converts title to slug", async () => {
    const { slugify } = await import("@/lib/vault");
    expect(slugify("My Cool Note")).toBe("my-cool-note");
    expect(slugify("Hello World! 2024")).toBe("hello-world-2024");
  });

  it("listNotes returns array", async () => {
    const { listNotes } = await import("@/lib/vault");
    const notes = await listNotes("user-1");
    expect(Array.isArray(notes)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/vault.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/vault.ts`**

```typescript
import matter from "gray-matter";
import { db } from "@/lib/db";

export interface VaultNote {
  id: string;
  slug: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: Date;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function parseNote(raw: string): { title: string; tags: string[]; content: string } {
  const { data, content } = matter(raw);
  return {
    title: data.title ?? "Untitled",
    tags: Array.isArray(data.tags) ? data.tags : [],
    content: content.trim(),
  };
}

export async function listNotes(userId: string): Promise<VaultNote[]> {
  return db.vaultNote.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, content: true, tags: true, updatedAt: true },
  });
}

export async function getNote(userId: string, slug: string): Promise<VaultNote | null> {
  return db.vaultNote.findUnique({
    where: { userId_slug: { userId, slug } },
    select: { id: true, slug: true, title: true, content: true, tags: true, updatedAt: true },
  });
}

export async function upsertNote(
  userId: string,
  slug: string,
  raw: string
): Promise<VaultNote> {
  const { title, tags, content } = parseNote(raw);
  return db.vaultNote.upsert({
    where: { userId_slug: { userId, slug } },
    update: { title, tags, content, updatedAt: new Date() },
    create: { userId, slug, title, tags, content, embedding: [] },
    select: { id: true, slug: true, title: true, content: true, tags: true, updatedAt: true },
  });
}

export async function deleteNote(userId: string, slug: string): Promise<void> {
  await db.vaultNote.delete({ where: { userId_slug: { userId, slug } } });
}

export async function searchNotes(userId: string, query: string): Promise<VaultNote[]> {
  // Full-text search — pgvector semantic search added in Task 6
  return db.vaultNote.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, slug: true, title: true, content: true, tags: true, updatedAt: true },
  });
}

// Inject top-k relevant notes as context for agents
export async function getContext(userId: string, query: string, k = 5): Promise<string> {
  const notes = await searchNotes(userId, query);
  return notes
    .slice(0, k)
    .map((n) => `## ${n.title}\n${n.content}`)
    .join("\n\n---\n\n");
}
```

- [ ] **Step 4: Create `app/api/vault/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listNotes, upsertNote, deleteNote, slugify } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const notes = await listNotes(userId);
  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { content, title } = await req.json();
  if (!content || !title) return NextResponse.json({ error: "content and title required" }, { status: 400 });
  const slug = slugify(title);
  const note = await upsertNote(userId, slug, `---\ntitle: ${title}\n---\n\n${content}`);
  return NextResponse.json({ note });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { slug } = await req.json();
  await deleteNote(userId, slug);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `app/api/vault/search/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchNotes } from "@/lib/vault";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ notes: [] });
  const notes = await searchNotes(userId, q);
  return NextResponse.json({ notes });
}
```

- [ ] **Step 6: Run tests — confirm pass**

```bash
npx vitest run __tests__/vault.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/vault.ts app/api/vault __tests__/vault.test.ts
git commit -m "feat: vault memory layer — read/write/search markdown notes"
```

---

## Task 6: Agent Engine (Base + Research + Writer + Monitor)

**Files:**
- Create: `neuralos/lib/agents/base.ts`
- Create: `neuralos/lib/agents/research.ts`
- Create: `neuralos/lib/agents/writer.ts`
- Create: `neuralos/lib/agents/monitor.ts`
- Create: `neuralos/app/api/agents/route.ts`
- Create: `neuralos/app/api/agents/[id]/run/route.ts`

- [ ] **Step 1: Write failing tests**

Create `neuralos/__tests__/agents/research.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai", () => ({
  generateText: vi.fn().mockResolvedValue("Research summary: AI is growing fast."),
}));
vi.mock("@/lib/vault", () => ({
  getContext: vi.fn().mockResolvedValue("Context: AI trends 2025."),
  upsertNote: vi.fn().mockResolvedValue({ slug: "research-ai" }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    agent: { update: vi.fn().mockResolvedValue({}) },
    agentLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

describe("ResearchAgent", () => {
  it("runs and returns summary saved to vault", async () => {
    const { ResearchAgent } = await import("@/lib/agents/research");
    const agent = new ResearchAgent({ id: "a1", userId: "u1", topic: "AI trends" });
    const result = await agent.run();
    expect(result.summary).toContain("AI");
    expect(result.savedSlug).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/agents/research.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/agents/base.ts`**

```typescript
import { db } from "@/lib/db";

export interface AgentRunResult {
  ok: boolean;
  output: string;
  error?: string;
}

export abstract class BaseAgent {
  protected id: string;
  protected userId: string;

  constructor({ id, userId }: { id: string; userId: string }) {
    this.id = id;
    this.userId = userId;
  }

  abstract run(): Promise<AgentRunResult & Record<string, any>>;

  protected async log(level: "info" | "error" | "warn", message: string, meta: Record<string, any> = {}) {
    await db.agentLog.create({
      data: { agentId: this.id, level, message, meta },
    });
  }

  protected async setStatus(status: "RUNNING" | "IDLE" | "ERROR") {
    await db.agent.update({
      where: { id: this.id },
      data: {
        status,
        ...(status === "IDLE" ? { lastRunAt: new Date() } : {}),
      },
    });
  }
}
```

- [ ] **Step 4: Create `lib/agents/research.ts`**

```typescript
import { BaseAgent, AgentRunResult } from "./base";
import { generateText } from "@/lib/ai";
import { getContext, upsertNote, slugify } from "@/lib/vault";

interface ResearchConfig {
  id: string;
  userId: string;
  topic: string;
}

export class ResearchAgent extends BaseAgent {
  private topic: string;

  constructor(config: ResearchConfig) {
    super(config);
    this.topic = config.topic;
  }

  async run(): Promise<AgentRunResult & { summary: string; savedSlug: string }> {
    await this.setStatus("RUNNING");
    await this.log("info", `Researching: ${this.topic}`);
    try {
      const context = await getContext(this.userId, this.topic, 3);
      const summary = await generateText({
        messages: [
          {
            role: "system",
            content: `You are a research assistant. Use the vault context below to enhance your answer.\n\nVault context:\n${context}`,
          },
          {
            role: "user",
            content: `Research and summarise in 300 words: ${this.topic}`,
          },
        ],
        maxTokens: 600,
      });
      const slug = `research-${slugify(this.topic)}-${Date.now()}`;
      const note = await upsertNote(
        this.userId,
        slug,
        `---\ntitle: Research: ${this.topic}\ntags: [research, agent]\n---\n\n${summary}`
      );
      await this.setStatus("IDLE");
      await this.log("info", `Saved research to vault: ${note.slug}`);
      return { ok: true, output: summary, summary, savedSlug: note.slug };
    } catch (err: any) {
      await this.setStatus("ERROR");
      await this.log("error", err.message);
      return { ok: false, output: "", summary: "", savedSlug: "", error: err.message };
    }
  }
}
```

- [ ] **Step 5: Create `lib/agents/writer.ts`**

```typescript
import { BaseAgent, AgentRunResult } from "./base";
import { generateText } from "@/lib/ai";
import { getContext, upsertNote, slugify } from "@/lib/vault";

interface WriterConfig {
  id: string;
  userId: string;
  task: string; // e.g. "Write a blog post about AI trends"
  format: "blog" | "email" | "social" | "report";
}

export class WriterAgent extends BaseAgent {
  private task: string;
  private format: string;

  constructor(config: WriterConfig) {
    super(config);
    this.task = config.task;
    this.format = config.format;
  }

  async run(): Promise<AgentRunResult & { draft: string; savedSlug: string }> {
    await this.setStatus("RUNNING");
    await this.log("info", `Writing ${this.format}: ${this.task}`);
    try {
      const context = await getContext(this.userId, this.task, 5);
      const formatGuide: Record<string, string> = {
        blog: "Write a 500-word blog post with H2 headings. Engaging, informative tone.",
        email: "Write a professional email. Subject line first, then body. Concise.",
        social: "Write 3 social media post variants (Twitter/LinkedIn/Instagram). Under 280 chars each.",
        report: "Write a structured report with Executive Summary, Key Findings, and Recommendations.",
      };
      const draft = await generateText({
        messages: [
          {
            role: "system",
            content: `You are an expert writer. Use vault context for personalization.\n\nVault context:\n${context}\n\n${formatGuide[this.format] ?? ""}`,
          },
          { role: "user", content: this.task },
        ],
        maxTokens: 1200,
      });
      const slug = `draft-${slugify(this.task)}-${Date.now()}`;
      const note = await upsertNote(
        this.userId,
        slug,
        `---\ntitle: Draft: ${this.task}\ntags: [draft, ${this.format}, agent]\n---\n\n${draft}`
      );
      await this.setStatus("IDLE");
      return { ok: true, output: draft, draft, savedSlug: note.slug };
    } catch (err: any) {
      await this.setStatus("ERROR");
      await this.log("error", err.message);
      return { ok: false, output: "", draft: "", savedSlug: "", error: err.message };
    }
  }
}
```

- [ ] **Step 6: Create `lib/agents/monitor.ts`**

```typescript
import { BaseAgent, AgentRunResult } from "./base";
import { generateText } from "@/lib/ai";
import { upsertNote, slugify } from "@/lib/vault";
import { sendNotification } from "@/lib/notifications/engine";

interface MonitorConfig {
  id: string;
  userId: string;
  url: string;
  checkType: "uptime" | "content" | "price";
  alertThreshold?: string; // e.g. "price below 100" or "keyword: sold out"
}

export class MonitorAgent extends BaseAgent {
  private url: string;
  private checkType: string;
  private alertThreshold: string;

  constructor(config: MonitorConfig) {
    super(config);
    this.url = config.url;
    this.checkType = config.checkType;
    this.alertThreshold = config.alertThreshold ?? "";
  }

  async run(): Promise<AgentRunResult & { status: string; triggered: boolean }> {
    await this.setStatus("RUNNING");
    await this.log("info", `Monitoring ${this.checkType}: ${this.url}`);
    try {
      const res = await fetch(this.url, { method: "GET", signal: AbortSignal.timeout(10000) });
      const status = `${res.status}`;
      let triggered = false;
      let summary = `URL: ${this.url} | Status: ${status}`;

      if (this.checkType === "uptime" && !res.ok) {
        triggered = true;
        await sendNotification({
          userId: this.userId,
          severity: "critical",
          title: `Site down: ${this.url}`,
          message: `HTTP ${status} at ${new Date().toISOString()}`,
        });
      }

      if (this.checkType === "content" && this.alertThreshold) {
        const text = await res.text();
        const analysis = await generateText({
          messages: [
            { role: "system", content: "Analyse page content. Answer only yes or no." },
            { role: "user", content: `Does this page match the condition "${this.alertThreshold}"?\n\n${text.slice(0, 3000)}` },
          ],
          maxTokens: 10,
        });
        if (analysis.toLowerCase().includes("yes")) {
          triggered = true;
          await sendNotification({
            userId: this.userId,
            severity: "warning",
            title: `Monitor triggered: ${this.url}`,
            message: `Condition met: ${this.alertThreshold}`,
          });
        }
      }

      const slug = `monitor-${slugify(this.url)}-${Date.now()}`;
      await upsertNote(
        this.userId,
        slug,
        `---\ntitle: Monitor: ${this.url}\ntags: [monitor, agent]\n---\n\n${summary}\nTriggered: ${triggered}`
      );

      await this.setStatus("IDLE");
      return { ok: true, output: summary, status, triggered };
    } catch (err: any) {
      await this.setStatus("ERROR");
      await this.log("error", err.message);
      return { ok: false, output: "", status: "error", triggered: false, error: err.message };
    }
  }
}
```

- [ ] **Step 7: Create agents API routes**

Create `app/api/agents/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const agents = await db.agent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { name, type, config } = await req.json();
  if (!name || !type) return NextResponse.json({ error: "name and type required" }, { status: 400 });
  const agent = await db.agent.create({ data: { userId, name, type, config: config ?? {} } });
  return NextResponse.json({ agent });
}
```

Create `app/api/agents/[id]/run/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ResearchAgent } from "@/lib/agents/research";
import { WriterAgent } from "@/lib/agents/writer";
import { MonitorAgent } from "@/lib/agents/monitor";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const agent = await db.agent.findFirst({ where: { id: params.id, userId } });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cfg = agent.config as any;
  let result;

  if (agent.type === "RESEARCH") {
    result = await new ResearchAgent({ id: agent.id, userId, topic: cfg.topic ?? "general" }).run();
  } else if (agent.type === "WRITER") {
    result = await new WriterAgent({ id: agent.id, userId, task: cfg.task ?? "", format: cfg.format ?? "blog" }).run();
  } else if (agent.type === "MONITOR") {
    result = await new MonitorAgent({ id: agent.id, userId, url: cfg.url ?? "", checkType: cfg.checkType ?? "uptime", alertThreshold: cfg.alertThreshold }).run();
  } else {
    return NextResponse.json({ error: "unknown agent type" }, { status: 400 });
  }

  return NextResponse.json({ result });
}
```

- [ ] **Step 8: Run tests — confirm pass**

```bash
npx vitest run __tests__/agents/
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/agents/ app/api/agents/ __tests__/agents/
git commit -m "feat: add research/writer/monitor agents with vault context injection"
```

---

## Task 7: Notification Engine

**Files:**
- Create: `neuralos/lib/notifications/engine.ts`
- Create: `neuralos/lib/notifications/email.ts`
- Create: `neuralos/lib/notifications/telegram.ts`

- [ ] **Step 1: Write failing test**

Create `neuralos/__tests__/notifications/engine.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/notifications/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/notifications/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue({ ok: true }) }));
vi.mock("@/lib/db", () => ({
  db: {
    alertRule: {
      findMany: vi.fn().mockResolvedValue([
        { channel: "email", severity: "info", enabled: true, config: { to: "test@test.com" } },
      ]),
    },
  },
}));

describe("notification engine", () => {
  it("routes info alert to email channel", async () => {
    const { sendNotification } = await import("@/lib/notifications/engine");
    const { sendEmail } = await import("@/lib/notifications/email");
    await sendNotification({ userId: "u1", severity: "info", title: "Test", message: "Hello" });
    expect(sendEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/notifications/engine.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/notifications/email.ts`**

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean }> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@neuralos.app",
    to,
    subject,
    html,
  });
  return { ok: !error };
}
```

- [ ] **Step 4: Create `lib/notifications/telegram.ts`**

```typescript
export async function sendTelegram({
  message,
  chatId,
}: {
  message: string;
  chatId?: string;
}): Promise<{ ok: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: message, parse_mode: "Markdown" }),
  });
  return { ok: res.ok };
}
```

- [ ] **Step 5: Create `lib/notifications/engine.ts`**

```typescript
import { db } from "@/lib/db";
import { sendEmail } from "./email";
import { sendTelegram } from "./telegram";

export interface NotificationPayload {
  userId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const rules = await db.alertRule.findMany({
    where: { userId: payload.userId, enabled: true },
  });

  // Critical alerts always go to Telegram if configured
  if (payload.severity === "critical") {
    await sendTelegram({
      message: `🚨 *${payload.title}*\n${payload.message}`,
    });
  }

  for (const rule of rules) {
    const cfg = rule.config as any;
    if (rule.channel === "email" && cfg.to) {
      await sendEmail({
        to: cfg.to,
        subject: `[NeuralOS] ${payload.title}`,
        html: `<p><strong>${payload.title}</strong></p><p>${payload.message}</p>`,
      });
    }
    if (rule.channel === "telegram") {
      await sendTelegram({
        message: `[${payload.severity.toUpperCase()}] *${payload.title}*\n${payload.message}`,
        chatId: cfg.chatId,
      });
    }
  }
}
```

- [ ] **Step 6: Create `app/api/notifications/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications/engine";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { severity, title, message } = await req.json();
  await sendNotification({ userId, severity, title, message });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run tests — confirm pass**

```bash
npx vitest run __tests__/notifications/
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/notifications/ app/api/notifications/ __tests__/notifications/
git commit -m "feat: notification engine — email + telegram alert routing"
```

---

## Task 8: Skills Engine (5 MVP Skills)

**Files:**
- Create: `neuralos/lib/skills/registry.ts`
- Create: `neuralos/lib/skills/daily-brief.ts`
- Create: `neuralos/lib/skills/website-builder.ts`
- Create: `neuralos/lib/skills/email-drafter.ts`
- Create: `neuralos/lib/skills/content-calendar.ts`
- Create: `neuralos/lib/skills/api-monitor.ts`

- [ ] **Step 1: Write failing test**

Create `neuralos/__tests__/skills/daily-brief.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ai", () => ({ generateText: vi.fn().mockResolvedValue("Your brief: AI is trending.") }));
vi.mock("@/lib/vault", () => ({ getContext: vi.fn().mockResolvedValue(""), upsertNote: vi.fn().mockResolvedValue({ slug: "brief-123" }) }));
vi.mock("@/lib/notifications/engine", () => ({ sendNotification: vi.fn().mockResolvedValue(undefined) }));

describe("DailyBriefSkill", () => {
  it("runs and returns brief", async () => {
    const { DailyBriefSkill } = await import("@/lib/skills/daily-brief");
    const skill = new DailyBriefSkill({ userId: "u1", topics: ["AI", "tech"] });
    const result = await skill.run();
    expect(result.ok).toBe(true);
    expect(result.brief).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run __tests__/skills/daily-brief.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create `lib/skills/registry.ts`**

```typescript
export interface SkillMeta {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: "productivity" | "ai" | "business" | "finance" | "learning" | "communication";
  free: boolean;
}

export const SKILL_REGISTRY: SkillMeta[] = [
  { slug: "daily-brief", name: "Daily Brief", description: "Get a personalised morning brief from your vault + news.", icon: "☀️", category: "productivity", free: true },
  { slug: "website-builder", name: "Website Builder", description: "Generate a full Next.js site from a prompt and deploy to Vercel.", icon: "🌐", category: "ai", free: false },
  { slug: "email-drafter", name: "Email Drafter", description: "Write emails using your vault contact context.", icon: "✉️", category: "productivity", free: true },
  { slug: "content-calendar", name: "Content Calendar", description: "Plan + schedule social posts. Powered by draftcal.", icon: "📅", category: "business", free: false },
  { slug: "api-monitor", name: "API Monitor", description: "Watch your endpoints and get alerted on downtime.", icon: "📡", category: "business", free: true },
];
```

- [ ] **Step 4: Create `lib/skills/daily-brief.ts`**

```typescript
import { generateText } from "@/lib/ai";
import { getContext, upsertNote } from "@/lib/vault";
import { sendNotification } from "@/lib/notifications/engine";

interface DailyBriefConfig {
  userId: string;
  topics: string[];
}

export class DailyBriefSkill {
  private userId: string;
  private topics: string[];

  constructor(config: DailyBriefConfig) {
    this.userId = config.userId;
    this.topics = config.topics;
  }

  async run(): Promise<{ ok: boolean; brief: string; savedSlug: string }> {
    const topicList = this.topics.join(", ");
    const context = await getContext(this.userId, topicList, 5);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const brief = await generateText({
      messages: [
        {
          role: "system",
          content: `You are a personal assistant. Write a concise morning brief using vault context.\n\nVault context:\n${context}`,
        },
        {
          role: "user",
          content: `Today is ${today}. Write a 200-word morning brief covering: ${topicList}. Include key insights from my vault. End with 3 action items for today.`,
        },
      ],
      maxTokens: 400,
    });

    const slug = `daily-brief-${Date.now()}`;
    const note = await upsertNote(
      this.userId,
      slug,
      `---\ntitle: Daily Brief — ${today}\ntags: [brief, daily, agent]\n---\n\n${brief}`
    );

    await sendNotification({
      userId: this.userId,
      severity: "info",
      title: `Daily Brief — ${today}`,
      message: brief.slice(0, 200) + "...",
    });

    return { ok: true, brief, savedSlug: note.slug };
  }
}
```

- [ ] **Step 5: Create `lib/skills/email-drafter.ts`**

```typescript
import { generateText } from "@/lib/ai";
import { getContext, upsertNote, slugify } from "@/lib/vault";

interface EmailDrafterConfig {
  userId: string;
  to: string;
  purpose: string; // e.g. "follow up on proposal from last week"
}

export class EmailDrafterSkill {
  private userId: string;
  private to: string;
  private purpose: string;

  constructor(config: EmailDrafterConfig) {
    this.userId = config.userId;
    this.to = config.to;
    this.purpose = config.purpose;
  }

  async run(): Promise<{ ok: boolean; subject: string; body: string; savedSlug: string }> {
    const context = await getContext(this.userId, `${this.to} ${this.purpose}`, 3);

    const draft = await generateText({
      messages: [
        {
          role: "system",
          content: `You are a professional email writer. Use vault context to personalise.\n\nVault context:\n${context}\n\nOutput format:\nSUBJECT: <subject line>\n\n<email body>`,
        },
        {
          role: "user",
          content: `Write a professional email to ${this.to}. Purpose: ${this.purpose}`,
        },
      ],
      maxTokens: 500,
    });

    const subjectMatch = draft.match(/SUBJECT:\s*(.+)/);
    const subject = subjectMatch?.[1] ?? "Email Draft";
    const body = draft.replace(/SUBJECT:.+\n?/, "").trim();

    const slug = `email-${slugify(this.purpose)}-${Date.now()}`;
    const note = await upsertNote(
      this.userId,
      slug,
      `---\ntitle: Email Draft: ${this.purpose}\ntags: [email, draft, agent]\n---\n\n**To:** ${this.to}\n**Subject:** ${subject}\n\n${body}`
    );

    return { ok: true, subject, body, savedSlug: note.slug };
  }
}
```

- [ ] **Step 6: Create `lib/skills/api-monitor.ts`**

```typescript
import { MonitorAgent } from "@/lib/agents/monitor";
import { db } from "@/lib/db";

interface ApiMonitorConfig {
  userId: string;
  urls: string[];
}

export class ApiMonitorSkill {
  private userId: string;
  private urls: string[];

  constructor(config: ApiMonitorConfig) {
    this.userId = config.userId;
    this.urls = config.urls;
  }

  async run(): Promise<{ ok: boolean; results: Array<{ url: string; status: string; triggered: boolean }> }> {
    const results = [];
    for (const url of this.urls) {
      // Get or create monitor agent for this URL
      let agent = await db.agent.findFirst({
        where: { userId: this.userId, type: "MONITOR", config: { path: ["url"], equals: url } },
      });
      if (!agent) {
        agent = await db.agent.create({
          data: { userId: this.userId, name: `Monitor: ${url}`, type: "MONITOR", config: { url, checkType: "uptime" } },
        });
      }
      const result = await new MonitorAgent({ id: agent.id, userId: this.userId, url, checkType: "uptime" }).run();
      results.push({ url, status: result.status, triggered: result.triggered });
    }
    return { ok: true, results };
  }
}
```

- [ ] **Step 7: Create `lib/skills/website-builder.ts`**

```typescript
import { generateText } from "@/lib/ai";
import { upsertNote, slugify } from "@/lib/vault";

interface WebsiteBuilderConfig {
  userId: string;
  prompt: string; // e.g. "Landing page for a SaaS that tracks invoices"
  deployToVercel?: boolean;
}

export class WebsiteBuilderSkill {
  private userId: string;
  private prompt: string;

  constructor(config: WebsiteBuilderConfig) {
    this.userId = config.userId;
    this.prompt = config.prompt;
  }

  async run(): Promise<{ ok: boolean; code: string; savedSlug: string }> {
    const code = await generateText({
      messages: [
        {
          role: "system",
          content: `You are an expert Next.js developer. Generate a complete, production-ready Next.js 15 App Router page component. Use Tailwind CSS. Include: hero section, features, CTA, footer. Export as default. No explanations — code only.`,
        },
        {
          role: "user",
          content: `Build: ${this.prompt}`,
        },
      ],
      maxTokens: 2000,
    });

    const slug = `website-${slugify(this.prompt)}-${Date.now()}`;
    const note = await upsertNote(
      this.userId,
      slug,
      `---\ntitle: Website: ${this.prompt}\ntags: [website, generated, agent]\n---\n\n\`\`\`tsx\n${code}\n\`\`\``
    );

    return { ok: true, code, savedSlug: note.slug };
  }
}
```

- [ ] **Step 8: Create `lib/skills/content-calendar.ts`**

```typescript
import { generateText } from "@/lib/ai";
import { upsertNote, slugify } from "@/lib/vault";

interface ContentCalendarConfig {
  userId: string;
  niche: string;
  weeks: number;
  platforms: Array<"twitter" | "linkedin" | "instagram">;
}

export class ContentCalendarSkill {
  private userId: string;
  private niche: string;
  private weeks: number;
  private platforms: string[];

  constructor(config: ContentCalendarConfig) {
    this.userId = config.userId;
    this.niche = config.niche;
    this.weeks = config.weeks;
    this.platforms = config.platforms;
  }

  async run(): Promise<{ ok: boolean; calendar: string; savedSlug: string }> {
    const calendar = await generateText({
      messages: [
        {
          role: "system",
          content: "You are a social media strategist. Generate a detailed content calendar in markdown table format.",
        },
        {
          role: "user",
          content: `Generate a ${this.weeks}-week content calendar for: ${this.niche}\nPlatforms: ${this.platforms.join(", ")}\n\nFormat: | Week | Day | Platform | Topic | Hook | CTA |`,
        },
      ],
      maxTokens: 1500,
    });

    const slug = `calendar-${slugify(this.niche)}-${Date.now()}`;
    const note = await upsertNote(
      this.userId,
      slug,
      `---\ntitle: Content Calendar: ${this.niche}\ntags: [calendar, content, social]\n---\n\n${calendar}`
    );

    return { ok: true, calendar, savedSlug: note.slug };
  }
}
```

- [ ] **Step 9: Create `app/api/skills/[slug]/run/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DailyBriefSkill } from "@/lib/skills/daily-brief";
import { WebsiteBuilderSkill } from "@/lib/skills/website-builder";
import { EmailDrafterSkill } from "@/lib/skills/email-drafter";
import { ContentCalendarSkill } from "@/lib/skills/content-calendar";
import { ApiMonitorSkill } from "@/lib/skills/api-monitor";

const skillMap: Record<string, any> = {
  "daily-brief": DailyBriefSkill,
  "website-builder": WebsiteBuilderSkill,
  "email-drafter": EmailDrafterSkill,
  "content-calendar": ContentCalendarSkill,
  "api-monitor": ApiMonitorSkill,
};

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const SkillClass = skillMap[params.slug];
  if (!SkillClass) return NextResponse.json({ error: "skill not found" }, { status: 404 });
  const config = await req.json();
  const result = await new SkillClass({ userId, ...config }).run();
  return NextResponse.json({ result });
}
```

- [ ] **Step 10: Run tests — confirm pass**

```bash
npx vitest run __tests__/skills/
```
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add lib/skills/ app/api/skills/ __tests__/skills/
git commit -m "feat: 5 MVP skills — daily-brief, website-builder, email-drafter, content-calendar, api-monitor"
```

---

## Task 9: Command Palette + App Shell UI

**Files:**
- Create: `neuralos/components/command-palette.tsx`
- Create: `neuralos/components/layout/sidebar.tsx`
- Create: `neuralos/app/(app)/layout.tsx`
- Create: `neuralos/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Install cmdk**

```bash
npm install cmdk
```

- [ ] **Step 2: Create `components/command-palette.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm">
      <Command
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden"
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        <Command.Input
          placeholder="Type a command or search vault..."
          className="w-full px-6 py-4 bg-transparent text-white text-lg outline-none border-b border-white/10 placeholder-white/30"
        />
        <Command.List className="p-2 max-h-80 overflow-y-auto">
          <Command.Empty className="px-4 py-6 text-white/40 text-sm text-center">No results.</Command.Empty>

          <Command.Group heading="Agents" className="px-2 py-1 text-xs text-white/30 uppercase tracking-wider">
            <Command.Item onSelect={() => { router.push("/agents"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer flex items-center gap-3">
              🤖 Run Research Agent
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/agents"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer flex items-center gap-3">
              ✍️ Run Writer Agent
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Skills" className="px-2 py-1 text-xs text-white/30 uppercase tracking-wider mt-2">
            <Command.Item onSelect={() => { router.push("/skills"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer">
              ☀️ Daily Brief
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/skills"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer">
              🌐 Website Builder
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/skills"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer">
              ✉️ Email Drafter
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Vault" className="px-2 py-1 text-xs text-white/30 uppercase tracking-wider mt-2">
            <Command.Item onSelect={() => { router.push("/vault"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer">
              📝 Browse Vault
            </Command.Item>
            <Command.Item onSelect={() => { router.push("/vault"); setOpen(false); }} className="px-4 py-2 rounded-lg text-white hover:bg-white/10 cursor-pointer">
              🔍 Search Notes
            </Command.Item>
          </Command.Group>
        </Command.List>
        <div className="px-4 py-2 border-t border-white/10 flex gap-4 text-xs text-white/30">
          <span>↵ select</span><span>↑↓ navigate</span><span>esc close</span>
        </div>
      </Command>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/layout/sidebar.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", icon: "⚡", label: "Dashboard" },
  { href: "/vault", icon: "🧠", label: "Vault" },
  { href: "/agents", icon: "🤖", label: "Agents" },
  { href: "/missions", icon: "🎯", label: "Missions" },
  { href: "/skills", icon: "⚡", label: "Skills" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 h-screen bg-zinc-950 border-r border-white/5 flex flex-col p-4 gap-1 fixed left-0 top-0">
      <div className="mb-6 px-2">
        <span className="text-white font-bold text-lg">NeuralOS</span>
        <span className="text-white/30 text-xs ml-2">beta</span>
      </div>
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            path.startsWith(item.href)
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white hover:bg-white/5"
          }`}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
      <div className="mt-auto px-2 text-xs text-white/20">
        Press <kbd className="bg-white/10 px-1 rounded">⌘/</kbd> to open palette
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Create `app/(app)/layout.tsx`**

```typescript
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Sidebar />
      <main className="ml-56 p-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
```

- [ ] **Step 5: Create `app/(app)/dashboard/page.tsx`**

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;

  const [noteCount, agentCount, missionCount] = await Promise.all([
    db.vaultNote.count({ where: { userId } }),
    db.agent.count({ where: { userId } }),
    db.mission.count({ where: { userId } }),
  ]);

  const recentLogs = await db.agentLog.findMany({
    where: { agent: { userId } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { agent: { select: { name: true } } },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Welcome back, {session!.user?.name ?? session!.user?.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Vault Notes", value: noteCount, icon: "🧠", href: "/vault" },
          { label: "Agents", value: agentCount, icon: "🤖", href: "/agents" },
          { label: "Missions", value: missionCount, icon: "🎯", href: "/missions" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-white/50 text-sm">{stat.label}</div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Agent Activity</h2>
        <div className="space-y-2">
          {recentLogs.length === 0 && (
            <p className="text-white/30 text-sm">No agent activity yet. Run a skill to get started.</p>
          )}
          {recentLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${log.level === "error" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                {log.level}
              </span>
              <div>
                <p className="text-sm text-white/80">{log.agent.name}</p>
                <p className="text-xs text-white/40">{log.message}</p>
              </div>
              <span className="ml-auto text-xs text-white/20">{new Date(log.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Run Daily Brief", icon: "☀️", href: "/skills" },
            { label: "Build a Website", icon: "🌐", href: "/skills" },
            { label: "Draft an Email", icon: "✉️", href: "/skills" },
            { label: "Add Vault Note", icon: "📝", href: "/vault" },
          ].map((action) => (
            <Link key={action.label} href={action.href}
              className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm">
              <span className="text-xl">{action.icon}</span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ app/(app)/layout.tsx app/(app)/dashboard/
git commit -m "feat: command palette + app shell + dashboard"
```

---

## Task 10: Stripe Billing

**Files:**
- Create: `neuralos/lib/stripe.ts`
- Create: `neuralos/app/api/webhooks/stripe/route.ts`
- Modify: `neuralos/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create `lib/stripe.ts`**

```typescript
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-11-20.acacia",
});

export async function createCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url!;
}

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}
```

- [ ] **Step 2: Create Stripe webhook handler**

Create `app/api/webhooks/stripe/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const userId = session.metadata?.userId;
    if (userId) {
      await db.user.update({
        where: { id: userId },
        data: { plan: "PRO" },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as any;
    const customer = await stripe.customers.retrieve(sub.customer) as any;
    const user = await db.user.findFirst({ where: { email: customer.email } });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { plan: "FREE" } });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create upgrade API route**

Create `app/api/upgrade/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await createCheckoutSession({
    userId,
    email: session.user.email!,
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    successUrl: `${appUrl}/dashboard?upgraded=1`,
    cancelUrl: `${appUrl}/settings`,
  });
  return NextResponse.json({ url });
}
```

- [ ] **Step 4: Create `app/(app)/settings/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const plan = (session?.user as any)?.plan ?? "FREE";

  async function handleUpgrade() {
    setLoading(true);
    const res = await fetch("/api/upgrade", { method: "POST" });
    const { url } = await res.json();
    window.location.href = url;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
        <h2 className="font-semibold mb-4">Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{plan === "PRO" ? "Pro" : "Free"} Plan</p>
            <p className="text-white/40 text-sm">
              {plan === "PRO" ? "Unlimited agents, all skills, cloud sync" : "3 agents, basic skills, local only"}
            </p>
          </div>
          {plan === "FREE" && (
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="px-6 py-2 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition disabled:opacity-50"
            >
              {loading ? "Redirecting..." : "Upgrade to Pro — $12/mo"}
            </button>
          )}
          {plan === "PRO" && (
            <span className="px-4 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">Active</span>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
        <h2 className="font-semibold mb-4">Alert Channels</h2>
        <p className="text-white/40 text-sm">Configure email, Telegram, and SMS alerts in the notification settings.</p>
        <div className="mt-4 space-y-2 text-sm text-white/60">
          <p>✅ Email alerts — via Resend (configured)</p>
          <p>⚙️ Telegram — set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in env</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-white/10 bg-white/5">
        <h2 className="font-semibold mb-4">Account</h2>
        <p className="text-white/60 text-sm">{session?.user?.email}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/stripe.ts app/api/webhooks/ app/api/upgrade/ app/(app)/settings/
git commit -m "feat: stripe billing — free/pro plans, webhook, upgrade flow"
```

---

## Task 11: Vercel Cron + Mission Scheduler

**Files:**
- Create: `neuralos/app/api/cron/route.ts`
- Modify: `neuralos/vercel.json`

- [ ] **Step 1: Create `app/api/cron/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResearchAgent } from "@/lib/agents/research";
import { WriterAgent } from "@/lib/agents/writer";
import { MonitorAgent } from "@/lib/agents/monitor";
import { DailyBriefSkill } from "@/lib/skills/daily-brief";

// Called by Vercel Cron every hour
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const hour = now.getHours();

  // Daily brief at 8am for all Pro users
  if (hour === 8) {
    const proUsers = await db.user.findMany({ where: { plan: "PRO" } });
    for (const user of proUsers) {
      try {
        await new DailyBriefSkill({ userId: user.id, topics: ["AI", "tech", "business"] }).run();
      } catch {}
    }
  }

  // Run enabled monitor missions
  const monitorAgents = await db.agent.findMany({
    where: { type: "MONITOR", status: "IDLE" },
    take: 50,
  });
  for (const agent of monitorAgents) {
    const cfg = agent.config as any;
    if (cfg.url) {
      try {
        await new MonitorAgent({ id: agent.id, userId: agent.userId, url: cfg.url, checkType: cfg.checkType ?? "uptime" }).run();
      } catch {}
    }
  }

  return NextResponse.json({ ok: true, processed: monitorAgents.length });
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 * * * *"
    }
  ]
}
```

Add `CRON_SECRET` to `.env.example`:
```
CRON_SECRET="generate-with-openssl-rand-hex-32"
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/ vercel.json
git commit -m "feat: vercel cron — hourly monitor sweep + 8am daily brief"
```

---

## Task 12: Deploy to Vercel + Smoke Test

- [ ] **Step 1: Push to GitHub**

```bash
cd /Users/sivaprakasam/projects/agents
gh repo create infosiva/neuralos --public --source=neuralos --push
```

- [ ] **Step 2: Deploy to Vercel**

```bash
cd neuralos
npx vercel --yes
```

- [ ] **Step 3: Set all env vars on Vercel**

```bash
# Run from agents/ root — reuse existing script pattern
npx ts-node set-vercel-env.ts neuralos
```

Or manually:
```bash
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add RESEND_API_KEY production
vercel env add GROQ_API_KEY production
vercel env add GEMINI_API_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_PRO_PRICE_ID production
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add CRON_SECRET production
```

- [ ] **Step 4: Run smoke tests**

```bash
# Install playwright if not present
npx playwright install chromium

# Create qa/smoke.spec.ts
```

Create `neuralos/qa/smoke.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

test("homepage loads", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("h1")).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await expect(page.locator("input[type=email]")).toBeVisible();
});

test("api/skills returns 200", async ({ request }) => {
  const res = await request.get(`${BASE}/api/skills`);
  expect(res.status()).toBe(200);
});
```

```bash
BASE_URL=https://neuralos.vercel.app npx playwright test qa/smoke.spec.ts
```

- [ ] **Step 5: Add Stripe webhook endpoint**

In Stripe dashboard: `Webhooks → Add endpoint → https://neuralos.vercel.app/api/webhooks/stripe`
Events: `checkout.session.completed`, `customer.subscription.deleted`

- [ ] **Step 6: Final commit**

```bash
git add qa/
git commit -m "feat: smoke tests + vercel deployment config"
git push
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|-----------------|----------------|
| Command palette (/) | Task 9 |
| Obsidian-compat vault | Task 5 |
| Research/Writer/Monitor agents | Task 6 |
| Context injection from vault | Task 5 (getContext) + Task 6 (all agents) |
| Daily Brief skill | Task 8 |
| Website Builder skill | Task 8 |
| Email Drafter skill | Task 8 |
| Content Calendar skill | Task 8 |
| API Monitor skill | Task 8 |
| Email notifications | Task 7 |
| Telegram notifications | Task 7 |
| Auth (magic link) | Task 3 |
| Stripe billing (Free/Pro) | Task 10 |
| Mission scheduler / cron | Task 11 |
| Deploy to Vercel | Task 12 |
| Smoke QA tests | Task 12 |
| DB schema (all models) | Task 2 |
| AI fallback chain | Task 4 |

**Not in MVP (intentional — post-launch):**
- Plugins (Gmail/GitHub/Telegram connectors)
- Team plan
- Mission Marketplace
- Desktop app (Tauri)
- Voice/SMS alerts
- Vector/semantic search (pgvector)

**Placeholder scan:** No TBDs, all code blocks complete, all types consistent across tasks.

**Type consistency:** `VaultNote`, `BaseAgent`, `AgentRunResult`, `NotificationPayload` — all defined in Task 2/5/6/7 and used consistently in later tasks. ✅

---

## Task 13: Dynamic Skill Registry + Trend Engine + Adaptive Dashboard

**Goal:** Make NeuralOS self-aware — skills are DB-driven (no redeploy to add/remove), a trend agent auto-detects what's hot in AI weekly and promotes relevant skills, and the dashboard reorders itself based on each user's actual usage.

**Files:**
- Modify: `neuralos/prisma/schema.prisma` (add Skill + SkillUsage models)
- Create: `neuralos/lib/skills/registry-db.ts`
- Create: `neuralos/lib/agents/trend.ts`
- Create: `neuralos/lib/dashboard/personalise.ts`
- Modify: `neuralos/app/api/cron/route.ts`
- Modify: `neuralos/app/(app)/dashboard/page.tsx`
- Modify: `neuralos/app/api/skills/route.ts`

---

### Step 1: Extend Prisma schema

Add to `prisma/schema.prisma` after the `AlertRule` model:

```prisma
model Skill {
  id          String       @id @default(cuid())
  slug        String       @unique
  name        String
  description String
  icon        String       @default("⚡")
  category    String       @default("productivity")
  free        Boolean      @default(true)
  enabled     Boolean      @default(true)
  trending    Boolean      @default(false)
  trendScore  Float        @default(0)
  config      Json         @default("{}")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  usages      SkillUsage[]
}

model SkillUsage {
  id        String   @id @default(cuid())
  skillSlug String
  userId    String
  createdAt DateTime @default(now())
  skill     Skill    @relation(fields: [skillSlug], references: [slug], onDelete: Cascade)
  @@index([skillSlug])
  @@index([userId])
}
```

Run:
```bash
npx prisma db push && npx prisma generate
```

---

### Step 2: Seed skills into DB

Create `neuralos/prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const skills = [
  { slug: "daily-brief",        name: "Daily Brief",        icon: "☀️", category: "productivity", free: true,  description: "Personalised morning brief from your vault + trends." },
  { slug: "website-builder",    name: "Website Builder",    icon: "🌐", category: "ai",           free: false, description: "Generate + deploy a full Next.js site from a prompt." },
  { slug: "email-drafter",      name: "Email Drafter",      icon: "✉️", category: "productivity", free: true,  description: "Write emails using your vault contact context." },
  { slug: "content-calendar",   name: "Content Calendar",   icon: "📅", category: "business",     free: false, description: "Plan + schedule social posts. Powered by draftcal." },
  { slug: "api-monitor",        name: "API Monitor",        icon: "📡", category: "business",     free: true,  description: "Watch endpoints, get alerted on downtime." },
  { slug: "chatbot-builder",    name: "Chatbot Builder",    icon: "🤖", category: "ai",           free: false, description: "Build + deploy a custom AI chatbot from your vault." },
  { slug: "resume-builder",     name: "Resume Builder",     icon: "📄", category: "productivity", free: false, description: "AI resume from your vault career data." },
  { slug: "research-agent",     name: "Research Agent",     icon: "🔬", category: "ai",           free: true,  description: "Deep-dive research on any topic, saved to vault." },
  { slug: "invoice-generator",  name: "Invoice Generator",  icon: "🧾", category: "business",     free: false, description: "Generate PDF invoices from vault client data." },
  { slug: "trip-planner",       name: "Trip Planner",       icon: "✈️", category: "lifestyle",    free: false, description: "Full itinerary from your vault preferences." },
  { slug: "portfolio-tracker",  name: "Portfolio Tracker",  icon: "📈", category: "finance",      free: false, description: "Daily stock/crypto summary from your watchlist." },
  { slug: "quiz-generator",     name: "Quiz Generator",     icon: "🎯", category: "learning",     free: true,  description: "Generate quizzes from any vault notes." },
  { slug: "code-reviewer",      name: "Code Reviewer",      icon: "👾", category: "ai",           free: false, description: "Review code using your vault coding standards." },
  { slug: "competitor-monitor", name: "Competitor Monitor", icon: "🕵️", category: "business",     free: false, description: "Track competitor sites, prices, and posts." },
  { slug: "social-poster",      name: "Social Poster",      icon: "📣", category: "business",     free: false, description: "Draft + schedule posts across Twitter/LinkedIn/Instagram." },
];

async function main() {
  for (const skill of skills) {
    await db.skill.upsert({
      where: { slug: skill.slug },
      update: skill,
      create: skill,
    });
  }
  console.log(`Seeded ${skills.length} skills`);
}

main().finally(() => db.$disconnect());
```

Add to `package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Run:
```bash
npx prisma db seed
```

---

### Step 3: Create `lib/skills/registry-db.ts`

```typescript
import { db } from "@/lib/db";

export interface SkillRecord {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  free: boolean;
  enabled: boolean;
  trending: boolean;
  trendScore: number;
  config: any;
  usageCount?: number;
}

export async function getAllSkills(): Promise<SkillRecord[]> {
  const skills = await db.skill.findMany({
    where: { enabled: true },
    orderBy: [{ trending: "desc" }, { trendScore: "desc" }, { name: "asc" }],
  });
  return skills;
}

export async function getTrendingSkills(limit = 6): Promise<SkillRecord[]> {
  return db.skill.findMany({
    where: { enabled: true, trending: true },
    orderBy: { trendScore: "desc" },
    take: limit,
  });
}

export async function getPersonalisedSkills(userId: string, limit = 8): Promise<SkillRecord[]> {
  // Top skills by this user's usage count in last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const usages = await db.skillUsage.groupBy({
    by: ["skillSlug"],
    where: { userId, createdAt: { gte: cutoff } },
    _count: { skillSlug: true },
    orderBy: { _count: { skillSlug: "desc" } },
    take: limit,
  });

  if (usages.length === 0) {
    // New user — return trending + free skills
    return db.skill.findMany({
      where: { enabled: true },
      orderBy: [{ trending: "desc" }, { free: "desc" }],
      take: limit,
    });
  }

  const slugs = usages.map((u) => u.skillSlug);
  const skills = await db.skill.findMany({ where: { slug: { in: slugs }, enabled: true } });
  // Preserve usage-count order
  return slugs
    .map((slug) => skills.find((s) => s.slug === slug))
    .filter(Boolean) as SkillRecord[];
}

export async function recordSkillUsage(userId: string, skillSlug: string): Promise<void> {
  await db.skillUsage.create({ data: { userId, skillSlug } });
}

export async function updateSkillTrend(slug: string, trendScore: number, trending: boolean): Promise<void> {
  await db.skill.update({
    where: { slug },
    data: { trendScore, trending, updatedAt: new Date() },
  });
}
```

---

### Step 4: Create `lib/agents/trend.ts` (Trend Awareness Engine)

```typescript
import { generateText } from "@/lib/ai";
import { updateSkillTrend } from "@/lib/skills/registry-db";
import { upsertNote } from "@/lib/vault";
import { db } from "@/lib/db";

const TREND_SOURCES = [
  "https://hacker-news.firebaseio.com/v0/topstories.json",
];

const AI_KEYWORDS = [
  "agent", "llm", "gpt", "claude", "gemini", "copilot", "automation",
  "workflow", "ai", "vector", "rag", "fine-tune", "mcp", "tool use",
  "voice ai", "image generation", "code generation", "chatbot",
  "resume", "invoice", "monitor", "scheduler", "email",
];

export async function runTrendAgent(adminUserId: string): Promise<{ ok: boolean; report: string }> {
  // Fetch HN top 30 story titles
  let headlines: string[] = [];
  try {
    const ids: number[] = await fetch(TREND_SOURCES[0]).then((r) => r.json());
    const top30 = ids.slice(0, 30);
    const stories = await Promise.all(
      top30.map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then((r) => r.json())
          .then((s) => s?.title ?? "")
          .catch(() => "")
      )
    );
    headlines = stories.filter(Boolean);
  } catch {}

  // Ask AI to analyse trends and map to our skill slugs
  const allSkills = await db.skill.findMany({ select: { slug: true, name: true } });
  const skillList = allSkills.map((s) => `${s.slug}: ${s.name}`).join("\n");

  const analysis = await generateText({
    messages: [
      {
        role: "system",
        content: `You are a product trend analyst. Given news headlines and a skill library, identify which skills are trending and score them 0-100. Output ONLY valid JSON array: [{"slug":"skill-slug","score":85,"reason":"one sentence"}]. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Headlines this week:\n${headlines.join("\n")}\n\nSkill library:\n${skillList}\n\nWhich skills are trending based on these headlines? Score each 0-100.`,
      },
    ],
    maxTokens: 800,
  });

  let trendData: Array<{ slug: string; score: number; reason: string }> = [];
  try {
    trendData = JSON.parse(analysis);
  } catch {
    // AI returned malformed JSON — skip update
    return { ok: false, report: "trend analysis parse failed" };
  }

  // Reset all trending flags
  await db.skill.updateMany({ data: { trending: false, trendScore: 0 } });

  // Apply new scores
  for (const item of trendData) {
    if (item.score >= 50) {
      await updateSkillTrend(item.slug, item.score, item.score >= 70);
    }
  }

  // Build report and save to vault
  const report = [
    `# Trend Report — ${new Date().toLocaleDateString()}`,
    "",
    "## Trending Skills This Week",
    ...trendData
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((t) => `- **${t.slug}** (score: ${t.score}) — ${t.reason}`),
    "",
    "## Headlines Analysed",
    ...headlines.slice(0, 10).map((h) => `- ${h}`),
  ].join("\n");

  if (adminUserId) {
    await upsertNote(
      adminUserId,
      `trend-report-${Date.now()}`,
      `---\ntitle: Trend Report\ntags: [trends, agent, weekly]\n---\n\n${report}`
    );
  }

  return { ok: true, report };
}
```

---

### Step 5: Create `lib/dashboard/personalise.ts`

```typescript
import { db } from "@/lib/db";
import { getPersonalisedSkills, getTrendingSkills, SkillRecord } from "@/lib/skills/registry-db";

export interface DashboardData {
  mySkills: SkillRecord[];       // User's most-used
  trendingSkills: SkillRecord[]; // Platform trending
  recentLogs: any[];
  stats: { notes: number; agents: number; missions: number; skillRuns: number };
  weeklyTrendReport: string | null;
}

export async function getPersonalisedDashboard(userId: string): Promise<DashboardData> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [mySkills, trendingSkills, noteCount, agentCount, missionCount, skillRunCount, recentLogs, trendNote] =
    await Promise.all([
      getPersonalisedSkills(userId, 6),
      getTrendingSkills(4),
      db.vaultNote.count({ where: { userId } }),
      db.agent.count({ where: { userId } }),
      db.mission.count({ where: { userId } }),
      db.skillUsage.count({ where: { userId, createdAt: { gte: cutoff } } }),
      db.agentLog.findMany({
        where: { agent: { userId } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { agent: { select: { name: true } } },
      }),
      db.vaultNote.findFirst({
        where: { userId, tags: { has: "trends" } },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      }),
    ]);

  return {
    mySkills,
    trendingSkills,
    recentLogs,
    stats: { notes: noteCount, agents: agentCount, missions: missionCount, skillRuns: skillRunCount },
    weeklyTrendReport: trendNote?.content ?? null,
  };
}
```

---

### Step 6: Update `app/api/skills/route.ts` — serve from DB + record usage

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllSkills, recordSkillUsage } from "@/lib/skills/registry-db";

export async function GET() {
  const skills = await getAllSkills();
  return NextResponse.json({ skills });
}

export async function POST(req: NextRequest) {
  // Record skill usage when a skill is run
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const { slug } = await req.json();
  await recordSkillUsage(userId, slug);
  return NextResponse.json({ ok: true });
}
```

Update `app/api/skills/[slug]/run/route.ts` — add usage tracking after successful run:

```typescript
// Add after `const result = await new SkillClass({ userId, ...config }).run();`
if (result.ok) {
  await recordSkillUsage(userId, params.slug);
}
```

---

### Step 7: Update cron to run weekly trend agent

Modify `app/api/cron/route.ts` — add inside the GET handler:

```typescript
// Weekly trend analysis — runs every Monday at 9am
const isMonday = now.getDay() === 1;
if (isMonday && hour === 9) {
  const adminUser = await db.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (adminUser) {
    try {
      const { runTrendAgent } = await import("@/lib/agents/trend");
      await runTrendAgent(adminUser.id);
    } catch {}
  }
}
```

---

### Step 8: Update dashboard page to use personalised data

Replace `app/(app)/dashboard/page.tsx` with:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPersonalisedDashboard } from "@/lib/dashboard/personalise";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id;
  const data = await getPersonalisedDashboard(userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">
          Welcome back, {session!.user?.name ?? session!.user?.email}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Vault Notes",  value: data.stats.notes,      icon: "🧠", href: "/vault" },
          { label: "Agents",       value: data.stats.agents,     icon: "🤖", href: "/agents" },
          { label: "Missions",     value: data.stats.missions,   icon: "🎯", href: "/missions" },
          { label: "Skills Run",   value: data.stats.skillRuns,  icon: "⚡", href: "/skills" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-3xl font-bold">{stat.value}</div>
            <div className="text-white/50 text-xs">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Trending skills */}
      {data.trendingSkills.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            🔥 Trending This Week
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {data.trendingSkills.map((skill) => (
              <Link key={skill.slug} href={`/skills/${skill.slug}`}
                className="flex items-center gap-3 p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition text-sm">
                <span className="text-xl">{skill.icon}</span>
                <div>
                  <p className="text-white font-medium">{skill.name}</p>
                  <p className="text-white/40 text-xs">{skill.description.slice(0, 50)}...</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                  🔥 Hot
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Personalised skills */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Your Skills</h2>
        <div className="grid grid-cols-3 gap-3">
          {data.mySkills.map((skill) => (
            <Link key={skill.slug} href={`/skills/${skill.slug}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm">
              <span className="text-xl">{skill.icon}</span>
              <div>
                <p className="text-white font-medium">{skill.name}</p>
                <p className="text-white/40 text-xs">{skill.free ? "Free" : "Pro"}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent agent activity */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <div className="space-y-2">
          {data.recentLogs.length === 0 && (
            <p className="text-white/30 text-sm">No activity yet. Run a skill to get started.</p>
          )}
          {data.recentLogs.map((log: any) => (
            <div key={log.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                log.level === "error"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-green-500/20 text-green-400"
              }`}>
                {log.level}
              </span>
              <div>
                <p className="text-sm text-white/80">{log.agent.name}</p>
                <p className="text-xs text-white/40">{log.message}</p>
              </div>
              <span className="ml-auto text-xs text-white/20">
                {new Date(log.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly trend report */}
      {data.weeklyTrendReport && (
        <div>
          <h2 className="text-lg font-semibold mb-3">📊 Weekly AI Trends</h2>
          <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
            {data.weeklyTrendReport.slice(0, 600)}...
          </div>
          <Link href="/vault" className="text-xs text-white/30 hover:text-white/60 mt-1 inline-block">
            Full report in vault →
          </Link>
        </div>
      )}
    </div>
  );
}
```

---

### Step 9: Commit

```bash
git add prisma/schema.prisma prisma/seed.ts lib/skills/registry-db.ts \
  lib/agents/trend.ts lib/dashboard/personalise.ts \
  app/api/skills/ app/api/cron/ app/(app)/dashboard/
git commit -m "feat: dynamic skill registry + trend engine + personalised dashboard"
```

---

**Spec coverage additions (Task 13):**

| Requirement | Covered |
|-------------|---------|
| DB-driven skills (no redeploy to add/remove) | ✅ Skill model + seed |
| Trend awareness (HN headlines → AI scoring) | ✅ TrendAgent |
| Trending badge on dashboard | ✅ 🔥 Hot badge |
| Usage-based personalisation | ✅ SkillUsage + getPersonalisedSkills |
| Weekly trend report in vault | ✅ Saved as vault note |
| Admin can update skill config via DB | ✅ Skill.config Json field |
