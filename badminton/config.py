# ============================================================
# BADMINTON COURT BOOKING BOT - CONFIGURATION
# ============================================================

# --- makesweat.com Credentials ---
MAKESWEAT_EMAIL = "info.siva@gmail.com"
MAKESWEAT_PASSWORD = "Siva1981"
MAKESWEAT_URL = "https://makesweat.com/nbc#facilities"

# --- Telegram Bot Settings ---
# 1. Message @BotFather on Telegram → /newbot → follow steps → copy token below
# 2. Run: python3 get_chat_id.py → send any message to your bot → get your chat ID
TELEGRAM_BOT_TOKEN = "8211311635:AAFeqUzCieeXd_CWJ0B9YOszgTuX4RIuMmo"
TELEGRAM_CHAT_ID   = "8452559091"

# --- Booking Preferences ---
PREFERRED_COURTS   = ["Court 4", "Court 5"]   # Priority order
FALLBACK_ANY_COURT = True                      # Try any court if preferred not available
BOOKING_SLOTS      = [20, 21]                  # 8pm (20:00) and 9pm (21:00) UK time

# --- Booking Form Details ---
BOOKING_TITLE = "Badminton MK"
BOOKING_RATE  = "Member"
COST_PER_HOUR = 21.50                          # £21.50 per hour (£43 total)

# --- Contact Details (pre-filled on site) ---
CONTACT = {
    "address_line_1": "31, simford way",
    "address_line_2": "",
    "town":           "milton keynes",
    "postcode":       "mk81dq",
    "phone":          "07550350499",
    "country":        "United Kingdom",
}

# --- Schedule Timing (all UK time) ---
APPROVAL_SEND_TIME  = {"hour": 8,  "minute": 0}   # 8:00 AM Tuesday → send Telegram approval
BOOKING_RUN_TIME    = {"hour": 23, "minute": 58}   # 11:58 PM Tuesday → start booking

# --- Timezone ---
TEXAS_TZ = "America/Chicago"   # CST/CDT — browser emulates this during booking
UK_TZ    = "Europe/London"

# --- Dry Run Mode ---
# Set to True to go through the full flow but STOP before clicking Pay
# Use this to verify everything works before letting it charge your card
DRY_RUN = True   # ← change to False when you are ready to go live

# --- State file (persists approval between restarts) ---
STATE_FILE = "/Users/sivaprakasam/projects/agents/badminton/state.json"
LOG_DIR    = "/Users/sivaprakasam/projects/agents/badminton/logs"
