"""
scheduler.py — Main entry point.

Runs permanently on your Mac and:
  • Every Tuesday 08:00 AM UK  → sends Telegram approval request
  • After you reply YES        → confirms and prepares for 11:58 PM run
  • Tuesday 11:58 PM UK        → starts Playwright booking (if approved)
  • After booking              → sends Telegram result summary
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from telegram import Bot, Update
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    filters, ContextTypes,
)

# ── local imports ──────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
import config
import booking as bk

# ── logging ────────────────────────────────────────────────────────────────────
os.makedirs(config.LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(config.LOG_DIR, "booking.log")),
    ],
)
logger = logging.getLogger(__name__)

UK_TZ = pytz.timezone(config.UK_TZ)

# ── persistent state ───────────────────────────────────────────────────────────
STATE_FILE = Path(config.STATE_FILE)

def _load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"approved": False, "approved_at": None}

def _save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))

def _is_approved_this_tuesday() -> bool:
    """Return True only if approval was granted today (Tuesday UK time)."""
    state = _load_state()
    if not state.get("approved") or not state.get("approved_at"):
        return False
    approved_dt = datetime.fromisoformat(state["approved_at"]).astimezone(UK_TZ)
    now_uk = datetime.now(UK_TZ)
    # Same calendar day and it IS a Tuesday
    return (approved_dt.date() == now_uk.date() and now_uk.weekday() == 1)

def _set_approval(approved: bool):
    state = _load_state()
    state["approved"]    = approved
    state["approved_at"] = datetime.now(UK_TZ).isoformat() if approved else None
    _save_state(state)


# ── Telegram helpers ───────────────────────────────────────────────────────────

def _target_info() -> str:
    target = bk.get_next_wednesday()
    return target.strftime("%A %d %B %Y")

async def send_approval_request(bot: Bot):
    """Send the weekly approval message on Tuesday morning."""
    target_str = _target_info()
    total = config.COST_PER_HOUR * len(config.BOOKING_SLOTS)

    msg = (
        f"🏸 *Badminton Booking — Weekly Approval*\n\n"
        f"📅 Date: {target_str}\n"
        f"🕗 Slots: 8:00 PM–9:00 PM  &  9:00 PM–10:00 PM\n"
        f"🎾 Court: Court 4 or 5  (any available as fallback)\n"
        f"💷 Total cost: £{total:.2f}  (£{config.COST_PER_HOUR:.2f} × 2)\n"
        f"📍 Venue: NBC Badminton — makesweat.com\n\n"
        f"⏰ Booking will auto-run at *11:58 PM UK time* tonight.\n\n"
        f"Reply *YES* to approve  |  *NO* to cancel"
    )
    await bot.send_message(
        chat_id=config.TELEGRAM_CHAT_ID,
        text=msg,
        parse_mode="Markdown",
    )
    logger.info("Approval request sent via Telegram")

async def send_results(bot: Bot, results: list[dict]):
    """Send booking results via Telegram."""
    lines = ["🏸 *Booking Results*\n"]
    all_ok = True

    for r in results:
        h = r["hour"]
        icon = "✅" if r["success"] else "❌"
        lines.append(f"{icon} *{h:02d}:00–{h+1:02d}:00*\n_{r['message']}_")
        if not r["success"]:
            all_ok = False

    msg = "\n\n".join(lines)
    if all_ok:
        msg += f"\n\n🎉 Both slots booked! Total charged: £{config.COST_PER_HOUR * 2:.2f}"
    else:
        msg += "\n\n⚠️ Some bookings failed — please check makesweat.com manually."

    await bot.send_message(
        chat_id=config.TELEGRAM_CHAT_ID,
        text=msg,
        parse_mode="Markdown",
    )


# ── scheduled jobs ─────────────────────────────────────────────────────────────

async def job_tuesday_morning(bot: Bot):
    """8:00 AM Tuesday — send approval request."""
    logger.info("⏰ Tuesday morning job triggered")
    _set_approval(False)   # reset from last week
    await send_approval_request(bot)

async def job_tuesday_night(bot: Bot):
    """11:58 PM Tuesday — run booking if approved."""
    logger.info("⏰ Tuesday night job triggered")

    if not _is_approved_this_tuesday():
        logger.info("No approval for today — skipping booking")
        await bot.send_message(
            chat_id=config.TELEGRAM_CHAT_ID,
            text="⏭️ No approval received for this week — booking skipped.",
        )
        return

    mode = "🧪 DRY RUN (no payment)" if config.DRY_RUN else "🔴 LIVE (card will be charged)"
    await bot.send_message(
        chat_id=config.TELEGRAM_CHAT_ID,
        text=(
            f"⏳ Starting booking now… [{mode}]\n"
            "Browser timezone set to Texas (CST) — navigating to makesweat.com"
        ),
    )

    cfg = {
        "makesweat_email":   config.MAKESWEAT_EMAIL,
        "makesweat_password": config.MAKESWEAT_PASSWORD,
        "preferred_courts":  config.PREFERRED_COURTS,
        "booking_slots":     config.BOOKING_SLOTS,
        "booking_title":     config.BOOKING_TITLE,
        "booking_rate":      config.BOOKING_RATE,
        "contact":           config.CONTACT,
        "fallback_any_court": config.FALLBACK_ANY_COURT,
        "texas_tz":          config.TEXAS_TZ,
        "dry_run":           config.DRY_RUN,
    }

    try:
        results = await bk.run_all_bookings(cfg)
        await send_results(bot, results)
    except Exception as exc:
        logger.exception("Booking process failed")
        await bot.send_message(
            chat_id=config.TELEGRAM_CHAT_ID,
            text=(
                f"❌ Booking process crashed:\n`{exc}`\n\n"
                "Please book manually at makesweat.com/nbc#facilities"
            ),
            parse_mode="Markdown",
        )


# ── Telegram message handlers ──────────────────────────────────────────────────

async def on_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (update.message.text or "").strip().upper()

    if text == "YES":
        _set_approval(True)
        target = _target_info()
        total  = config.COST_PER_HOUR * 2
        await update.message.reply_text(
            f"✅ Approved!\n\n"
            f"📅 Booking: {target}\n"
            f"⏰ Will run at 11:58 PM UK time tonight\n"
            f"💷 Expected charge: £{total:.2f}\n\n"
            f"You'll receive a confirmation once it's done."
        )
        logger.info("Approval: YES received from user")

    elif text == "NO":
        _set_approval(False)
        await update.message.reply_text("❌ Booking cancelled for this week.")
        logger.info("Approval: NO received from user")

    else:
        await update.message.reply_text(
            "Reply *YES* to approve this week's booking or *NO* to cancel.",
            parse_mode="Markdown",
        )

async def on_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    approved = _is_approved_this_tuesday()
    status   = "✅ Approved" if approved else "⏳ Awaiting approval"
    target   = _target_info()
    await update.message.reply_text(
        f"📊 Status: {status}\n"
        f"📅 Next booking: {target}\n"
        f"🕗 Slots: 8 PM–9 PM  &  9 PM–10 PM\n"
        f"💷 Cost: £{config.COST_PER_HOUR * 2:.2f}\n"
        f"⏰ Runs: Tuesday 11:58 PM UK time",
    )

async def on_book_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: /booknow — trigger booking immediately (for testing)."""
    await update.message.reply_text("🚀 Manual booking triggered!")
    await job_tuesday_night(context.bot)

async def on_approve(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/approve — shortcut to approve without typing YES."""
    _set_approval(True)
    await update.message.reply_text("✅ Approved via /approve command.")


# ── main ───────────────────────────────────────────────────────────────────────

async def main():
    if config.TELEGRAM_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("\n❗ Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in config.py first!\n")
        sys.exit(1)

    logger.info("🏸 Badminton Booking Bot starting…")

    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()
    bot = app.bot

    # Register handlers
    app.add_handler(CommandHandler("status",   on_status))
    app.add_handler(CommandHandler("booknow",  on_book_now))
    app.add_handler(CommandHandler("approve",  on_approve))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_message))

    # Scheduler
    scheduler = AsyncIOScheduler(timezone=UK_TZ)

    scheduler.add_job(
        job_tuesday_morning,
        CronTrigger(day_of_week="tue", hour=8, minute=0, timezone=UK_TZ),
        args=[bot],
        id="morning_approval",
        name="Tuesday 8AM — Send Approval Request",
        replace_existing=True,
    )
    scheduler.add_job(
        job_tuesday_night,
        CronTrigger(day_of_week="tue", hour=23, minute=58, timezone=UK_TZ),
        args=[bot],
        id="night_booking",
        name="Tuesday 11:58PM — Run Booking",
        replace_existing=True,
    )
    scheduler.start()

    logger.info("Scheduler active:")
    logger.info("  • Tuesday 08:00 AM UK → Send Telegram approval")
    logger.info("  • Tuesday 11:58 PM UK → Book courts (if approved)")
    logger.info("Telegram commands: /status  /approve  /booknow")

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    try:
        await asyncio.Event().wait()   # run forever
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down…")
    finally:
        scheduler.shutdown()
        await app.updater.stop()
        await app.stop()
        await app.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
