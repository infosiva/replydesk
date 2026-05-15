"""
get_chat_id.py — One-time helper to find your Telegram chat ID.

Steps:
  1. Run:  python3 get_chat_id.py
  2. Open Telegram → send ANY message to your bot (e.g. "hello")
  3. Script prints your chat ID
  4. Copy it into config.py → TELEGRAM_CHAT_ID
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import config

from telegram import Bot
from telegram.error import TimedOut


async def main():
    bot = Bot(token=config.TELEGRAM_BOT_TOKEN)

    # Verify connection
    me = await bot.get_me()
    print(f"✅ Connected to bot: @{me.username}")
    print()
    print("➡️  Now open Telegram, find your bot, and send it any message (e.g. 'hello')")
    print("   Waiting up to 60 seconds …")
    print()

    offset = None
    for attempt in range(20):          # 20 × 3 sec = 60 sec total
        await asyncio.sleep(3)
        try:
            updates = await bot.get_updates(
                offset=offset,
                timeout=2,             # short poll — returns immediately
                read_timeout=5,
                write_timeout=5,
                connect_timeout=5,
            )
        except TimedOut:
            continue                   # no updates yet, keep waiting

        for u in updates:
            offset = u.update_id + 1
            if u.message:
                chat_id = u.message.chat.id
                name    = u.message.chat.first_name or u.message.chat.username or "you"
                print(f"🎉 Found your chat ID: {chat_id}  (message from: {name})")
                print()
                print(f'   Paste this into config.py:')
                print(f'   TELEGRAM_CHAT_ID = "{chat_id}"')
                return

    print("⏰ Timed out — make sure you sent a message to your bot in Telegram.")


if __name__ == "__main__":
    asyncio.run(main())
