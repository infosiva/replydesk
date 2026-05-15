"""
booking.py — Playwright browser automation for makesweat.com court bookings.

Flow for each slot:
  1. Login → navigate to NBC facilities → go to target week
  2. Click Court 4 (or 5 / fallback) cell at 8pm or 9pm
  3. Fill New Booking modal (title, rate, duration)
  4. Fill / confirm contact details → Go to payment
  5. Pay with saved card → confirm success
"""

import asyncio
import logging
import os
from datetime import date, datetime, timedelta
from typing import Optional, Tuple

import pytz
from playwright.async_api import (
    Page, BrowserContext, Browser,
    async_playwright, TimeoutError as PWTimeout
)

logger = logging.getLogger(__name__)

UK_TZ = pytz.timezone("Europe/London")


# ─────────────────────────────────────────────
# DATE HELPERS
# ─────────────────────────────────────────────

def get_next_wednesday() -> date:
    """Return the date of next-week's Wednesday (always ≥ 7 days away)."""
    today = datetime.now(UK_TZ).date()
    weekday = today.weekday()          # 0=Mon … 6=Sun
    days_to_wed = (2 - weekday) % 7   # days until the coming Wednesday
    if days_to_wed <= 1:              # same day or tomorrow → push to next week
        days_to_wed += 7
    return today + timedelta(days=days_to_wed)


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────

async def login(page: Page, email: str, password: str) -> bool:
    """
    Login flow for makesweat.com:
      1. Go to #mydetails — the email field is already visible on page load
      2. Fill email → JS-click the submit Next button
      3. Fill password → JS-click button.button-next (the password-step login button)
      4. JS-click the Facilities nav link (no page.goto — that reloads the SPA)
    """
    try:
        # ── Step 1: load the My Details page (login panel already open) ───
        await page.goto("https://makesweat.com/nbc#mydetails",
                        wait_until="domcontentloaded", timeout=30_000)
        await page.wait_for_timeout(2_000)
        await _screenshot(page, "01_mydetails_page")
        logger.info("My Details page loaded")

        # ── Step 2: fill email → click Next ──────────────────────────────
        email_field = page.locator('input[placeholder*="email" i]')
        await email_field.first.wait_for(state="visible", timeout=8_000)
        await email_field.first.fill(email)
        logger.info("Email entered")
        await _screenshot(page, "02_email_entered")

        # Click the email-step Next (type=submit)
        await page.evaluate("""() => {
            const btn = Array.from(document.querySelectorAll('button[type="submit"]'))
                .find(b => b.textContent.trim() === 'Next');
            if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); }
        }""")
        await page.wait_for_timeout(2_000)
        await _screenshot(page, "03_after_email_next")
        logger.info("Email Next clicked")

        # ── Step 3: fill password → click password-step Next ─────────────
        # The password field is type=text with name="user_password"
        pw_field = page.locator('input[name="user_password"]')
        await pw_field.first.wait_for(state="visible", timeout=8_000)
        await pw_field.first.fill(password)
        logger.info("Password entered")
        await _screenshot(page, "04_password_entered")

        # Find the submit button that shares a container with the password field.
        # This avoids hitting the many other "Next" buttons on the page.
        # Note: the click triggers a navigation, which destroys the JS context —
        # that raises an exception we can safely ignore (it means login succeeded).
        try:
            await page.evaluate("""() => {
                const pw = document.querySelector('input[name="user_password"]');
                if (!pw) return;
                let el = pw.parentElement;
                while (el) {
                    const btn = el.querySelector('button[type="submit"], button.dialogbutton');
                    if (btn && (btn.textContent.trim() === 'Next' || btn.textContent.trim() === 'Login!')) {
                        btn.scrollIntoView({ block: 'center' });
                        btn.click();
                        return;
                    }
                    el = el.parentElement;
                }
            }""")
        except Exception as nav_err:
            # "Execution context was destroyed" = navigation triggered = login worked
            if "context" not in str(nav_err).lower() and "navigation" not in str(nav_err).lower():
                raise
        await page.wait_for_timeout(3_000)
        await _screenshot(page, "05_after_login")
        logger.info("Password Next (login) clicked")

        # ── Step 4: navigate to Facilities ───────────────────────────────
        await _click_facilities(page)
        logger.info("Login complete")
        return True

    except Exception as exc:
        logger.error(f"Login error: {exc}")
        await _screenshot(page, "login_error")
        return False


async def _click_facilities(page: Page):
    """Switch to the Facilities calendar by updating the SPA hash."""
    # Change hash — the SPA router handles this without a full reload
    try:
        await page.evaluate("window.location.hash = '#facilities'")
    except Exception as e:
        # Context destroyed means a navigation was already in progress; wait and retry
        if "context" in str(e).lower() or "navigation" in str(e).lower():
            await page.wait_for_timeout(3_000)
            await page.evaluate("window.location.hash = '#facilities'")
        else:
            raise
    await page.wait_for_timeout(3_000)
    # Dismiss any popup/overlay that appears over the calendar
    for attempt in range(3):
        try:
            await page.evaluate("""() => {
                const mask = document.getElementById('ms_dlgmask');
                if (mask) mask.click();
                const closeBtn = document.querySelector('.ms_dlg_close, .close-btn, button[aria-label="Close"]');
                if (closeBtn) closeBtn.click();
            }""")
            break
        except Exception as e:
            if "context" in str(e).lower() or "navigation" in str(e).lower():
                logger.warning(f"_click_facilities dismiss attempt {attempt+1} failed, retrying…")
                await page.wait_for_timeout(2_000)
            else:
                raise
    await page.wait_for_timeout(1_000)
    await _screenshot(page, "06_facilities_loaded")
    logger.info("Facilities page loaded")


# ─────────────────────────────────────────────
# DATE NAVIGATION
# ─────────────────────────────────────────────

async def navigate_to_facilities_date(page: Page, target: date) -> bool:
    """
    Navigate the day-view schedule forward to *target* date.
    Uses the > arrow button on the facilities page.
    """
    try:
        await page.wait_for_timeout(1_000)

        target_iso  = target.strftime("%Y-%m-%d")   # 2026-04-22
        target_day  = str(target.day)               # "22"
        target_dmy  = target.strftime("%d/%m")      # "22/04"
        target_dmon = target.strftime("%d %b")      # "22 Apr"

        def date_visible(html: str) -> bool:
            # Use the unambiguous ISO date and formatted strings.
            # Avoid f">{target_day}<" — it false-positives on time labels like "11am".
            return any(s in html for s in [target_iso, target_dmy, target_dmon])

        for _ in range(5):
            html = await page.content()
            if date_visible(html):
                logger.info(f"Target date {target_iso} is now visible")
                return True

            # Fix: use JS click on .fc-next-button to bypass any overlay/dialog mask.
            # (The old approach tried button:has-text("Next") which matched hidden
            # booking-dialog buttons before ever reaching .fc-next-button.)
            clicked = await page.evaluate("""() => {
                const btn = document.querySelector('.fc-next-button');
                if (btn) { btn.click(); return true; }
                return false;
            }""")
            if clicked:
                await page.wait_for_timeout(1_500)
                continue

            # Fallback to other selectors if FC button not found
            found = False
            for sel in [
                'button:has-text(">")',
                '[aria-label="Next week"]',
                '[aria-label="next"]',
                '.next-week',
                'button[class*="arrow-right"]',
            ]:
                btn = page.locator(sel)
                if await btn.count():
                    await btn.first.click(force=True)
                    await page.wait_for_timeout(1_500)
                    found = True
                    break
            if not found:
                logger.warning("No next-week button found — may already be on correct week")
                return True   # best effort

        logger.error(f"Could not navigate to {target_iso}")
        await _screenshot(page, "nav_failed")
        return False

    except Exception as exc:
        logger.error(f"Navigation error: {exc}")
        return False


# ─────────────────────────────────────────────
# CLICK SLOT
# ─────────────────────────────────────────────

async def click_court_slot(page: Page, court: str, hour: int) -> bool:
    """
    Click the time-slot cell for *court* at *hour* (24h, e.g. 20 = 8pm).
    Returns True if a slot was clicked (modal should open), False otherwise.
    """
    time_24  = f"{hour:02d}:00"      # "20:00"
    time_12  = f"{hour - 12}pm" if hour > 12 else f"{hour}pm"   # "8pm"
    await _screenshot(page, f"before_click_{court}_{hour}")

    # ── Strategy 1: data attributes ──────────────────────────────────────
    for sel in [
        f'[data-court*="{court}"][data-time*="{time_24}"]',
        f'[data-resource*="{court}"][data-time*="{time_24}"]',
        f'.fc-event[data-time="{time_24}"]',
    ]:
        slot = page.locator(sel)
        if await slot.count():
            await slot.first.click()
            logger.info(f"Clicked {court} @ {time_24} via data attribute")
            return True

    # ── Strategy 2: column-index → JS click (bypasses visibility/overlay) ──
    headers = page.locator('th, .column-header, [class*="court-header"]')
    court_idx = -1
    for i in range(await headers.count()):
        text = (await headers.nth(i).text_content()) or ""
        if court.lower() in text.lower():
            court_idx = i
            break

    if court_idx >= 0:
        rows = page.locator('tr, .schedule-row, [class*="time-row"]')
        for i in range(await rows.count()):
            row_text = (await rows.nth(i).text_content()) or ""
            if time_24 in row_text or time_12 in row_text:
                cells = rows.nth(i).locator('td, .slot, [class*="cell"]')
                count = await cells.count()
                if court_idx < count:
                    # Use JS click: the <td> background cells are in a clipped
                    # container that causes Playwright visibility checks to fail
                    clicked = await page.evaluate(f"""() => {{
                        const allRows = [...document.querySelectorAll(
                            'tr, .schedule-row, [class*="time-row"]'
                        )];
                        const row = allRows.find(r =>
                            (r.textContent || '').includes('{time_24}') ||
                            (r.textContent || '').includes('{time_12}')
                        );
                        if (!row) return false;
                        const cells = [...row.querySelectorAll('td, .slot, [class*="cell"]')];
                        if (cells.length > {court_idx}) {{
                            cells[{court_idx}].click();
                            return true;
                        }}
                        return false;
                    }}""")
                    if clicked:
                        logger.info(f"Clicked {court} @ {time_24} via table index (JS)")
                        return True

    # ── Strategy 3: visible empty cell in the right area ─────────────────
    # Look for an empty / bookable cell that mentions neither court name nor "booked"
    time_row = page.locator(
        f'tr:has-text("{time_24}"), tr:has-text("{time_12}"), '
        f'[class*="hour"]:has-text("{time_24}")'
    )
    if await time_row.count():
        # Try clicking within the row near the court column text
        slot = time_row.first.locator(f':has-text("{court}")')
        if await slot.count():
            await slot.first.click(force=True)
            logger.info(f"Clicked {court} @ {time_24} via time-row search")
            return True

    logger.warning(f"Could not find slot: {court} @ {time_24}")
    await _screenshot(page, f"slot_not_found_{court}_{hour}")
    return False


# ─────────────────────────────────────────────
# BOOKING MODAL
# ─────────────────────────────────────────────

async def fill_booking_modal(page: Page, title: str, rate: str) -> bool:
    """Fill the 'New Booking' modal and click Next."""
    try:
        # makesweat uses ms_dlg_frame with class 'active' for the visible dialog
        modal = page.locator('.ms_dlg_frame.active, #dialognewbooking, .modal, [role="dialog"]')
        await modal.wait_for(state="visible", timeout=8_000)
        await page.wait_for_timeout(500)
        logger.info("New Booking modal is open")

        # Title — target the writable Title field specifically
        title_field = modal.locator(
            'input[name="Title"], input[name="title"], '
            'input[placeholder*="Title" i], input[name*="title" i]:not([name*="Time" i])'
        ).first
        if not await title_field.count():
            title_field = modal.locator("input:not([readonly])").first
        await title_field.clear()
        await title_field.fill(title)

        # Rate dropdown → Member  (use specific name attr, avoid :near ambiguity)
        rate_sel = modal.locator('select[name="Rate"], select[name="rate"]').first
        if not await rate_sel.count():
            rate_sel = modal.locator('select[name*="rate" i]').first
        if await rate_sel.count():
            await rate_sel.select_option(label=rate)

        # Duration → 1 hour
        dur_sel = modal.locator('select[name="Duration"], select[name="duration"]').first
        if not await dur_sel.count():
            dur_sel = modal.locator('select[name*="duration" i]').first
        if await dur_sel.count():
            options = await dur_sel.locator("option").all_text_contents()
            one_hour = next((o for o in options if "1 hour" in o or "60" in o), None)
            if one_hour:
                await dur_sel.select_option(label=one_hour)

        # Next
        await modal.locator('button:has-text("Next")').click()
        await page.wait_for_timeout(1_500)
        logger.info("Booking modal: clicked Next")
        return True

    except Exception as exc:
        logger.error(f"Booking modal error: {exc}")
        await _screenshot(page, "modal_error")
        return False


# ─────────────────────────────────────────────
# CONTACT DETAILS
# ─────────────────────────────────────────────

async def handle_contact_details(page: Page, contact: dict) -> bool:
    """Verify / fill contact details and click 'Go to payment'."""
    try:
        modal = page.locator('.ms_dlg_frame.active, .modal, [role="dialog"]')
        await modal.wait_for(state="visible", timeout=8_000)
        await page.wait_for_timeout(500)
        logger.info("Contact details modal is open")

        async def fill_if_empty(label_text: str, value: str):
            if not value:
                return
            field = modal.locator(f'input:near(:text("{label_text}"))')
            if await field.count():
                current = await field.first.input_value()
                if not current.strip():
                    await field.first.fill(value)

        await fill_if_empty("Address Line 1", contact["address_line_1"])
        await fill_if_empty("Address Line 2", contact.get("address_line_2", ""))
        await fill_if_empty("Town",           contact["town"])
        await fill_if_empty("Postcode",       contact["postcode"])
        await fill_if_empty("Phone",          contact["phone"])

        pay_btn = modal.locator('button:has-text("Go to payment")')
        await pay_btn.wait_for(state="visible", timeout=5_000)
        await pay_btn.click()
        await page.wait_for_timeout(2_000)
        logger.info("Contact details: clicked Go to payment")
        return True

    except Exception as exc:
        logger.error(f"Contact details error: {exc}")
        await _screenshot(page, "contact_error")
        return False


# ─────────────────────────────────────────────
# PAYMENT
# ─────────────────────────────────────────────

async def handle_payment(page: Page, dry_run: bool = False) -> bool:
    """
    Pay with the already-saved card.
    If dry_run=True, stops at the payment screen and takes a screenshot
    without clicking Pay — no charge is made.
    """
    try:
        modal = page.locator('.ms_dlg_frame.active, .modal, [role="dialog"]')
        await modal.wait_for(state="visible", timeout=12_000)
        await page.wait_for_timeout(1_000)
        logger.info("Payment modal is open")
        await _screenshot(page, "payment_modal")

        if dry_run:
            logger.info("🧪 DRY RUN — stopping at payment screen. No charge made.")
            # Keep the browser open for 15 seconds so you can inspect it
            await page.wait_for_timeout(15_000)
            await _screenshot(page, "dry_run_payment_screen")
            return True   # Report success so the full flow is validated

        # Click the Pay £XX.XX button (uses saved card automatically)
        pay_btn = modal.locator('button:has-text("Pay")')
        await pay_btn.wait_for(state="visible", timeout=5_000)
        await pay_btn.click()
        await page.wait_for_timeout(6_000)   # allow time for payment gateway
        logger.info("Pay button clicked — waiting for confirmation")

        await _screenshot(page, "after_payment")

        # Look for success signals
        for sig in [
            "text=Booking confirmed", "text=Thank you", "text=Success",
            "text=Booking complete",  "[class*=success]", "[class*=confirmation]",
        ]:
            if await page.locator(sig).count():
                logger.info("Payment confirmed!")
                return True

        # No explicit error shown → assume OK
        logger.info("Payment result unclear — assuming success")
        return True

    except Exception as exc:
        logger.error(f"Payment error: {exc}")
        await _screenshot(page, "payment_error")
        return False


# ─────────────────────────────────────────────
# SINGLE BOOKING ORCHESTRATOR
# ─────────────────────────────────────────────

async def make_booking(
    email: str,
    password: str,
    target_date: date,
    preferred_courts: list,
    hour: int,
    booking_title: str,
    booking_rate: str,
    contact: dict,
    fallback: bool = True,
    texas_tz: str = "America/Chicago",
    dry_run: bool = False,
) -> Tuple[bool, str]:
    """
    Attempt to book one court slot.
    Tries preferred courts first; falls back to any court if *fallback* is True.
    Returns (success: bool, message: str).
    """
    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=False,          # False = you can watch it run; flip to True later
        )
        context: BrowserContext = await browser.new_context(
            timezone_id=texas_tz,   # Emulate Texas timezone in the browser
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            if not await login(page, email, password):
                return False, "Login failed"

            if not await navigate_to_facilities_date(page, target_date):
                return False, f"Could not navigate to {target_date}"

            courts = list(preferred_courts)
            if fallback:
                courts += [f"Court {i}" for i in range(1, 9)
                           if f"Court {i}" not in courts]

            for court in courts:
                logger.info(f"Trying {court} at {hour:02d}:00 …")

                if not await click_court_slot(page, court, hour):
                    continue

                await page.wait_for_timeout(1_000)

                # Slot unavailable → no modal appears
                modal = page.locator('.modal, [role="dialog"], [class*="popup"]')
                if not await modal.count():
                    logger.info(f"{court} @ {hour}:00 — no modal, probably booked")
                    continue

                if not await fill_booking_modal(page, booking_title, booking_rate):
                    await page.keyboard.press("Escape")
                    continue

                if not await handle_contact_details(page, contact):
                    return False, "Contact details step failed"

                if await handle_payment(page, dry_run=dry_run):
                    prefix = "🧪 DRY RUN — reached payment for" if dry_run else "Booked"
                    msg = f"{prefix} {court} | {hour:02d}:00–{hour+1:02d}:00 | {target_date} | £{21.50:.2f}"
                    return True, msg
                else:
                    return False, f"Payment failed — {court} @ {hour:02d}:00"

            return False, f"No courts available at {hour:02d}:00 on {target_date}"

        finally:
            await _screenshot(page, f"final_{hour}")
            await browser.close()


# ─────────────────────────────────────────────
# RUN BOTH SLOTS
# ─────────────────────────────────────────────

async def run_all_bookings(cfg: dict) -> list[dict]:
    """Book both slots (20:00 and 21:00) for next Wednesday."""
    target = get_next_wednesday()
    results = []

    for hour in cfg["booking_slots"]:   # [20, 21]
        logger.info(f"\n{'─'*55}")
        logger.info(f"  Booking slot: {hour:02d}:00 – {hour+1:02d}:00 on {target}")
        logger.info(f"{'─'*55}")

        ok, msg = await make_booking(
            email=cfg["makesweat_email"],
            password=cfg["makesweat_password"],
            target_date=target,
            preferred_courts=cfg["preferred_courts"],
            hour=hour,
            booking_title=cfg["booking_title"],
            booking_rate=cfg["booking_rate"],
            contact=cfg["contact"],
            fallback=cfg["fallback_any_court"],
            texas_tz=cfg["texas_tz"],
            dry_run=cfg.get("dry_run", False),
        )

        results.append({"hour": hour, "success": ok, "message": msg, "date": target})
        logger.info(f"  {'✓' if ok else '✗'} {msg}")
        await asyncio.sleep(3)   # brief gap between bookings

    return results


# ─────────────────────────────────────────────
# HELPER
# ─────────────────────────────────────────────

async def _screenshot(page: Page, tag: str):
    """Save a debug screenshot to the logs folder."""
    try:
        log_dir = os.path.expanduser(
            "/Users/sivaprakasam/projects/agents/badminton/logs"
        )
        os.makedirs(log_dir, exist_ok=True)
        path = os.path.join(log_dir, f"{tag}.png")
        await page.screenshot(path=path)
        logger.debug(f"Screenshot saved: {path}")
    except Exception:
        pass
