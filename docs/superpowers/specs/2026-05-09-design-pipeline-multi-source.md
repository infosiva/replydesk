# Multi-Source Design Pipeline + Auto QA Gate Design Spec

**Date:** 2026-05-09  
**Status:** Approved for implementation

---

## Goal

Give every project a unique, modern UI/UX sourced from the right design tool for its personality. Automate UI/UX validation on every deploy so broken nav/layouts never reach users.

---

## Two Sub-Systems

### 1. Multi-Source Design Pipeline

Three design sources rotate across 15 projects:

| Source | Projects | Strengths |
|--------|----------|-----------|
| **Magic UI** | kwizzo, social-media-calendar, nammatamil | Animated components, shimmer, particles, playful |
| **Google Stitch → MCP** | tutiq, complybuddy, idea-factory | Structured wireframes, professional, conversation-first |
| **Aceternity UI** | quizbites, ai-travel-planner, pixelforge | 3D cards, spotlight, cinematic wow-factor |
| **Tremor** | agenttrace, ai-investment-tracker, flighttracker | Charts, dashboards, data tables, metrics |
| **Claude /design-html** | ai-resume-builder, language-learning-bot, protoforge | AI-generated polish, custom layouts |

**Integration point:** All sources output React/Tailwind components compatible with existing liquid glass `globals.css`. New components layer ON TOP of existing system — no rip-and-replace.

**Workflow per project:**
1. Pull components from source library
2. Apply project theme token (color, radius, font from `vertical.config.ts`)
3. Layer liquid glass CSS on top (already in `globals.css`)
4. Run `/qa` smoke test on result

### 2. Auto QA Gate on Every Push

**Trigger:** GitHub Actions post-deploy hook on every push to `main`

**What it checks (per project, per deploy):**
1. All nav routes return 200 (no 404/500)
2. Hero section renders (H1 present in DOM)
3. Primary CTA button visible + clickable
4. One AI endpoint responds non-empty within 10s
5. No broken images (no img 404s)
6. Mobile viewport (375px) no horizontal overflow

**Tooling:** Playwright + Chromium (same as gstack `/qa` skill)

**On failure:**
- Telegram alert to `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` (already in site-watchdog `.env`)
- GitHub Actions step marked failed (visible in PR/push history)
- site-watchdog on VPS logs the failure + retries after 5min

**On success:** Silent. No noise.

---

## Architecture

```
push to main
    ↓
GitHub Actions: deploy to Vercel (existing)
    ↓
GitHub Actions: post-deploy QA step
    ├── playwright test --project=chromium qa/smoke.spec.ts
    │       ├── check all nav routes
    │       ├── check hero + CTA
    │       ├── check AI endpoint
    │       └── check mobile viewport
    ↓
pass → done
fail → Telegram alert + GH Actions failure
```

**Shared QA spec file:** `qa/smoke.spec.ts` lives in each project root. Same template across all projects, parameterised by `BASE_URL` env var (set to Vercel production URL).

---

## Files Per Project

| File | Action | Purpose |
|------|--------|---------|
| `qa/smoke.spec.ts` | Create | Playwright smoke test — nav, hero, CTA, AI, mobile |
| `qa/playwright.config.ts` | Create | Playwright config, BASE_URL from env |
| `.github/workflows/qa.yml` | Create | Post-deploy QA GitHub Action |
| `package.json` | Modify | Add `@playwright/test` devDep + `test:smoke` script |

---

## Design Source Installation Per Project

### Magic UI (kwizzo, social-media-calendar, nammatamil)
```bash
npx shadcn@latest init   # if not present
# Then copy components from magicui.design — no npm package, copy-paste
```
Key components: `shimmer-button`, `animated-list`, `particles`, `blur-in`, `number-ticker`

### Aceternity UI (quizbites, ai-travel-planner, pixelforge)
```bash
npx shadcn@latest init
# Copy components from ui.aceternity.com
```
Key components: `3d-card`, `spotlight`, `floating-navbar`, `text-generate-effect`, `background-beams`

### Tremor (agenttrace, ai-investment-tracker, flighttracker)
```bash
npm install @tremor/react
```
Key components: `AreaChart`, `BarChart`, `Card`, `Metric`, `Badge`, `Table`, `Tracker`

### Claude /design-html (ai-resume-builder, language-learning-bot, protoforge)
- Run `/design-html` skill with project brief
- Output: full HTML mockup
- Convert to React components manually per section

### Google Stitch → MCP (tutiq, complybuddy, idea-factory)
- Blocked until Initiative #2 (Stitch MCP bridge) is built
- Interim: use Claude /design-html as placeholder

---

## Pilot Projects (implement first, validate pattern, then propagate)

1. **kwizzo** (Magic UI) — simplest library, quickest win
2. **agenttrace** (Tremor) — already needs charts, most value
3. **ai-resume-builder** (Claude /design-html) — tests Claude design quality

After pilots pass QA gate → roll to remaining 12 projects.

---

## Out of Scope

- NVidia MCP (separate spec + plan)
- Stitch MCP bridge (separate spec — Initiative #2)
- Monetization layer (follows after UX solid)
- Hermes scope automation (Initiative #3)
