# NammaTVK 2026 — @NammaTVK-2026 YouTube Channel Slide

A standalone one-page slide for the @NammaTVK-2026 YouTube channel.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main 1920×1080 slide — Vijay portrait + TVK whistle logo + stats |
| `slide-reels.html` | → symlink to `../nammatamil/public/tvk-reels.html` |
| `slide-landscape.html` | → symlink to `../nammatamil/public/exit-poll-video.html` |

## Usage

Open `index.html` in any browser — it scales to fill the window.

### Upload to YouTube as a video slide:
1. Open in Chrome fullscreen (F11)
2. Record screen with OBS / QuickTime at 1920×1080
3. Export as MP4 and upload to @NammaTVK-2026

### Live on nammatamil.live:
The slide is already served at:
- `https://nammatamil.live/exit-poll-video.html` (landscape)  
- `https://nammatamil.live/tvk-reels.html` (vertical / Shorts)

## API dependency

The slide pulls live data from `/api/election-results` and `/api/tvk-news`.
These are hosted on `nammatamil.live` (Next.js app in `../nammatamil/`).

When served from `nammatamil.live`, all APIs work automatically.
When opened as a local file, the static data (exit poll projections) is shown — no API key needed.

## .env

Uses the same `.env` as `../nammatamil/.env`:
- `GROQ_API_KEY` — AI parsing of election results
- `GEMINI_API_KEY` — fallback AI
- `ANTHROPIC_API_KEY` — fallback AI (paid, last resort)

No additional keys needed for this slide.
