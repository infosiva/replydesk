"""
dry_run_test.py — Dry-run test for Saturday 2026-04-11 at 19:00 on Court 4.
All selectors are now fixed directly in booking.py.
Run with:  python3 dry_run_test.py
"""

import asyncio
import logging
import sys
from datetime import date

import config
from booking import make_booking

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            "/Users/sivaprakasam/projects/agents/badminton/logs/dry_run_test.log",
            mode="w",
        ),
    ],
)
logger = logging.getLogger(__name__)


async def run_test():
    logger.info("=" * 60)
    logger.info("  DRY-RUN TEST — Court 4 | 19:00 | 2026-04-11 (Saturday)")
    logger.info("=" * 60)

    ok, msg = await make_booking(
        email=config.MAKESWEAT_EMAIL,
        password=config.MAKESWEAT_PASSWORD,
        target_date=date(2026, 4, 11),   # this Saturday
        preferred_courts=["Court 4"],
        hour=19,                          # 7 PM
        booking_title=config.BOOKING_TITLE,
        booking_rate=config.BOOKING_RATE,
        contact=config.CONTACT,
        fallback=False,                   # Court 4 only
        texas_tz=config.TEXAS_TZ,
        dry_run=True,                     # NEVER clicks Pay
    )

    logger.info("=" * 60)
    logger.info(f"  Result : {'SUCCESS' if ok else 'FAILED'}")
    logger.info(f"  Message: {msg}")
    logger.info("=" * 60)

    print("\n" + "=" * 60)
    print(f"  {'SUCCESS' if ok else 'FAILED'}: {msg}")
    print("=" * 60)
    print("\nScreenshots saved to: logs/")
    return ok


if __name__ == "__main__":
    asyncio.run(run_test())
