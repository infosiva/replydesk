# 🏸 Badminton Booking Bot

Automatically books **Court 4 or 5** (any fallback) at [makesweat.com/nbc#facilities](https://makesweat.com/nbc#facilities)
every **Wednesday** — two 1-hour slots: **8 PM–9 PM** and **9 PM–10 PM**.

---

## How It Works

| Time (UK)            | Action |
|----------------------|--------|
| Tuesday **8:00 AM**  | Sends you a Telegram message asking for approval |
| You reply **YES**    | Bot confirms and schedules the booking |
| Tuesday **11:58 PM** | Bot opens the booking site (browser set to Texas timezone) |
| By **midnight**      | Both courts booked and payment taken (£21.50 × 2 = £43.00) |
| Midnight             | Sends you a Telegram confirmation with results |

---

## Files

| File | Purpose |
|------|---------|
| `config.py` | All settings & credentials |
| `booking.py` | Playwright browser automation |
| `scheduler.py` | APScheduler + Telegram bot (main entry point) |
| `get_chat_id.py` | One-time helper to find your Telegram chat ID |
| `setup.sh` | Install everything + register macOS LaunchAgent |
| `logs/` | Screenshots and log files for debugging |

---

## Setup (One Time)

### 1. Install dependencies
```bash
cd /Users/sivaprakasam/projects/agents/badminton
chmod +x setup.sh
./setup.sh
```

### 2. Create a Telegram bot
1. Open Telegram → search **@BotFather** → send `/newbot`
2. Follow the steps → copy the **bot token**

### 3. Find your chat ID
1. Paste the token into `config.py` → `TELEGRAM_BOT_TOKEN`
2. Run:
   ```bash
   python3 get_chat_id.py
   ```
3. Send **any message** to your bot in Telegram
4. Copy the printed chat ID into `config.py` → `TELEGRAM_CHAT_ID`

### 4. Start the bot
```bash
python3 scheduler.py
```
The bot runs forever (LaunchAgent auto-starts it on login).

---

## Telegram Commands

| Command | Effect |
|---------|--------|
| `/status` | Show current approval status & next booking date |
| `/approve` | Approve this week's booking (same as replying YES) |
| `/booknow` | **Test mode** — trigger booking immediately |

---

## Booking Details

- **Site:** makesweat.com/nbc#facilities
- **Email:** info.siva@gmail.com
- **Courts:** Court 4 → Court 5 → any available
- **Slots:** 20:00–21:00 and 21:00–22:00
- **Title:** Badminton MK
- **Rate:** Member
- **Cost:** £21.50 per hour (£43.00 total)
- **Address:** 31 Simford Way, Milton Keynes, MK8 1DQ
- **Payment:** Saved card (ending 6811)
- **Browser timezone:** America/Chicago (Texas CST) during booking

---

## Troubleshooting

- **Screenshots** are saved to `logs/` at each step — check these if booking fails
- Run with `headless=False` in `booking.py` to watch the browser live
- Use `/booknow` in Telegram to do a test run any time
