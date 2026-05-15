"""
full_flow_test.py — Standalone full booking flow test for makesweat.com/nbc.

Steps:
  1. Launch browser (America/Chicago timezone, visible)
  2. Login via #mydetails
  3. Navigate to Facilities calendar
  4. Navigate to Saturday 2026-04-11
  5. Find first available green slot (a.freebooking) on Court 4 → Court 5 → any court
  6. Click the slot
  7. Fill New Booking modal (Title="Badminton MK", Rate=Member, Duration=1hr)
  8. Screenshot modal_filled.png
  9. Click Next → contact details dialog → click Go to payment
 10. Wait 20s on payment screen → screenshot payment_screen.png
 11. DO NOT click Pay — print summary and close
"""

import asyncio
import sys
from datetime import date
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PWTimeout

# Pull credentials/settings from config.py
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    MAKESWEAT_EMAIL,
    MAKESWEAT_PASSWORD,
    BOOKING_TITLE,
    BOOKING_RATE,
    TEXAS_TZ,
)

SCRIPT_DIR   = Path(__file__).parent
TARGET_DATE  = date(2026, 4, 11)          # Saturday
COURTS_ORDER = ["Court 4", "Court 5"] + [f"Court {i}" for i in range(1, 9)
                                          if i not in (4, 5)]


# ─────────────────────────────────────────────────────────────────────────────
async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=30)
        context = await browser.new_context(
            timezone_id=TEXAS_TZ,
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        # ── 1. Login ──────────────────────────────────────────────────────
        print("\n[1] Logging in …")
        await page.goto(
            "https://makesweat.com/nbc#mydetails",
            wait_until="domcontentloaded",
            timeout=30_000,
        )
        await page.wait_for_timeout(2_000)

        # Email step
        email_field = page.locator('input[placeholder*="email" i]')
        await email_field.first.wait_for(state="visible", timeout=10_000)
        await email_field.first.fill(MAKESWEAT_EMAIL)
        await page.evaluate("""() => {
            const btn = [...document.querySelectorAll('button[type="submit"]')]
                .find(b => b.textContent.trim() === 'Next');
            if (btn) { btn.scrollIntoView({block:'center'}); btn.click(); }
        }""")
        await page.wait_for_timeout(2_000)

        # Password step
        pw_field = page.locator('input[name="user_password"]')
        await pw_field.first.wait_for(state="visible", timeout=10_000)
        await pw_field.first.fill(MAKESWEAT_PASSWORD)
        try:
            await page.evaluate("""() => {
                const pw = document.querySelector('input[name="user_password"]');
                if (!pw) return;
                let el = pw.parentElement;
                while (el) {
                    const btn = el.querySelector('button[type="submit"], button.dialogbutton');
                    if (btn && (btn.textContent.trim() === 'Next' ||
                                btn.textContent.trim() === 'Login!')) {
                        btn.scrollIntoView({block:'center'});
                        btn.click();
                        return;
                    }
                    el = el.parentElement;
                }
            }""")
        except Exception as e:
            if "context" not in str(e).lower() and "navigation" not in str(e).lower():
                raise
        await page.wait_for_timeout(3_000)
        print("    Login complete")

        # ── 2. Navigate to Facilities ─────────────────────────────────────
        print("\n[2] Opening Facilities calendar …")
        try:
            await page.evaluate("window.location.hash = '#facilities'")
        except Exception as e:
            if "context" in str(e).lower() or "navigation" in str(e).lower():
                await page.wait_for_timeout(3_000)
                await page.evaluate("window.location.hash = '#facilities'")
            else:
                raise
        await page.wait_for_timeout(3_000)

        # Dismiss any overlay/popup that may cover the calendar
        for _ in range(3):
            try:
                await page.evaluate("""() => {
                    const mask = document.getElementById('ms_dlgmask');
                    if (mask) mask.click();
                    const btn = document.querySelector('.ms_dlg_close, .close-btn');
                    if (btn) btn.click();
                }""")
                break
            except Exception as e:
                if "context" in str(e).lower() or "navigation" in str(e).lower():
                    await page.wait_for_timeout(2_000)
                else:
                    raise
        await page.wait_for_timeout(1_000)
        print("    Facilities loaded")

        # ── 3. Navigate to Saturday 2026-04-11 ───────────────────────────
        print(f"\n[3] Navigating to {TARGET_DATE} (Saturday) …")
        target_iso  = TARGET_DATE.strftime("%Y-%m-%d")   # 2026-04-11
        target_dmy  = TARGET_DATE.strftime("%d/%m")       # 11/04
        target_dmon = TARGET_DATE.strftime("%d %b")       # 11 Apr

        def date_visible(html: str) -> bool:
            return any(s in html for s in [target_iso, target_dmy, target_dmon])

        for attempt in range(14):
            html = await page.content()
            if date_visible(html):
                print(f"    Target date visible (attempt {attempt})")
                break
            clicked = await page.evaluate("""() => {
                const btn = document.querySelector('.fc-next-button');
                if (btn) { btn.click(); return true; }
                return false;
            }""")
            if not clicked:
                print("    WARNING: no fc-next-button found")
                break
            await page.wait_for_timeout(1_500)
        else:
            print("    WARNING: could not confirm date after 14 clicks — continuing anyway")

        # ── 4. Find an available slot on Court 4 / Court 5 / any court ───
        print("\n[4] Searching for a free slot (a.freebooking) …")

        booking_info = None

        for court_name in COURTS_ORDER:
            print(f"    Trying {court_name} …")

            # The a.freebooking elements are absolutely positioned by FullCalendar.
            # Their parent td has NO data-resource-id.
            # Strategy: match by horizontal pixel position against the court header rect.
            # For each a.freebooking where data-full contains "7:00 PM", check that its
            # horizontal centre falls within the court header's left/right bounds.
            result = await page.evaluate(f"""() => {{
                const courtName = '{court_name}';

                // Find the court header and its bounding rect
                const headers = [...document.querySelectorAll('th.fc-resource-cell')];
                const hdr = headers.find(h => h.textContent.trim() === courtName);
                if (!hdr) return null;

                const hRect = hdr.getBoundingClientRect();
                const hLeft  = hRect.left;
                const hRight = hRect.right;

                // Walk all freebooking links; find 7pm ones in this court column
                const allFb = [...document.querySelectorAll('a.freebooking')];
                for (const fb of allFb) {{
                    const timeDiv = fb.querySelector('.fc-time');
                    if (!timeDiv) continue;
                    const fullTime = (timeDiv.getAttribute('data-full') || '').trim();
                    // Must START at 7:00 PM (not end at 7:00 PM)
                    if (!fullTime.startsWith('7:00 PM')) continue;

                    // Check horizontal overlap with this court's header column
                    const fbRect = fb.getBoundingClientRect();
                    const fbCx = (fbRect.left + fbRect.right) / 2;
                    if (fbCx >= hLeft && fbCx <= hRight) {{
                        return {{
                            found: true,
                            timeStr:  (timeDiv.getAttribute('data-start') || '').trim(),
                            fullTime: fullTime,
                        }};
                    }}
                }}
                return null;
            }}""")

            if not result or not result.get("found"):
                print(f"      No 7pm (7:00 PM) free slot on {court_name}")
                continue

            time_label = result.get("fullTime") or "7:00 PM - 8:00 PM"
            print(f"      Free 7pm slot found: {court_name} @ {time_label}")

            # Click via JS using the same position-matching logic
            court_name_js = court_name.replace("'", "\\'")
            clicked = await page.evaluate(f"""() => {{
                const courtName = '{court_name_js}';
                const headers = [...document.querySelectorAll('th.fc-resource-cell')];
                const hdr = headers.find(h => h.textContent.trim() === courtName);
                if (!hdr) return false;

                const hRect = hdr.getBoundingClientRect();
                const hLeft  = hRect.left;
                const hRight = hRect.right;

                const allFb = [...document.querySelectorAll('a.freebooking')];
                for (const fb of allFb) {{
                    const timeDiv = fb.querySelector('.fc-time');
                    if (!timeDiv) continue;
                    const fullTime = (timeDiv.getAttribute('data-full') || '').trim();
                    if (!fullTime.startsWith('7:00 PM')) continue;

                    const fbRect = fb.getBoundingClientRect();
                    const fbCx = (fbRect.left + fbRect.right) / 2;
                    if (fbCx >= hLeft && fbCx <= hRight) {{
                        fb.click();
                        return true;
                    }}
                }}
                return false;
            }}""")

            if clicked:
                booking_info = {
                    "court": court_name,
                    "time":  time_label,
                    "date":  TARGET_DATE.strftime("%A %d %B %Y"),
                }
                print(f"      Clicked 7pm slot on {court_name}")
                break
            else:
                print(f"      Could not click 7pm slot on {court_name}, trying next …")

        if not booking_info:
            print("\nERROR: No free slots found on any court — exiting.")
            await page.screenshot(path=str(SCRIPT_DIR / "debug_no_slots.png"))
            await browser.close()
            return

        await page.wait_for_timeout(1_500)

        # ── 5. Fill the New Booking modal ─────────────────────────────────
        print("\n[5] Filling New Booking modal …")
        modal = page.locator('.ms_dlg_frame.active, #dialognewbooking')
        await modal.wait_for(state="visible", timeout=10_000)
        await page.wait_for_timeout(500)

        # Title — clear then fill character by character via fill()
        title_field = modal.locator('input[name="Title"]').first
        await title_field.wait_for(state="visible", timeout=5_000)
        await title_field.clear()
        await title_field.fill(BOOKING_TITLE)
        print(f"    Title: {BOOKING_TITLE}")

        # Rate → Member
        rate_sel = modal.locator('select[name="Rate"]').first
        if await rate_sel.count():
            await rate_sel.select_option(label=BOOKING_RATE)
            print(f"    Rate: {BOOKING_RATE}")

        # Duration → 1 hour
        dur_sel = modal.locator('select[name="Duration"]').first
        if await dur_sel.count():
            options = await dur_sel.locator("option").all_text_contents()
            one_hour = next(
                (o for o in options if "1 hour" in o.lower() or o.strip() == "60"),
                None,
            )
            if one_hour:
                await dur_sel.select_option(label=one_hour)
                print(f"    Duration: {one_hour}")
            else:
                print(f"    Duration options: {options}")

        await page.wait_for_timeout(1_000)

        # Verify modal shows 7pm — check the StartTime input value
        start_time_val = await page.evaluate("""() => {
            const inp = document.querySelector('.ms_dlg_frame.active input[name="StartTime"],\
                                                #dialognewbooking input[name="StartTime"]');
            return inp ? inp.value : '';
        }""")
        print(f"    StartTime input value: {start_time_val!r}")
        time_ok = (
            "7:00pm" in start_time_val.lower() or
            "7:00 pm" in start_time_val.lower() or
            "19:00" in start_time_val or
            "07:00pm" in start_time_val.lower() or
            start_time_val.strip().startswith("7:")
        )
        if not time_ok:
            print(f"    ERROR: StartTime is {start_time_val!r} — expected 7pm, aborting!")
            await page.evaluate("""() => {
                const btn = document.querySelector('.ms_dlg_close, .ms_dlg_frame.active .close-btn');
                if (btn) btn.click();
            }""")
            await page.keyboard.press("Escape")
            await browser.close()
            return

        print(f"    7pm time confirmed: StartTime = {start_time_val!r}")

        # Screenshot: modal_filled.png
        modal_path = SCRIPT_DIR / "modal_filled.png"
        await page.screenshot(path=str(modal_path))
        print(f"    Screenshot saved: {modal_path}")

        # Click Next inside the modal via JS (button is stable but outside viewport)
        clicked_next = await page.evaluate("""() => {
            const modal = document.querySelector('.ms_dlg_frame.active, #dialognewbooking');
            if (!modal) return false;
            const btns = [...modal.querySelectorAll('button')];
            const btn = btns.find(b => b.textContent.trim() === 'Next');
            if (btn) { btn.click(); return true; }
            return false;
        }""")
        if not clicked_next:
            print("    WARNING: JS Next click failed, trying Playwright click with force=True …")
            next_btn = modal.locator('button:has-text("Next")')
            await next_btn.first.click(force=True)
        await page.wait_for_timeout(2_000)
        print("    Clicked Next")

        # ── 6. Contact details → Go to payment ───────────────────────────
        print("\n[6] Waiting for next dialog after Next …")
        await page.wait_for_timeout(3_000)

        # Debug: screenshot and check what dialog is active
        try:
            await page.screenshot(path=str(SCRIPT_DIR / "debug_after_next.png"), timeout=10_000)
        except Exception:
            pass  # font-load timeout is fine; we still check the dialog
        active_dlg = await page.evaluate("""() => {
            const dlg = document.querySelector('.ms_dlg_frame.active');
            return dlg ? dlg.id : null;
        }""")
        print(f"    Active dialog after Next: {active_dlg!r}")

        # Poll for an active dialog for up to 20s
        for _ in range(20):
            active_dlg = await page.evaluate("""() => {
                const dlg = document.querySelector('.ms_dlg_frame.active');
                return dlg ? dlg.id : null;
            }""")
            if active_dlg:
                break
            await page.wait_for_timeout(1_000)
        print(f"    Dialog found: {active_dlg!r}")

        if not active_dlg:
            await page.screenshot(path=str(SCRIPT_DIR / "debug_no_dialog.png"))
            print("    ERROR: No active dialog appeared — exiting")
            await browser.close()
            return

        contact_modal = page.locator('.ms_dlg_frame.active')

        # If it's the choose-pass dialog, click Continue to get to contact details
        if active_dlg == "dialogchoosepass":
            print("    Choose-pass dialog — clicking Continue …")
            cont_btn = contact_modal.locator(
                'button:has-text("Continue"), button:has-text("Next"), button:has-text("Select")'
            )
            if await cont_btn.count():
                await page.evaluate("""() => {
                    const dlg = document.querySelector('.ms_dlg_frame.active');
                    const btns = [...dlg.querySelectorAll('button')];
                    const btn = btns.find(b =>
                        ['Continue','Next','Select'].includes(b.textContent.trim())
                    );
                    if (btn) btn.click();
                }""")
                await page.wait_for_timeout(2_000)
            # Re-fetch active dialog
            contact_modal = page.locator('.ms_dlg_frame.active')

        pay_btn = contact_modal.locator('button:has-text("Go to payment")')
        # Wait up to 10s for the Go to payment button
        for _ in range(10):
            if await pay_btn.count():
                break
            await page.wait_for_timeout(1_000)
        await page.evaluate("""() => {
            const dlg = document.querySelector('.ms_dlg_frame.active');
            if (!dlg) return;
            const btns = [...dlg.querySelectorAll('button')];
            const btn = btns.find(b => b.textContent.includes('Go to payment'));
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(2_000)
        print("    Clicked Go to payment")

        # ── 7. Payment screen ─────────────────────────────────────────────
        print("\n[7] Payment screen loading …")
        payment_modal = page.locator('.ms_dlg_frame.active')
        await payment_modal.wait_for(state="visible", timeout=15_000)
        await page.wait_for_timeout(2_000)

        # Try to extract the Pay button text (contains cost)
        cost_text = "£21.50 (estimated)"
        try:
            pay_btn_loc = payment_modal.locator('button:has-text("Pay")')
            if await pay_btn_loc.count():
                cost_text = (await pay_btn_loc.first.text_content() or "").strip()
        except Exception:
            pass

        print(f"    Payment screen ready. Pay button text: {cost_text}")
        print("    Keeping browser open for 20 seconds (DO NOT CLICK PAY) …")
        await page.wait_for_timeout(20_000)

        # Screenshot: payment_screen.png
        payment_path = SCRIPT_DIR / "payment_screen.png"
        await page.screenshot(path=str(payment_path), timeout=60_000)
        print(f"    Screenshot saved: {payment_path}")

        # ── 8. Summary ────────────────────────────────────────────────────
        print("\n" + "=" * 55)
        print("  BOOKING SUMMARY  (DRY RUN — NOT PAID)")
        print("=" * 55)
        print(f"  Court : {booking_info['court']}")
        print(f"  Date  : {booking_info['date']}")
        print(f"  Time  : {booking_info['time']}")
        print(f"  Cost  : {cost_text}")
        print("=" * 55)
        print("  Closing browser.")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
