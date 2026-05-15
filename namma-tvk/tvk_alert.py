"""
NammaTVK — TVK Election Alert Bot
==================================
Polls nammatamil.live/api/election-results every 15 minutes.
Sends a Telegram message to you whenever:
  1. TVK is leading (at every update while they lead)
  2. TVK crosses majority (special alert)
  3. Results are declared

Usage:
  python3 tvk_alert.py              # run the live alert loop
  python3 tvk_alert.py --dry-run   # test without sending Telegram messages
  python3 tvk_alert.py --test      # send one test message and exit

Credentials (from site-watchdog .env):
  TELEGRAM_BOT_TOKEN = 8775484402:AAENbyhSklH87U0FsXHjnYaXhapIETNPVyg
  TELEGRAM_CHAT_ID   = 8452559091
"""

import sys, json, time, requests
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

# ── Credentials ───────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = '8775484402:AAENbyhSklH87U0FsXHjnYaXhapIETNPVyg'
TELEGRAM_CHAT_ID   = '8452559091'
RESULTS_API        = 'https://nammatamil.live/api/election-results'

DRY_RUN  = '--dry-run' in sys.argv
TEST_MODE = '--test' in sys.argv

INTERVAL_MINUTES = 15   # how often to check
MAJORITY         = 118  # seats needed to win TN (234 total)

# ── Fetch results ─────────────────────────────────────────────────────────────

def fetch_results() -> dict | None:
    try:
        r = requests.get(RESULTS_API, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'[warn] fetch failed: {e}')
        return None

# ── Send Telegram message ─────────────────────────────────────────────────────

def send_telegram(text: str) -> bool:
    if DRY_RUN:
        print('\n[dry-run] Telegram message:')
        print('─' * 50)
        print(text)
        print('─' * 50)
        return True
    try:
        url  = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
        resp = requests.post(url, json={
            'chat_id':    TELEGRAM_CHAT_ID,
            'text':       text,
            'parse_mode': 'HTML',
        }, timeout=10)
        resp.raise_for_status()
        print('[telegram] Sent ✓')
        return True
    except Exception as e:
        print(f'[telegram] Failed: {e}')
        return False

# ── Build alert message ───────────────────────────────────────────────────────

def build_message(data: dict, alert_type: str) -> str:
    parties     = data.get('parties', {})
    phase       = data.get('phase', 'counting')
    total_seats = data.get('totalSeats', 234)
    now_ist     = datetime.now(IST).strftime('%H:%M IST')

    # Sort all parties by total seats
    ranked = sorted(
        [(p, d.get('won', 0), d.get('leading', 0)) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1] + x[2],
        reverse=True
    )

    tvk_data = parties.get('TVK', {})
    tvk_won     = tvk_data.get('won', 0)
    tvk_leading = tvk_data.get('leading', 0)
    tvk_total   = tvk_won + tvk_leading
    tvk_leader  = tvk_data.get('leader', 'Vijay Thalapathy')

    # Header based on alert type
    if alert_type == 'majority':
        header = f'🏆 <b>TVK HAS CROSSED MAJORITY!</b>\n{tvk_leader} wins Tamil Nadu 2026!'
    elif alert_type == 'declared_win':
        header = f'🎉 <b>TVK WINS TAMIL NADU 2026!</b>\n{tvk_leader} is the next Chief Minister!'
    elif alert_type == 'declared_loss':
        header = f'📊 <b>Results Declared</b> — TVK did not win'
    else:
        # Regular 15-min update while TVK leads
        rank = next((i+1 for i, (p,_,_) in enumerate(ranked) if p == 'TVK'), '?')
        header = f'🔴 <b>TVK LEADING</b> — Rank #{rank} · {now_ist}'

    # Build scoreboard
    lines = [header, '']
    lines.append(f'📊 <b>Live Seat Count</b> ({now_ist}):')

    emoji_map = {'TVK': '🟡', 'DMK': '🔴', 'AIADMK': '🟢', 'BJP': '🟠'}
    for i, (pname, won, leading) in enumerate(ranked):
        total   = won + leading
        emoji   = emoji_map.get(pname, '⚪')
        bar_len = min(int(total / total_seats * 15), 15)
        bar     = '█' * bar_len + '░' * (15 - bar_len)
        maj_tag = ' ← 🏆 MAJORITY' if total >= MAJORITY else ''
        bold_s  = '<b>' if pname == 'TVK' else ''
        bold_e  = '</b>' if pname == 'TVK' else ''
        lines.append(f'{emoji} {bold_s}{pname}: {total} seats{maj_tag}{bold_e}')
        lines.append(f'   {bar}  ({won} won · {leading} leading)')

    others = parties.get('Others', {})
    if others:
        ot = others.get('won', 0) + others.get('leading', 0)
        lines.append(f'⚪ Others: {ot} seats')

    lines.append('')
    lines.append(f'🗳️ Total: {total_seats} seats | Majority: {MAJORITY}')
    lines.append(f'📡 <a href="https://nammatamil.live/tn-election-2026">Live tracker</a>')

    return '\n'.join(lines)

# ── State tracker ─────────────────────────────────────────────────────────────

class AlertState:
    def __init__(self):
        self.last_data_hash    = None
        self.majority_alerted  = False
        self.declared_alerted  = False
        self.update_count      = 0

    def tvk_total(self, data: dict) -> int:
        tvk = data.get('parties', {}).get('TVK', {})
        return tvk.get('won', 0) + tvk.get('leading', 0)

    def tvk_is_leading(self, data: dict) -> bool:
        parties = data.get('parties', {})
        ranked = sorted(
            [(p, d.get('won', 0) + d.get('leading', 0)) for p, d in parties.items() if p != 'Others'],
            key=lambda x: x[1], reverse=True
        )
        return bool(ranked) and ranked[0][0] == 'TVK'

    def process(self, data: dict):
        phase     = data.get('phase', 'unknown')
        tvk_seats = self.tvk_total(data)
        is_leading = self.tvk_is_leading(data)
        data_hash  = json.dumps(data.get('parties', {}), sort_keys=True)
        self.update_count += 1

        print(f'  TVK: {tvk_seats} seats | Leading: {is_leading} | Phase: {phase}')

        # ── Results declared ──────────────────────────────────────────────
        if phase == 'declared' and not self.declared_alerted:
            self.declared_alerted = True
            alert_type = 'declared_win' if is_leading else 'declared_loss'
            msg = build_message(data, alert_type)
            send_telegram(msg)
            return True  # tell the loop to stop

        # ── TVK crosses majority ──────────────────────────────────────────
        if tvk_seats >= MAJORITY and not self.majority_alerted:
            self.majority_alerted = True
            msg = build_message(data, 'majority')
            send_telegram(msg)

        # ── TVK is leading — regular 15-min update ────────────────────────
        elif is_leading and data_hash != self.last_data_hash:
            msg = build_message(data, 'update')
            send_telegram(msg)

        elif not is_leading:
            now_ist = datetime.now(IST).strftime('%H:%M IST')
            print(f'  [skip] TVK not leading at {now_ist} — no alert sent')

        self.last_data_hash = data_hash
        return False  # continue loop

# ── Main loop ─────────────────────────────────────────────────────────────────

def run_loop():
    print(f'\n=== TVK Election Alert Bot ===')
    print(f'Checking every {INTERVAL_MINUTES} min — alerts only when TVK leads')
    print(f'Telegram → chat {TELEGRAM_CHAT_ID}')
    print('Press Ctrl+C to stop\n')

    state = AlertState()

    # Send startup message
    send_telegram(
        '🤖 <b>TVK Alert Bot started</b>\n'
        f'Monitoring nammatamil.live every {INTERVAL_MINUTES} min.\n'
        'You\'ll get a message every 15 mins <b>only when TVK is leading</b>.\n'
        '📡 <a href="https://nammatamil.live/tn-election-2026">Live tracker</a>'
    )

    while True:
        try:
            now_ist = datetime.now(IST).strftime('%H:%M IST')
            print(f'\n[{now_ist}] Fetching results...')

            data = fetch_results()
            if not data:
                print('  No data — retrying in 5 min')
                time.sleep(300)
                continue

            # Print current state
            parties = data.get('parties', {})
            for p, d in parties.items():
                if p != 'Others':
                    w, l = d.get('won', 0), d.get('leading', 0)
                    print(f'  {p}: {w+l} ({w}W + {l}L)')

            stop = state.process(data)
            if stop:
                print('\n[bot] Results declared — final alert sent. Stopping.')
                break

            print(f'  Next check in {INTERVAL_MINUTES} min...')
            time.sleep(INTERVAL_MINUTES * 60)

        except KeyboardInterrupt:
            print('\n[bot] Stopped by user.')
            send_telegram('⏹ TVK Alert Bot stopped manually.')
            break
        except Exception as e:
            print(f'[error] {e}')
            time.sleep(60)


def run_test():
    print('[test] Sending test Telegram message...')
    # Build a fake dataset for the test
    fake_data = {
        'phase': 'counting',
        'totalSeats': 234,
        'parties': {
            'TVK':    {'won': 62, 'leading': 47, 'leader': 'Vijay Thalapathy'},
            'DMK':    {'won': 38, 'leading': 29, 'leader': 'MK Stalin'},
            'AIADMK': {'won': 22, 'leading': 18, 'leader': 'Edappadi K Palaniswami'},
            'BJP':    {'won': 4,  'leading': 3,  'leader': 'Annamalai'},
            'Others': {'won': 6,  'leading': 5,  'leader': ''},
        }
    }
    msg = build_message(fake_data, 'update')
    success = send_telegram(msg)
    if success:
        print('[test] ✓ Check your Telegram!')
    else:
        print('[test] ✗ Failed — check token/chat_id')


if __name__ == '__main__':
    if TEST_MODE:
        run_test()
    else:
        run_loop()
