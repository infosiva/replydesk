"""
One-shot test: run make_booking() for Saturday 2026-04-11, 7pm, Court 4, dry_run=True.
Usage: python test_booking.py
"""
import asyncio
import logging
from datetime import date

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)

import config
from booking import make_booking

async def main():
    ok, msg = await make_booking(
        email=config.MAKESWEAT_EMAIL,
        password=config.MAKESWEAT_PASSWORD,
        target_date=date(2026, 4, 11),
        preferred_courts=["Court 4"],
        hour=19,
        booking_title=config.BOOKING_TITLE,
        booking_rate=config.BOOKING_RATE,
        contact=config.CONTACT,
        fallback=False,
        texas_tz=config.TEXAS_TZ,
        dry_run=True,
    )
    print(f"\nResult: {'SUCCESS' if ok else 'FAILURE'}")
    print(f"Message: {msg}")

if __name__ == "__main__":
    asyncio.run(main())
