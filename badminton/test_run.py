"""
test_run.py — Runs the full booking flow RIGHT NOW (dry run).
Stops at the payment screen without clicking Pay. No charge made.
"""

import asyncio
import sys
from pathlib import Path
from datetime import date, timedelta
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)

sys.path.insert(0, str(Path(__file__).parent))
import config
import booking as bk

async def main():
    # Force dry run
    assert config.DRY_RUN, "DRY_RUN must be True in config.py before testing!"

    target = bk.get_next_wednesday()
    print(f"\n{'━'*55}")
    print(f"  🧪 DRY RUN — Badminton Booking Test")
    print(f"  Target date : {target.strftime('%A %d %B %Y')}")
    print(f"  Slots       : 8pm–9pm  and  9pm–10pm")
    print(f"  Courts      : Court 4 → Court 5 → any fallback")
    print(f"  Browser TZ  : Texas (America/Chicago)")
    print(f"  Will STOP   : at payment screen — no charge")
    print(f"{'━'*55}\n")

    cfg = {
        "makesweat_email":    config.MAKESWEAT_EMAIL,
        "makesweat_password": config.MAKESWEAT_PASSWORD,
        "preferred_courts":   config.PREFERRED_COURTS,
        "booking_slots":      config.BOOKING_SLOTS,
        "booking_title":      config.BOOKING_TITLE,
        "booking_rate":       config.BOOKING_RATE,
        "contact":            config.CONTACT,
        "fallback_any_court": config.FALLBACK_ANY_COURT,
        "texas_tz":           config.TEXAS_TZ,
        "dry_run":            True,
    }

    results = await bk.run_all_bookings(cfg)

    print(f"\n{'━'*55}")
    print("  Results:")
    for r in results:
        icon = "✅" if r["success"] else "❌"
        print(f"  {icon}  {r['hour']:02d}:00–{r['hour']+1:02d}:00 → {r['message']}")
    print(f"{'━'*55}\n")

if __name__ == "__main__":
    asyncio.run(main())
