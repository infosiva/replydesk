"""
saturday_test.py — Test script for Saturday 2026-04-11 booking.

Phase 1: Login + navigate to Saturday, dump calendar HTML for DOM inspection.
Phase 2: Find & click first available (green) slot near 7pm on Court 4, then
         run the full booking flow (dry_run=True — stops at payment, no charge).
"""

import asyncio
import json
import os
import sys
from datetime import date

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

# ── Import existing helpers ───────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from booking import (
    login,
    _click_facilities,
    navigate_to_facilities_date,
    fill_booking_modal,
    handle_contact_details,
    handle_payment,
    _screenshot,
)
import config as cfg

# ── Constants ─────────────────────────────────────────────────────────────────
TARGET_DATE = date(2026, 4, 11)          # Saturday
LOG_DIR = cfg.LOG_DIR
CONTACT = cfg.CONTACT


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — dump calendar HTML so we can inspect the actual CSS selectors
# ─────────────────────────────────────────────────────────────────────────────

async def dump_calendar_html(page: Page):
    """Save the calendar table HTML to logs/calendar_dump.html."""
    os.makedirs(LOG_DIR, exist_ok=True)
    out = os.path.join(LOG_DIR, "calendar_dump.html")

    html = await page.evaluate("""() => {
        // Try to grab the facilities calendar container
        const candidates = [
            document.querySelector('.fc-view-container'),
            document.querySelector('.fc-view'),
            document.querySelector('[class*="schedule"]'),
            document.querySelector('[class*="calendar"]'),
            document.querySelector('table'),
        ];
        for (const el of candidates) {
            if (el) return el.outerHTML;
        }
        return document.body.innerHTML;
    }""")

    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[dump] Calendar HTML saved → {out}  ({len(html):,} chars)")
    return html


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — inspect cell colours and find the right JS selector
# ─────────────────────────────────────────────────────────────────────────────

async def inspect_cell_colours(page: Page) -> dict:
    """
    Walk every <td> in the calendar, collect (bg-color, className, text) and
    return a summary so we can choose the right selector.
    """
    info = await page.evaluate("""() => {
        const tds = [...document.querySelectorAll('td')];
        const results = [];
        for (const td of tds) {
            const style = window.getComputedStyle(td);
            const bg = style.backgroundColor;
            const cls = td.className || '';
            const txt = (td.textContent || '').trim().substring(0, 60);
            // Only collect cells that seem to be slots (not plain white/transparent)
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)') {
                results.push({ bg, cls, txt: txt || '(empty)' });
            }
        }
        // Unique background colours seen
        const colors = [...new Set(results.map(r => r.bg))];
        return { sample: results.slice(0, 40), colors };
    }""")

    out_path = os.path.join(LOG_DIR, "cell_colors.json")
    with open(out_path, "w") as f:
        json.dump(info, f, indent=2)
    print(f"[inspect] Unique bg colours in <td>: {info['colors']}")
    print(f"[inspect] Full colour data → {out_path}")
    return info


# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — click the first available (green / bookable) slot near 7pm Court 4
# ─────────────────────────────────────────────────────────────────────────────

async def click_first_available_slot(page: Page) -> bool:
    """
    Find and click the first available (freebooking) slot near 7pm on Court 4.

    DOM facts (from inspection of calendar_dump.html):
    - Available slots: <a class="... freebooking ...">
    - Time embedded inside: <div class="fc-time" data-start="7:00" data-full="7:00 PM - 8:00 PM">
    - Court 4 header: <th data-resource-id="322">
    - The freebooking <a> elements live inside <td> cells of the content-skeleton
      table whose column order matches the resource-header order.

    Priority:
      1. Court 4 @ 7pm (data-start="7:00", data-full contains "PM")
      2. Court 4 @ 8pm
      3. Any court @ 7pm
      4. Any court @ 8pm
      5. First freebooking anywhere
    """
    await _screenshot(page, "sat_01_before_click")
    print("[click] Screenshot saved: sat_01_before_click")

    clicked = await page.evaluate("""() => {
        // ── Helpers ───────────────────────────────────────────────────────

        // Get the 0-based column index of Court 4 among fc-resource-cell headers
        function getCourt4ColIdx() {
            const hdrs = [...document.querySelectorAll('th.fc-resource-cell')];
            const idx = hdrs.findIndex(h =>
                h.getAttribute('data-resource-id') === '322' ||
                (h.textContent || '').trim() === 'Court 4'
            );
            return idx;   // -1 if not found
        }

        // Find freebooking <a> elements whose inner .fc-time matches the given times
        // data-start is in 12h format without leading zero ("7:00" for 7pm, "8:00" for 8pm etc.)
        function findFreeBookings(dataStart, pmOnly) {
            const all = [...document.querySelectorAll('a.freebooking')];
            return all.filter(a => {
                const timeEl = a.querySelector('.fc-time');
                if (!timeEl) return false;
                const start = timeEl.getAttribute('data-start') || '';
                const full  = timeEl.getAttribute('data-full')  || '';
                const matchStart = !dataStart || start === dataStart;
                const matchPM    = !pmOnly    || full.includes('PM');
                return matchStart && matchPM;
            });
        }

        // Get the column index (among all <td> siblings) of the <td> that
        // contains this element (walking up to find a <td> ancestor in a <tr>)
        function colIdxOf(el) {
            let td = el;
            while (td && td.tagName !== 'TD') td = td.parentElement;
            if (!td) return -1;
            const tr = td.parentElement;
            if (!tr) return -1;
            return [...tr.children].indexOf(td);
        }

        // Attempt to click a freebooking that is inside the Court 4 column
        function clickInCol(bookings, court4Idx) {
            for (const a of bookings) {
                if (court4Idx < 0 || colIdxOf(a) === court4Idx) {
                    a.scrollIntoView({ block: 'center' });
                    a.click();
                    const timeEl = a.querySelector('.fc-time');
                    const fullTime = timeEl ? timeEl.getAttribute('data-full') : '?';
                    return { clicked: true, col: colIdxOf(a), time: fullTime };
                }
            }
            return null;
        }

        const court4Idx = getCourt4ColIdx();

        // The freebooking <a> elements live inside the content-skeleton <td>,
        // which has one extra axis <td> prepended compared to fc-resource-cell headers.
        // So Court 4 header index=4 maps to content td index=5.
        const court4ContentIdx = court4Idx >= 0 ? court4Idx + 1 : -1;

        // 1. Court 4 @ 7pm
        let res = clickInCol(findFreeBookings('7:00', true), court4ContentIdx);
        if (res) return { ...res, reason: 'Court 4 @ 7pm' };

        // 2. Court 4 @ 8pm
        res = clickInCol(findFreeBookings('8:00', true), court4ContentIdx);
        if (res) return { ...res, reason: 'Court 4 @ 8pm' };

        // 3. Any court @ 7pm
        const any7pm = findFreeBookings('7:00', true);
        if (any7pm.length > 0) {
            any7pm[0].scrollIntoView({ block: 'center' });
            any7pm[0].click();
            return { clicked: true, reason: 'any court @ 7pm', col: colIdxOf(any7pm[0]) };
        }

        // 4. Any court @ 8pm
        const any8pm = findFreeBookings('8:00', true);
        if (any8pm.length > 0) {
            any8pm[0].scrollIntoView({ block: 'center' });
            any8pm[0].click();
            return { clicked: true, reason: 'any court @ 8pm', col: colIdxOf(any8pm[0]) };
        }

        // 5. First freebooking anywhere
        const anyFree = findFreeBookings(null, false);
        if (anyFree.length > 0) {
            anyFree[0].scrollIntoView({ block: 'center' });
            anyFree[0].click();
            const timeEl = anyFree[0].querySelector('.fc-time');
            return {
                clicked: true,
                reason: 'first freebooking anywhere',
                col: colIdxOf(anyFree[0]),
                time: timeEl ? timeEl.getAttribute('data-full') : '?',
                totalFree: anyFree.length,
            };
        }

        return { clicked: false, reason: 'no freebooking elements found' };
    }""")

    print(f"[click] JS result: {clicked}")

    if not clicked.get("clicked"):
        # Dump additional colour info to help diagnose
        await inspect_cell_colours(page)
        await _screenshot(page, "sat_click_failed")
        print("[click] FAILED — check logs/cell_colors.json and logs/calendar_dump.html")
        return False

    print(f"[click] Clicked slot: {clicked.get('reason', '?')} col={clicked.get('col', '?')}")
    await page.wait_for_timeout(2_000)
    await _screenshot(page, "sat_02_after_click")
    print("[click] Screenshot saved: sat_02_after_click")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"\n{'='*60}")
    print(f"  Saturday booking test — {TARGET_DATE}")
    print(f"  Timezone: America/Chicago  |  dry_run=True")
    print(f"{'='*60}\n")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(
            timezone_id="America/Chicago",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        try:
            # ── 1. Login ──────────────────────────────────────────────────
            print("[main] Step 1: login …")
            ok = await login(page, cfg.MAKESWEAT_EMAIL, cfg.MAKESWEAT_PASSWORD)
            if not ok:
                print("[main] FAILED: login")
                return

            # ── 2. Facilities ─────────────────────────────────────────────
            print("[main] Step 2: click facilities …")
            await _click_facilities(page)

            # ── 3. Navigate to Saturday ───────────────────────────────────
            print(f"[main] Step 3: navigate to {TARGET_DATE} …")
            ok = await navigate_to_facilities_date(page, TARGET_DATE)
            if not ok:
                print("[main] FAILED: navigation")
                return

            # ── 4a. Dump HTML for inspection ──────────────────────────────
            print("[main] Step 4a: dumping calendar HTML …")
            await dump_calendar_html(page)

            # ── 4b. Inspect cell colours ──────────────────────────────────
            print("[main] Step 4b: inspecting cell colours …")
            await inspect_cell_colours(page)

            # ── 5. Find and click first available green slot ──────────────
            print("[main] Step 5: finding and clicking available slot …")
            ok = await click_first_available_slot(page)
            if not ok:
                print("[main] FAILED: no available slot found")
                print("       See logs/calendar_dump.html + logs/cell_colors.json")
                await page.wait_for_timeout(10_000)   # pause for manual inspection
                return

            # ── 6. Wait for modal and discover its selector ───────────────
            print("[main] Step 6: waiting for booking modal …")
            await page.wait_for_timeout(2_000)

            # Discover actual modal/dialog selectors used by makesweat
            modal_info = await page.evaluate("""() => {
                const candidates = [
                    ...document.querySelectorAll(
                        '.modal, [role="dialog"], [class*="popup"], [class*="dlg"], ' +
                        '[class*="dialog"], [id*="dialog"], [id*="booking"], ' +
                        '.ui-dialog, .ms_dlg, [class*="overlay"]'
                    )
                ].filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 100 && r.height > 100;
                });
                return candidates.map(el => ({
                    tag: el.tagName,
                    id: el.id || '',
                    cls: el.className || '',
                    visible: el.offsetParent !== null,
                    w: Math.round(el.getBoundingClientRect().width),
                    h: Math.round(el.getBoundingClientRect().height),
                }));
            }""")
            print(f"[main] Visible dialog-like elements: {modal_info}")

            await _screenshot(page, "sat_03_booking_modal")
            print("[main] Screenshot saved: sat_03_booking_modal")

            # ── 7. Fill booking modal ─────────────────────────────────────
            print("[main] Step 7: filling booking modal …")
            ok = await fill_booking_modal(page, title="Badminton MK", rate="Member")
            if not ok:
                print("[main] FAILED: fill_booking_modal")
                return

            await _screenshot(page, "sat_04_after_modal_next")

            # ── 8. Contact details ────────────────────────────────────────
            print("[main] Step 8: handling contact details …")
            ok = await handle_contact_details(page, CONTACT)
            if not ok:
                print("[main] FAILED: handle_contact_details")
                return

            await _screenshot(page, "sat_05_after_contact")

            # ── 9. Payment (dry run) ──────────────────────────────────────
            print("[main] Step 9: payment screen (dry_run=True — will NOT charge) …")
            ok = await handle_payment(page, dry_run=True)

            await _screenshot(page, "sat_06_final")
            if ok:
                print("\n[main] SUCCESS — reached payment screen without errors.")
                print("       No charge was made (dry_run=True).")
            else:
                print("\n[main] FAILED at payment step.")

        except Exception as exc:
            print(f"[main] UNEXPECTED ERROR: {exc}")
            await _screenshot(page, "sat_unexpected_error")
            raise
        finally:
            print(f"\n[main] Screenshots in: {LOG_DIR}")
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
