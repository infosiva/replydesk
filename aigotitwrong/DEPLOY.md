# AIGotItWrong — Deploy to VPS

## One-time setup (local)

### 1. Create YouTube channel + Google Cloud project
1. Go to console.cloud.google.com → New Project: "aigotitwrong"
2. Enable: YouTube Data API v3
3. Create OAuth2 credentials (Desktop app) → download JSON
4. Copy Client ID + Secret to `.env`

### 2. Get YouTube OAuth refresh token
```bash
npm install
npm run youtube:setup
# Follow the URL → authorize → paste code → copy YOUTUBE_REFRESH_TOKEN to .env
```

### 3. Get your YouTube Channel ID
- Go to youtube.com → Your channel → URL contains channel ID (starts with UC...)
- Add to `.env` as YOUTUBE_CHANNEL_ID

### 4. Fill in `.env`
```
cp .env.example .env
# Add all API keys
```

---

## Deploy to VPS

```bash
# From local machine
scp -r . root@31.97.56.148:/root/agents/aigotitwrong/

# SSH into VPS
ssh root@31.97.56.148

cd /root/agents/aigotitwrong
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 logs aigotitwrong
```

## Manual test run
```bash
# Trigger one full pipeline run right now
npm run pipeline:run

# Or on VPS:
node dist/index.js --run-now morning
```

## Schedule (UTC)
- 2:30 UTC = 8:00 AM IST (morning slot — science/biology/health)
- 8:30 UTC = 2:00 PM IST (afternoon slot — technology/finance/space)
- 14:30 UTC = 8:00 PM IST (evening slot — animals/food/nature)

## Cost per video: ~$0.55
- Claude Haiku: $0.015
- ElevenLabs TTS: ~$0.03
- fal.ai Kling (3 clips × 5s): $0.50
- Total/month (90 videos): ~$49.50

## Logs
- `logs/pipeline.log` — full pipeline logs
- `logs/error.log` — errors only
- `logs/costs.log` — per-video cost tracking
- `logs/pm2-out.log` — PM2 stdout
