# Site Watchdog 🐾

Autonomous agent that cycles through your 8 websites — one per day — analyzing, improving, reviewing, deploying, and notifying you via Telegram.

## How It Works

```
Daily Cron
    ↓
Pick next website (rotating)
    ↓
[Agent 1] Analyzer — reads source files, finds SEO/monetization/UX issues
    ↓
[Agent 2] Improver — generates specific code fixes using Claude
    ↓
Apply changes to files
    ↓
[Agent 3] Reviewer — validates changes are safe and high quality
    ↓ (if approved)
[Deployer] git commit + vercel --prod
    ↓
[Notifier] Telegram message with what changed + live URL
```

## Setup

### 1. Install dependencies

```bash
cd /Users/sivaprakasam/projects/agents/site-watchdog
npm install
```

### 2. Get Vercel Token

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Create a token
vercel tokens create site-watchdog
```

Add the token to `.env`:
```
VERCEL_TOKEN=your_token_here
```

### 3. Test Telegram

```bash
npm run test-notify
```

You should get a message on Telegram: "✅ Site Watchdog is connected and ready!"

### 4. Test a dry run (no deployment)

```bash
DRY_RUN=true npm start
```

### 5. Check status

```bash
npm run status
```

### 6. Set up daily cron on VPS

```bash
# Edit crontab
crontab -e

# Add this line to run at 8 AM daily
0 8 * * * cd /Users/sivaprakasam/projects/agents/site-watchdog && npm start >> logs/cron.log 2>&1
```

## What Gets Improved

For each site, the agent focuses on:

| Site | Focus |
|------|-------|
| ClawdBot AI | SEO, AdSense placement, user engagement |
| QuickTech AI | YouTube CTAs, subscriber growth, monetization |
| QuizBytes Daily | Viral sharing, user retention, monetization |
| World Trends | SEO, trending content, AdSense |
| AI Jobs Portal | SEO, email capture, monetization |

## Adding More Sites

Edit `websites.config.json` and add a new entry:

```json
{
  "id": "mysite",
  "name": "My Site",
  "path": "/path/to/project",
  "vercelProject": "vercel-project-name",
  "url": "https://mysite.com",
  "type": "nextjs",
  "youtubeChannel": "@MyChannel",
  "focus": ["seo", "monetization", "youtube-cta"],
  "keyFiles": [
    "app/layout.tsx",
    "app/page.tsx",
    "components"
  ]
}
```

## Telegram Notifications

You'll receive a message like:

```
🤖 Site Watchdog Report

🌐 Site: QuickTech AI
📅 Date: 01/04/2026

✅ Status: Deployed Successfully
🔗 Live URL: https://quicktech.vercel.app

📝 Changes Made:
  • app/layout.tsx: Improved meta description with keywords
  • components/Hero.tsx: Added YouTube subscribe CTA

Expected Impact:
  📈 Better Google ranking for "AI tech videos"
  📈 More YouTube subscribers from site visitors

🔎 Review Score: 87/100
💬 Review: Changes are safe and impactful

Please check the live site and verify the changes look good.
```

## File Structure

```
site-watchdog/
├── src/
│   ├── index.ts        # Main orchestrator
│   ├── analyzer.ts     # Claude-powered site analysis
│   ├── improver.ts     # Code improvement generator + applier
│   ├── reviewer.ts     # Review agent
│   ├── deployer.ts     # Vercel deployment
│   ├── notifier.ts     # Telegram notifications
│   ├── fileUtils.ts    # File reading/writing utilities
│   ├── types.ts        # TypeScript interfaces
│   └── status.ts       # Status checker
├── websites.config.json  # Your 8 sites config
├── state.json            # Rotation state + history
├── .env                  # API keys
└── logs/                 # Daily run logs
```
