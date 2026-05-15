# Multi-Source Design Pipeline + Auto QA Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a Playwright smoke-test gate into three pilot projects (kwizzo, agenttrace, ai-resume-builder) that fires on every push to `main`, sends a Telegram alert on failure, and install project-specific design library components (Magic UI on kwizzo, Tremor on agenttrace, Claude /design-html workflow on ai-resume-builder).

**Architecture:** Each project gets three new files — `qa/smoke.spec.ts`, `qa/playwright.config.ts`, and `.github/workflows/qa.yml` — that are parameterised entirely through the `BASE_URL` environment variable so the template is identical across projects. Design library components are added as a separate layer on top of the existing liquid-glass `globals.css`; no existing component is deleted. Tremor and Magic UI ship as npm packages or copy-paste components; ai-resume-builder uses the interactive `/design-html` Claude skill documented step-by-step.

**Tech Stack:** Playwright 1.44, @playwright/test, @tremor/react, Magic UI (copy-paste), Next.js 15/16 App Router, GitHub Actions, Telegram Bot API

---

## File Map

| File | Project(s) | Action | Responsibility |
|------|-----------|--------|---------------|
| `qa/smoke.spec.ts` | kwizzo, agenttrace/apps/dashboard, ai-resume-builder | Create | Playwright smoke tests — nav, hero, CTA, AI endpoint, mobile |
| `qa/playwright.config.ts` | kwizzo, agenttrace/apps/dashboard, ai-resume-builder | Create | Playwright config, reads BASE_URL from env |
| `.github/workflows/qa.yml` | kwizzo, agenttrace, ai-resume-builder | Create | GitHub Actions post-deploy step |
| `package.json` | kwizzo, agenttrace/apps/dashboard, ai-resume-builder | Modify | Add @playwright/test devDep + test:smoke script |
| `components/magicui/shimmer-button.tsx` | kwizzo | Create | Magic UI shimmer button component |
| `components/magicui/animated-list.tsx` | kwizzo | Create | Magic UI animated list component |
| `components/magicui/number-ticker.tsx` | kwizzo | Create | Magic UI animated number counter |
| `app/page.tsx` | kwizzo | Modify | Replace static stats section with NumberTicker + add ShimmerButton CTA |
| `apps/dashboard/src/components/tremor/` | agenttrace | Create | Tremor chart wrappers (AreaChart, MetricCard, TracesTable) |
| `apps/dashboard/src/app/dashboard/page.tsx` | agenttrace | Modify | Add Tremor AreaChart + MetricCard row to existing dashboard |
| `docs/design-html-workflow.md` | ai-resume-builder | Create | Step-by-step /design-html workflow documentation |

---

## Task 1: Install Playwright in kwizzo

**Files:**
- Modify: `kwizzo/package.json`
- Create: `kwizzo/qa/playwright.config.ts`

- [ ] **Step 1: Add @playwright/test devDependency**

In `/Users/sivaprakasam/projects/agents/kwizzo/`, run:

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm install --save-dev @playwright/test@1.44.1
```

Expected output: `added 1 package` (or similar — @playwright/test appears in devDependencies).

- [ ] **Step 2: Add test:smoke script to package.json**

Open `/Users/sivaprakasam/projects/agents/kwizzo/package.json`. The `scripts` section currently reads:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
},
```

Change it to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test:smoke": "playwright test --config=qa/playwright.config.ts"
},
```

- [ ] **Step 3: Create qa/playwright.config.ts**

Create `/Users/sivaprakasam/projects/agents/kwizzo/qa/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './qa',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

- [ ] **Step 4: Install Playwright browser binaries**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npx playwright install chromium
```

Expected: `Playwright build of chromium ...` download completes with exit code 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && git add package.json package-lock.json qa/playwright.config.ts && git commit -m "chore: add Playwright + qa/playwright.config.ts"
```

---

## Task 2: Write smoke spec for kwizzo

**Files:**
- Create: `kwizzo/qa/smoke.spec.ts`

kwizzo routes that must return 200: `/` (home), `/quiz` (quiz lobby), `/play` (game room). The AI endpoint is `POST /api/quiz`. The hero H1 contains "Kwizzo". The primary CTA is the "Start Playing" or "Play Now" link.

- [ ] **Step 1: Create qa/smoke.spec.ts**

Create `/Users/sivaprakasam/projects/agents/kwizzo/qa/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// ── Nav routes return 200 ─────────────────────────────────
const NAV_ROUTES = ['/', '/quiz', '/play'];

for (const route of NAV_ROUTES) {
  test(`GET ${route} returns 200`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status()).toBe(200);
  });
}

// ── Hero H1 present ───────────────────────────────────────
test('home hero H1 is visible', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: 10_000 });
  const text = await h1.innerText();
  expect(text.length).toBeGreaterThan(0);
});

// ── Primary CTA visible ───────────────────────────────────
test('primary CTA button is visible', async ({ page }) => {
  await page.goto('/');
  // Matches any link/button containing "Play", "Start", or "Try"
  const cta = page.locator('a, button').filter({ hasText: /play|start|try/i }).first();
  await expect(cta).toBeVisible({ timeout: 10_000 });
});

// ── AI endpoint responds non-empty within 10s ─────────────
test('POST /api/quiz returns non-empty JSON', async ({ request }) => {
  const res = await request.post('/api/quiz', {
    data: {
      subject: 'general',
      difficulty: 'easy',
      playerCount: 1,
      ageGroups: ['adults'],
    },
    timeout: 10_000,
  });
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.length).toBeGreaterThan(10);
});

// ── Mobile: no horizontal overflow ───────────────────────
test('mobile viewport has no horizontal overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
  await ctx.close();
});
```

- [ ] **Step 2: Run the spec locally against dev server**

In one terminal start the dev server:
```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run dev &
```

Wait ~5s then run:
```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && BASE_URL=http://localhost:3000 npm run test:smoke
```

Expected: all 7 tests pass (5 nav + hero + CTA + AI + mobile). The AI endpoint test may be slow on first run — that is normal.

- [ ] **Step 3: Kill dev server, commit**

```bash
kill %1 2>/dev/null; cd /Users/sivaprakasam/projects/agents/kwizzo && git add qa/smoke.spec.ts && git commit -m "test: add Playwright smoke spec for kwizzo"
```

---

## Task 3: GitHub Actions QA workflow for kwizzo

**Files:**
- Create: `kwizzo/.github/workflows/qa.yml`

This workflow runs after Vercel deploys. It uses the `vercel/deploy-github-action` pattern of waiting for the deployment URL from the environment. Since kwizzo is auto-deployed on push to `main`, we use the `vercel` environment's URL via the `VERCEL_URL` secret. The Telegram alert uses a `curl` POST to the Bot API.

- [ ] **Step 1: Create .github/workflows/qa.yml**

Create `/Users/sivaprakasam/projects/agents/kwizzo/.github/workflows/qa.yml`:

```yaml
name: Post-Deploy QA Smoke Test

on:
  push:
    branches: [main]

jobs:
  smoke:
    name: Playwright Smoke Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Wait for Vercel deployment (60s)
        run: sleep 60

      - name: Run smoke tests
        env:
          BASE_URL: ${{ secrets.VERCEL_PRODUCTION_URL }}
        run: npm run test:smoke

      - name: Telegram alert on failure
        if: failure()
        env:
          BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          MESSAGE="🚨 kwizzo QA FAILED%0ACommit: ${{ github.sha }}%0ABranch: ${{ github.ref_name }}%0AURL: ${{ secrets.VERCEL_PRODUCTION_URL }}%0ADetails: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
            -d "chat_id=${CHAT_ID}" \
            -d "text=${MESSAGE}"
```

- [ ] **Step 2: Add GitHub Actions secrets**

In the kwizzo GitHub repository settings (github.com/infosiva/kwizzo → Settings → Secrets and variables → Actions), add three repository secrets:

| Secret name | Value |
|-------------|-------|
| `VERCEL_PRODUCTION_URL` | `https://kwizzo.app` |
| `TELEGRAM_BOT_TOKEN` | Value from `/root/site-watchdog/.env` key `TELEGRAM_BOT_TOKEN` |
| `TELEGRAM_CHAT_ID` | Value from `/root/site-watchdog/.env` key `TELEGRAM_CHAT_ID` |

To read the values from VPS:
```bash
ssh root@31.97.56.148 "grep -E 'TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID' /root/site-watchdog/.env"
```

- [ ] **Step 3: Commit and push**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && mkdir -p .github/workflows && git add .github/workflows/qa.yml && git commit -m "ci: add post-deploy QA GitHub Actions workflow"
git push origin main
```

Expected: GitHub Actions shows a new run "Post-Deploy QA Smoke Test" in the Actions tab. It will run and pass (or send Telegram on failure).

---

## Task 4: Install Playwright + smoke spec in agenttrace

agenttrace is a monorepo (pnpm workspaces + Turborepo). The QA spec lives in `apps/dashboard/` because that is the deployed Next.js app. The GitHub Actions workflow lives at the repo root.

**Files:**
- Modify: `agenttrace/apps/dashboard/package.json`
- Create: `agenttrace/apps/dashboard/qa/playwright.config.ts`
- Create: `agenttrace/apps/dashboard/qa/smoke.spec.ts`
- Create: `agenttrace/.github/workflows/qa.yml`

- [ ] **Step 1: Add @playwright/test to dashboard devDeps**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm add -D @playwright/test@1.44.1
```

Expected: `@playwright/test 1.44.1` appears in `apps/dashboard/package.json` devDependencies.

- [ ] **Step 2: Add test:smoke script to apps/dashboard/package.json**

Open `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/package.json`. Current `scripts`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "clean": "rm -rf .next .turbo node_modules"
},
```

Change to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "clean": "rm -rf .next .turbo node_modules",
  "test:smoke": "playwright test --config=qa/playwright.config.ts"
},
```

- [ ] **Step 3: Create apps/dashboard/qa/playwright.config.ts**

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/qa/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './qa',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

- [ ] **Step 4: Create apps/dashboard/qa/smoke.spec.ts**

agenttrace routes: `/` (login redirect), `/dashboard`, `/traces`, `/pricing`, `/docs`, `/integrations`. The AI endpoint does not exist on the dashboard (it is an observability tool), so the AI-endpoint test is replaced with a traces API health check at `GET /api/traces` (or `/api/health` if present). The hero H1 on the dashboard page contains "Agent" or "Trace". Primary CTA: "Get Started" or "Start Free".

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/qa/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// ── Nav routes return 200 (not 500) ──────────────────────
// Note: / and /dashboard may redirect to /login (302→200 after redirect).
// We follow redirects (default) and check final status is 200.
const NAV_ROUTES = ['/', '/pricing', '/docs', '/integrations'];

for (const route of NAV_ROUTES) {
  test(`GET ${route} returns 200`, async ({ request }) => {
    const res = await request.get(route, { maxRedirects: 5 });
    expect(res.status()).toBe(200);
  });
}

// ── Hero H1 present on landing ────────────────────────────
test('landing page H1 is visible', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: 10_000 });
  const text = await h1.innerText();
  expect(text.length).toBeGreaterThan(0);
});

// ── Primary CTA visible ───────────────────────────────────
test('primary CTA is visible on landing', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('a, button').filter({ hasText: /get started|start free|sign up|try free/i }).first();
  await expect(cta).toBeVisible({ timeout: 10_000 });
});

// ── Stripe checkout endpoint responds ────────────────────
// We POST to /api/stripe/checkout but expect a JSON error (no auth), not a 500.
test('POST /api/stripe/checkout returns non-500', async ({ request }) => {
  const res = await request.post('/api/stripe/checkout', {
    data: {},
    timeout: 10_000,
  });
  // Acceptable: 200, 400, 401, 403, 422 — not 500/502/503
  expect(res.status()).toBeLessThan(500);
});

// ── Mobile: no horizontal overflow ───────────────────────
test('mobile viewport has no horizontal overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
  await ctx.close();
});
```

- [ ] **Step 5: Install Playwright browsers**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && npx playwright install chromium
```

- [ ] **Step 6: Create .github/workflows/qa.yml at repo root**

Create `/Users/sivaprakasam/projects/agents/agenttrace/.github/workflows/qa.yml`:

```yaml
name: Post-Deploy QA Smoke Test

on:
  push:
    branches: [main]

jobs:
  smoke:
    name: Playwright Smoke Tests — dashboard
    runs-on: ubuntu-latest
    timeout-minutes: 10
    defaults:
      run:
        working-directory: apps/dashboard

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies (workspace root)
        working-directory: .
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Wait for Vercel deployment (60s)
        run: sleep 60

      - name: Run smoke tests
        env:
          BASE_URL: ${{ secrets.VERCEL_PRODUCTION_URL }}
        run: pnpm run test:smoke

      - name: Telegram alert on failure
        if: failure()
        env:
          BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          MESSAGE="🚨 agenttrace QA FAILED%0ACommit: ${{ github.sha }}%0ABranch: ${{ github.ref_name }}%0AURL: ${{ secrets.VERCEL_PRODUCTION_URL }}%0ADetails: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
            -d "chat_id=${CHAT_ID}" \
            -d "text=${MESSAGE}"
```

- [ ] **Step 7: Add GitHub Actions secrets**

In github.com/infosiva/agenttrace → Settings → Secrets and variables → Actions:

| Secret name | Value |
|-------------|-------|
| `VERCEL_PRODUCTION_URL` | `https://agentlogs.app` |
| `TELEGRAM_BOT_TOKEN` | Value from VPS `.env` (same as kwizzo) |
| `TELEGRAM_CHAT_ID` | Value from VPS `.env` (same as kwizzo) |

- [ ] **Step 8: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace && git add apps/dashboard/package.json apps/dashboard/qa/ .github/workflows/qa.yml && git commit -m "ci: add Playwright smoke tests + post-deploy QA workflow"
git push origin main
```

---

## Task 5: Install Playwright + smoke spec in ai-resume-builder

**Files:**
- Modify: `ai-resume-builder/package.json`
- Create: `ai-resume-builder/qa/playwright.config.ts`
- Create: `ai-resume-builder/qa/smoke.spec.ts`
- Create: `ai-resume-builder/.github/workflows/qa.yml`

- [ ] **Step 1: Add @playwright/test devDep + script**

```bash
cd /Users/sivaprakasam/projects/agents/ai-resume-builder && npm install --save-dev @playwright/test@1.44.1
```

Then edit `/Users/sivaprakasam/projects/agents/ai-resume-builder/package.json` scripts section. Currently:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
},
```

Change to:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test:smoke": "playwright test --config=qa/playwright.config.ts"
},
```

- [ ] **Step 2: Create qa/playwright.config.ts**

Create `/Users/sivaprakasam/projects/agents/ai-resume-builder/qa/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './qa',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
```

- [ ] **Step 3: Create qa/smoke.spec.ts**

ai-resume-builder routes: `/` (home/builder). The AI endpoint is `POST /api/generate` which accepts `{ jobDesc, experience, skills, name, currentTitle, mode }`. The hero H1 likely contains "Resume" or "AI". Primary CTA: "Build", "Generate", "Get Started".

Create `/Users/sivaprakasam/projects/agents/ai-resume-builder/qa/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

// ── Nav route returns 200 ─────────────────────────────────
test('GET / returns 200', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
});

// ── Hero H1 present ───────────────────────────────────────
test('home hero H1 is visible', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: 10_000 });
  const text = await h1.innerText();
  expect(text.length).toBeGreaterThan(0);
});

// ── Primary CTA visible ───────────────────────────────────
test('primary CTA is visible', async ({ page }) => {
  await page.goto('/');
  const cta = page.locator('a, button').filter({ hasText: /build|generate|get started|create|start/i }).first();
  await expect(cta).toBeVisible({ timeout: 10_000 });
});

// ── AI generate endpoint responds non-empty ───────────────
test('POST /api/generate returns non-empty JSON', async ({ request }) => {
  const res = await request.post('/api/generate', {
    data: {
      mode: 'analyze',
      jobDesc: 'Software Engineer at Acme Corp. Skills: React, Node.js.',
      experience: '3 years React developer.',
      skills: 'React, TypeScript, Node.js',
      name: 'Jane Doe',
      currentTitle: 'Frontend Developer',
    },
    timeout: 10_000,
  });
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body.length).toBeGreaterThan(10);
});

// ── Mobile: no horizontal overflow ───────────────────────
test('mobile viewport has no horizontal overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
  await ctx.close();
});
```

- [ ] **Step 4: Install Playwright browsers**

```bash
cd /Users/sivaprakasam/projects/agents/ai-resume-builder && npx playwright install chromium
```

- [ ] **Step 5: Create .github/workflows/qa.yml**

Create `/Users/sivaprakasam/projects/agents/ai-resume-builder/.github/workflows/qa.yml`:

```yaml
name: Post-Deploy QA Smoke Test

on:
  push:
    branches: [main]

jobs:
  smoke:
    name: Playwright Smoke Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Wait for Vercel deployment (60s)
        run: sleep 60

      - name: Run smoke tests
        env:
          BASE_URL: ${{ secrets.VERCEL_PRODUCTION_URL }}
        run: npm run test:smoke

      - name: Telegram alert on failure
        if: failure()
        env:
          BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          MESSAGE="🚨 ai-resume-builder QA FAILED%0ACommit: ${{ github.sha }}%0ABranch: ${{ github.ref_name }}%0AURL: ${{ secrets.VERCEL_PRODUCTION_URL }}%0ADetails: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
            -d "chat_id=${CHAT_ID}" \
            -d "text=${MESSAGE}"
```

- [ ] **Step 6: Add GitHub Actions secrets**

In github.com/infosiva/ai-resume-builder → Settings → Secrets and variables → Actions:

| Secret name | Value |
|-------------|-------|
| `VERCEL_PRODUCTION_URL` | `https://resumevault.app` |
| `TELEGRAM_BOT_TOKEN` | Same value as other projects |
| `TELEGRAM_CHAT_ID` | Same value as other projects |

- [ ] **Step 7: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/ai-resume-builder && git add package.json package-lock.json qa/ .github/workflows/qa.yml && git commit -m "ci: add Playwright smoke tests + post-deploy QA workflow"
git push origin main
```

---

## Task 6: Magic UI components in kwizzo — ShimmerButton

Magic UI has no npm package — components are copy-pasted from magicui.design and adapt to the project's Tailwind + globals.css.

**Files:**
- Create: `kwizzo/components/magicui/shimmer-button.tsx`

- [ ] **Step 1: Create components/magicui/shimmer-button.tsx**

Create `/Users/sivaprakasam/projects/agents/kwizzo/components/magicui/shimmer-button.tsx`:

```typescript
'use client';

import React, { CSSProperties } from 'react';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  children: React.ReactNode;
}

export function ShimmerButton({
  shimmerColor = '#ffffff',
  shimmerSize = '0.05em',
  shimmerDuration = '3s',
  borderRadius = '100px',
  background = 'rgba(0, 0, 0, 1)',
  children,
  className = '',
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={
        {
          '--spread': '90deg',
          '--shimmer-color': shimmerColor,
          '--radius': borderRadius,
          '--speed': shimmerDuration,
          '--cut': shimmerSize,
          '--bg': background,
        } as CSSProperties
      }
      className={[
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap border border-white/10',
        'px-6 py-3 text-white',
        '[background:var(--bg)] [border-radius:var(--radius)]',
        'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
        className,
      ].join(' ')}
      {...props}
    >
      {/* shimmer layer */}
      <div
        className={[
          'absolute inset-0 overflow-visible [container-type:size]',
        ].join(' ')}
      >
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] opacity-100" />
        </div>
      </div>
      {/* inner mask */}
      <div
        className="absolute [background:var(--bg)] [border-radius:var(--radius)] [inset:var(--cut)]"
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
}
```

- [ ] **Step 2: Add shimmer keyframe to kwizzo globals.css**

Open `/Users/sivaprakasam/projects/agents/kwizzo/app/globals.css`. Append at the end of the file:

```css
/* Magic UI — shimmer animation */
@keyframes shimmer-slide {
  to {
    transform: translate(calc(100cqw - 100%), 0);
  }
}

.animate-shimmer-slide {
  animation: shimmer-slide var(--speed, 3s) ease-in-out infinite alternate;
}
```

- [ ] **Step 3: Verify component renders**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run build 2>&1 | tail -20
```

Expected: build completes with exit code 0. No TypeScript errors in the output.

- [ ] **Step 4: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && git add components/magicui/shimmer-button.tsx app/globals.css && git commit -m "feat: add Magic UI ShimmerButton component"
```

---

## Task 7: Magic UI components in kwizzo — NumberTicker

**Files:**
- Create: `kwizzo/components/magicui/number-ticker.tsx`

- [ ] **Step 1: Create components/magicui/number-ticker.tsx**

Create `/Users/sivaprakasam/projects/agents/kwizzo/components/magicui/number-ticker.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';

interface NumberTickerProps {
  value: number;
  direction?: 'up' | 'down';
  delay?: number; // seconds before starting
  decimalPlaces?: number;
  suffix?: string;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function NumberTicker({
  value,
  direction = 'up',
  delay = 0,
  decimalPlaces = 0,
  suffix = '',
  className = '',
}: NumberTickerProps) {
  const [display, setDisplay] = useState(direction === 'down' ? value : 0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const DURATION = 2000; // ms

  useEffect(() => {
    const startValue = direction === 'down' ? value : 0;
    const endValue = direction === 'down' ? 0 : value;

    const timeoutId = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startRef.current === null) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const progress = Math.min(elapsed / DURATION, 1);
        const eased = easeOutCubic(progress);
        setDisplay(startValue + (endValue - startValue) * eased);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [value, direction, delay]);

  return (
    <span className={className}>
      {display.toFixed(decimalPlaces)}
      {suffix}
    </span>
  );
}
```

- [ ] **Step 2: Verify build still passes**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run build 2>&1 | tail -10
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && git add components/magicui/number-ticker.tsx && git commit -m "feat: add Magic UI NumberTicker component"
```

---

## Task 8: Magic UI components in kwizzo — AnimatedList

**Files:**
- Create: `kwizzo/components/magicui/animated-list.tsx`

- [ ] **Step 1: Create components/magicui/animated-list.tsx**

Create `/Users/sivaprakasam/projects/agents/kwizzo/components/magicui/animated-list.tsx`:

```typescript
'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface AnimatedListProps {
  className?: string;
  children: React.ReactNode;
  delay?: number; // ms between each item appearing
}

export function AnimatedList({ className = '', children, delay = 1000 }: AnimatedListProps) {
  const [index, setIndex] = useState(0);
  const childrenArray = useMemo(() => React.Children.toArray(children), [children]);

  useEffect(() => {
    if (index < childrenArray.length - 1) {
      const id = setTimeout(() => setIndex((i) => i + 1), delay);
      return () => clearTimeout(id);
    }
  }, [index, childrenArray.length, delay]);

  const visibleItems = childrenArray.slice(0, index + 1).reverse();

  return (
    <div className={['flex flex-col-reverse items-center gap-2', className].join(' ')}>
      {visibleItems.map((item, i) => (
        <AnimatedListItem key={(item as React.ReactElement).key ?? i}>
          {item}
        </AnimatedListItem>
      ))}
    </div>
  );
}

function AnimatedListItem({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full animate-in slide-in-from-top-4 fade-in duration-300"
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Ensure tailwindcss-animate is available**

kwizzo uses Tailwind v4 which does not bundle `tailwindcss-animate` by default. The `animate-in slide-in-from-top-4 fade-in` classes need it.

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm install tailwindcss-animate
```

Then open `/Users/sivaprakasam/projects/agents/kwizzo/app/globals.css` and add at the top (after any existing `@import` lines):

```css
@plugin "tailwindcss-animate";
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run build 2>&1 | tail -10
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && git add components/magicui/animated-list.tsx app/globals.css package.json package-lock.json && git commit -m "feat: add Magic UI AnimatedList component"
```

---

## Task 9: Wire Magic UI components into kwizzo homepage

Replace the static STATS array counters with `NumberTicker` and swap the main hero CTA anchor tag with `ShimmerButton`. The `AnimatedList` is wired into the leaderboard section.

**Files:**
- Modify: `kwizzo/app/page.tsx`

- [ ] **Step 1: Read the current stats section of page.tsx**

Read lines 1-20 of `/Users/sivaprakasam/projects/agents/kwizzo/app/page.tsx` to confirm the import block, then search for the STATS render location:

```bash
grep -n "STATS\|target\|suffix" /Users/sivaprakasam/projects/agents/kwizzo/app/page.tsx | head -20
```

- [ ] **Step 2: Add Magic UI imports to page.tsx**

At the top of `/Users/sivaprakasam/projects/agents/kwizzo/app/page.tsx`, after the existing import block (after the last `import` line), add:

```typescript
import { ShimmerButton } from '@/components/magicui/shimmer-button'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { AnimatedList } from '@/components/magicui/animated-list'
```

- [ ] **Step 3: Replace stats render with NumberTicker**

Find the JSX that renders STATS. It will look roughly like:

```tsx
{STATS.map((s, i) => (
  <div key={i}>
    <div>{s.target}{s.suffix}</div>
    <div>{s.l}</div>
  </div>
))}
```

Replace the inner counter span (the `{s.target}{s.suffix}` part) with:

```tsx
{STATS.map((s, i) => (
  <div key={i}>
    <div>
      <NumberTicker value={s.target} suffix={s.suffix} className="font-bold text-3xl text-white" />
    </div>
    <div>{s.l}</div>
  </div>
))}
```

- [ ] **Step 4: Replace primary CTA anchor with ShimmerButton**

Find the main hero CTA — it is an `<Link>` or `<a>` tag pointing to `/quiz` or `/play` with text like "Start Playing" or "Play Free". Wrap it so the button uses ShimmerButton:

```tsx
// Before (approximate — match exact text from file):
<Link href="/quiz" className="...">Start Playing Free →</Link>

// After:
<Link href="/quiz">
  <ShimmerButton
    background="rgba(124, 58, 237, 1)"
    shimmerColor="#e9d5ff"
    className="px-8 py-4 text-lg font-semibold"
  >
    Start Playing Free →
  </ShimmerButton>
</Link>
```

- [ ] **Step 5: Wire AnimatedList into leaderboard section**

Find the LEADERBOARD render block. It will render `LEADERBOARD.map(...)` items. Wrap the list with `AnimatedList`:

```tsx
// Before:
<div className="...">
  {LEADERBOARD.map((p, i) => (
    <div key={i}>...</div>
  ))}
</div>

// After:
<AnimatedList delay={800} className="w-full max-w-sm mx-auto">
  {LEADERBOARD.map((p, i) => (
    <div key={i} className="...">...</div>
  ))}
</AnimatedList>
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run build 2>&1 | tail -15
```

Expected: exit code 0, no TypeScript errors. The page.tsx changes should compile cleanly.

- [ ] **Step 7: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/kwizzo && git add app/page.tsx && git commit -m "feat: wire Magic UI NumberTicker, ShimmerButton, AnimatedList into homepage"
git push origin main
```

---

## Task 10: Install Tremor in agenttrace dashboard

**Files:**
- Modify: `agenttrace/apps/dashboard/package.json`

agenttrace dashboard already uses Tailwind v3 (`tailwindcss: ^3.4.17`), recharts, and @tanstack/react-table — Tremor v3 is fully compatible.

- [ ] **Step 1: Install @tremor/react**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm add @tremor/react
```

Expected: `@tremor/react` appears in dependencies in `apps/dashboard/package.json`.

- [ ] **Step 2: Add Tremor content path to tailwind.config.ts**

Open `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/tailwind.config.ts`. Find the `content` array. Add the Tremor path so its classes are not purged:

```typescript
// Before (approximate):
content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
],

// After:
content: [
  './src/**/*.{js,ts,jsx,tsx,mdx}',
  './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
],
```

- [ ] **Step 3: Build to confirm no conflicts**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm run build 2>&1 | tail -15
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace && git add apps/dashboard/package.json apps/dashboard/tailwind.config.ts && git commit -m "feat: install @tremor/react in dashboard"
```

---

## Task 11: Tremor component wrappers for agenttrace

Create thin wrapper components that combine Tremor primitives with the project's existing design tokens.

**Files:**
- Create: `agenttrace/apps/dashboard/src/components/tremor/MetricCard.tsx`
- Create: `agenttrace/apps/dashboard/src/components/tremor/TracesAreaChart.tsx`
- Create: `agenttrace/apps/dashboard/src/components/tremor/TracesTable.tsx`
- Create: `agenttrace/apps/dashboard/src/components/tremor/index.ts`

- [ ] **Step 1: Create MetricCard.tsx**

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/components/tremor/MetricCard.tsx`:

```typescript
import { Card, Metric, Text, BadgeDelta } from '@tremor/react';

export type DeltaType = 'increase' | 'decrease' | 'unchanged' | 'moderateIncrease' | 'moderateDecrease';

interface MetricCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaType?: DeltaType;
}

export function MetricCard({ title, value, delta, deltaType = 'unchanged' }: MetricCardProps) {
  return (
    <Card className="max-w-xs">
      <Text>{title}</Text>
      <Metric>{value}</Metric>
      {delta && <BadgeDelta deltaType={deltaType}>{delta}</BadgeDelta>}
    </Card>
  );
}
```

- [ ] **Step 2: Create TracesAreaChart.tsx**

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/components/tremor/TracesAreaChart.tsx`:

```typescript
'use client';

import { AreaChart, Card, Title } from '@tremor/react';

export interface TraceDataPoint {
  date: string;       // e.g. "May 01"
  traces: number;
  errors: number;
}

interface TracesAreaChartProps {
  data: TraceDataPoint[];
  title?: string;
}

const valueFormatter = (n: number) => `${n.toLocaleString()} traces`;

export function TracesAreaChart({ data, title = 'Traces over time' }: TracesAreaChartProps) {
  return (
    <Card>
      <Title>{title}</Title>
      <AreaChart
        className="mt-4 h-48"
        data={data}
        index="date"
        categories={['traces', 'errors']}
        colors={['blue', 'red']}
        valueFormatter={valueFormatter}
        yAxisWidth={60}
      />
    </Card>
  );
}
```

- [ ] **Step 3: Create TracesTable.tsx**

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/components/tremor/TracesTable.tsx`:

```typescript
'use client';

import { Badge, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';

export interface TraceRow {
  id: string;
  agent: string;
  status: 'success' | 'error' | 'running';
  duration: string;  // e.g. "1.2s"
  timestamp: string; // e.g. "2026-05-09 14:22"
}

const STATUS_COLOR: Record<TraceRow['status'], 'emerald' | 'red' | 'yellow'> = {
  success: 'emerald',
  error: 'red',
  running: 'yellow',
};

interface TracesTableProps {
  rows: TraceRow[];
}

export function TracesTable({ rows }: TracesTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>ID</TableHeaderCell>
          <TableHeaderCell>Agent</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Duration</TableHeaderCell>
          <TableHeaderCell>Timestamp</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">{row.id}</TableCell>
            <TableCell>{row.agent}</TableCell>
            <TableCell>
              <Badge color={STATUS_COLOR[row.status]}>{row.status}</Badge>
            </TableCell>
            <TableCell>{row.duration}</TableCell>
            <TableCell className="text-gray-500">{row.timestamp}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Create index.ts barrel**

Create `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/components/tremor/index.ts`:

```typescript
export { MetricCard } from './MetricCard';
export type { DeltaType } from './MetricCard';
export { TracesAreaChart } from './TracesAreaChart';
export type { TraceDataPoint } from './TracesAreaChart';
export { TracesTable } from './TracesTable';
export type { TraceRow } from './TracesTable';
```

- [ ] **Step 5: Build to verify**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm run build 2>&1 | tail -15
```

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace && git add apps/dashboard/src/components/tremor/ && git commit -m "feat: add Tremor MetricCard, TracesAreaChart, TracesTable components"
```

---

## Task 12: Wire Tremor components into agenttrace dashboard page

**Files:**
- Modify: `agenttrace/apps/dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard page**

```bash
cat /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/app/dashboard/page.tsx | head -80
```

Note the existing imports and the structure of the page — specifically where the main content area begins and whether there are already any chart/stats components.

- [ ] **Step 2: Add Tremor section to dashboard page**

At the top of `/Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard/src/app/dashboard/page.tsx`, after the existing imports, add:

```typescript
import { MetricCard, TracesAreaChart, TracesTable } from '@/components/tremor';
import type { TraceDataPoint, TraceRow } from '@/components/tremor';
```

Then inside the page component, before the existing JSX return, add static placeholder data (this is replaced by real API data in a future task):

```typescript
const METRIC_DATA = [
  { title: 'Total Traces', value: '12,543', delta: '+8.2%', deltaType: 'increase' as const },
  { title: 'Error Rate', value: '0.4%', delta: '-0.1%', deltaType: 'moderateDecrease' as const },
  { title: 'Avg Latency', value: '1.8s', delta: '+0.2s', deltaType: 'moderateIncrease' as const },
  { title: 'Active Agents', value: '7', delta: 'unchanged', deltaType: 'unchanged' as const },
];

const CHART_DATA: TraceDataPoint[] = [
  { date: 'May 04', traces: 320, errors: 12 },
  { date: 'May 05', traces: 480, errors: 8 },
  { date: 'May 06', traces: 410, errors: 15 },
  { date: 'May 07', traces: 650, errors: 4 },
  { date: 'May 08', traces: 720, errors: 6 },
  { date: 'May 09', traces: 540, errors: 9 },
];

const TABLE_DATA: TraceRow[] = [
  { id: 'trc_001', agent: 'ResearchAgent', status: 'success', duration: '1.2s', timestamp: '2026-05-09 14:22' },
  { id: 'trc_002', agent: 'SummaryAgent', status: 'error', duration: '3.5s', timestamp: '2026-05-09 14:18' },
  { id: 'trc_003', agent: 'PlanAgent', status: 'running', duration: '—', timestamp: '2026-05-09 14:30' },
];
```

In the JSX return, insert a Tremor section at the top of the main content area, before existing content:

```tsx
{/* Tremor metrics row */}
<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
  {METRIC_DATA.map((m) => (
    <MetricCard
      key={m.title}
      title={m.title}
      value={m.value}
      delta={m.delta}
      deltaType={m.deltaType}
    />
  ))}
</div>

{/* Tremor area chart */}
<div className="mb-6">
  <TracesAreaChart data={CHART_DATA} title="Trace volume — last 6 days" />
</div>

{/* Tremor traces table */}
<div className="mb-6">
  <TracesTable rows={TABLE_DATA} />
</div>
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm run build 2>&1 | tail -15
```

Expected: exit code 0.

- [ ] **Step 4: Commit and push**

```bash
cd /Users/sivaprakasam/projects/agents/agenttrace && git add apps/dashboard/src/app/dashboard/page.tsx && git commit -m "feat: wire Tremor MetricCard + AreaChart + TracesTable into dashboard"
git push origin main
```

---

## Task 13: Document /design-html workflow for ai-resume-builder

The `/design-html` skill runs interactively in a Claude Code session — it cannot be automated. This task documents the exact steps so the workflow is repeatable and auditable.

**Files:**
- Create: `ai-resume-builder/docs/design-html-workflow.md`

- [ ] **Step 1: Create docs/design-html-workflow.md**

Create `/Users/sivaprakasam/projects/agents/ai-resume-builder/docs/design-html-workflow.md`:

```markdown
# /design-html Workflow — ai-resume-builder

This document describes the interactive Claude design workflow for applying
Claude-generated HTML/CSS polish to the ai-resume-builder (resumevault.app).

## When to run

Run this workflow when:
- Starting a new UI pass on the builder or landing page
- The Playwright smoke test flags a CTA visibility issue
- DESIGN.md is updated with a new design system brief

## Pre-requisites

1. Be in a Claude Code session with the `superpowers` skill set loaded.
2. Have the current `src/app/page.tsx` and `src/app/globals.css` open for reference.
3. Know the target page: landing (`/`) or builder UI (`/` after interaction).

## Step-by-step

### 1. Read DESIGN.md

```bash
cat /Users/sivaprakasam/projects/agents/ai-resume-builder/DESIGN.md
```

Note the design system match (Apple), layout archetype (CareerPortfolio), and Stitch prompt. These guide the design brief.

### 2. Invoke the /design-html skill

In Claude Code, run:

```
/design-html
```

When prompted for the brief, paste the following template (fill in the bracketed sections from DESIGN.md):

```
Product: AI Resume Builder (resumevault.app)
Design system: Apple — clean white space, SF Pro-style typography, subtle depth, no gradients
Layout archetype: CareerPortfolio — hero with credential proof, two-column builder, preview pane
Existing stack: Next.js 15, Tailwind v4, liquid-glass globals.css already applied

Target section: [landing hero OR builder two-column layout — pick one per run]

Requirements:
- Hero: large H1 "Land your next role with AI", sub-headline, ShimmerButton CTA "Build my resume free"
- Social proof strip: 3 stat cards (ATS score avg 94%, 10k+ resumes built, 2min to first draft)
- Trust signals: "No signup needed" badge, "Used by engineers at [Google / Meta / Amazon]"
- Builder: left column = form fields (Name, Job title, Experience textarea, Skills chips), right column = live resume preview with PDF download button
- Color palette: white bg, #1d1d1f text, #0071e3 CTA blue, subtle #f5f5f7 section backgrounds
- No emojis in the design output
- Output: a single self-contained HTML file with inline Tailwind classes
```

### 3. Review the HTML output

The skill outputs a full HTML mockup. Review for:
- CTA button is clearly visible (the Playwright smoke test checks this)
- H1 is present and prominent
- No horizontal overflow at 375px width (open browser DevTools → 375px viewport)
- Matches Apple design system feel (clean, no gradients, proper spacing)

### 4. Convert HTML → React components

For each distinct section in the HTML output:

1. Create a new file in `src/components/sections/`:
   - `HeroSection.tsx` — hero + CTA + social proof
   - `BuilderLayout.tsx` — two-column builder + preview
   - `TrustStrip.tsx` — stat cards + trust badges

2. Copy the HTML for that section into the component.
3. Convert `class=` → `className=`.
4. Replace hardcoded text with props where the value may change.
5. Wrap interactive elements in `'use client'` if they use state.

### 5. Update src/app/page.tsx

Replace the current hero/builder JSX with the new section components:

```tsx
import { HeroSection } from '@/components/sections/HeroSection'
import { TrustStrip } from '@/components/sections/TrustStrip'
import { BuilderLayout } from '@/components/sections/BuilderLayout'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <TrustStrip />
      <BuilderLayout />
    </main>
  )
}
```

### 6. Run Playwright smoke test to verify

```bash
cd /Users/sivaprakasam/projects/agents/ai-resume-builder
npm run dev &
sleep 5
BASE_URL=http://localhost:3000 npm run test:smoke
kill %1
```

All 5 tests must pass before committing.

### 7. Commit

```bash
git add src/app/page.tsx src/components/sections/
git commit -m "design: apply /design-html Apple CareerPortfolio layout to landing"
git push origin main
```

## Notes

- Run this workflow once per section, not the entire page at once
- The /design-html skill works best with concrete colour codes and layout descriptions
- After commit, the GitHub Actions QA workflow will run automatically
```

- [ ] **Step 2: Commit**

```bash
cd /Users/sivaprakasam/projects/agents/ai-resume-builder && mkdir -p docs && git add docs/design-html-workflow.md && git commit -m "docs: add /design-html interactive workflow guide"
git push origin main
```

---

## Task 14: End-to-end validation across all three pilots

- [ ] **Step 1: Confirm GitHub Actions workflows exist in all three repos**

```bash
ls /Users/sivaprakasam/projects/agents/kwizzo/.github/workflows/
ls /Users/sivaprakasam/projects/agents/agenttrace/.github/workflows/
ls /Users/sivaprakasam/projects/agents/ai-resume-builder/.github/workflows/
```

Expected: each shows `qa.yml`.

- [ ] **Step 2: Trigger a push to confirm GHA runs**

Each project was already pushed in prior tasks. Verify in GitHub Actions UI:

- github.com/infosiva/kwizzo/actions — should show "Post-Deploy QA Smoke Test" run
- github.com/infosiva/agenttrace/actions — same
- github.com/infosiva/ai-resume-builder/actions — same

- [ ] **Step 3: Confirm Telegram alert is NOT firing (all passing)**

No Telegram message = tests passing. If a message arrives, open the failing Actions run URL from the message, read the failing test, fix the `smoke.spec.ts` selector, commit the fix, re-push.

- [ ] **Step 4: Run smoke tests locally one final time for all three**

```bash
# kwizzo
cd /Users/sivaprakasam/projects/agents/kwizzo && npm run dev &
sleep 6
BASE_URL=http://localhost:3000 npm run test:smoke
kill %1

# agenttrace (dashboard only)
cd /Users/sivaprakasam/projects/agents/agenttrace/apps/dashboard && pnpm run dev &
sleep 6
BASE_URL=http://localhost:3000 pnpm run test:smoke
kill %1

# ai-resume-builder
cd /Users/sivaprakasam/projects/agents/ai-resume-builder && npm run dev &
sleep 6
BASE_URL=http://localhost:3000 npm run test:smoke
kill %1
```

Expected: all three runs exit 0 with all tests green.

- [ ] **Step 5: Final commit (if any fixes were applied)**

```bash
# Only if smoke.spec.ts was adjusted during validation:
cd /Users/sivaprakasam/projects/agents/kwizzo && git add qa/smoke.spec.ts && git commit -m "fix: adjust CTA selector in smoke spec" && git push origin main
```

---

## Propagation Checklist (Post-Pilot)

After all three pilots pass for 2+ pushes without a Telegram alert, apply the same QA gate to the remaining 12 projects using this checklist:

| Project | Repo | VERCEL_PRODUCTION_URL secret | AI endpoint path |
|---------|------|------------------------------|-----------------|
| tutiq | infosiva/nudge | https://tutiq.app | /api/chat |
| quizbites | infosiva/questly | https://quizbites.app | /api/quiz |
| social-media-calendar | infosiva/social-media-calendar | https://draftcal.app | /api/generate |
| ai-investment-tracker | infosiva/ai-investment-tracker | https://trackwealth.app | /api/analyze |
| ai-travel-planner | infosiva/ai-travel-planner | https://roamplan.app | /api/plan |
| language-learning-bot | infosiva/language-learning-bot | https://speakiq.app | /api/chat |
| nammatamil | infosiva/nammatamil | https://nammatamil.live | /api/chat |
| pixelforge | infosiva/pixelforge | https://arcadeforge.app | /api/generate |
| complybuddy | infosiva/complybuddy | https://complyscan.app | /api/check |
| flighttracker | infosiva/flighttracker | https://flightbrain.app | /api/track |
| ai-resume-builder | infosiva/ai-resume-builder | https://resumevault.app | /api/generate |

For each: copy `qa/smoke.spec.ts` from the closest pilot (same stack), update the AI endpoint path and CTA selector pattern, copy `.github/workflows/qa.yml` verbatim, add the three secrets, push.
