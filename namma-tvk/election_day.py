"""
NammaTVK — TN Election 2026 MAIN VIDEO + Live Description Updates
=================================================================

Run ONCE at the start of counting day to upload the master election video.
Then run in --watch mode to keep its description updated every 15 minutes.

Usage:
  python3 election_day.py --upload         # Upload the main video (do this first)
  python3 election_day.py --watch          # Update description every 15 min (run all day)
  python3 election_day.py --update-now     # Update description once right now
  python3 election_day.py --dry-run        # Preview only, no upload/update

The main video is a visually rich 3-minute card video showing:
  - All parties and their current seat tallies
  - Who is leading, who has majority
  - A "scoreboard" style graphic

The description is updated live every 15 minutes with the latest seat counts.
"""

import os, sys, json, pickle, textwrap, requests, time, subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont

IST = timezone(timedelta(hours=5, minutes=30))

DIR        = Path(__file__).parent
TOKEN_FILE = DIR / 'token_nammatvk.pickle'
OUT_IMAGE  = DIR / 'election_day_card.png'
OUT_VIDEO  = DIR / 'election_day.mp4'
VIDEO_ID_FILE = DIR / 'election_day_video_id.txt'

RESULTS_API = 'https://nammatamil.live/api/election-results'
DRY_RUN     = '--dry-run' in sys.argv

PARTY_COLORS = {
    'TVK':    ('#fbbf24', (251, 191, 36)),
    'DMK':    ('#f87171', (248, 113, 113)),
    'AIADMK': ('#4ade80', (74, 222, 128)),
    'BJP':    ('#fb923c', (251, 146, 60)),
    'Others': ('#94a3b8', (148, 163, 184)),
}

# ── Fetch ─────────────────────────────────────────────────────────────────────

def fetch_results():
    try:
        r = requests.get(RESULTS_API, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'[warn] Could not fetch: {e}')
        return None

# ── Generate a 1080×1920 scoreboard card ──────────────────────────────────────

def make_scoreboard(data: dict, label: str = '') -> Path:
    """Render a detailed scoreboard image. label = 'Live Update' or timestamp."""
    W, H = 1080, 1920
    img  = Image.new('RGB', (W, H), (5, 2, 12))
    draw = ImageDraw.Draw(img)

    # Background gradient
    for y in range(H):
        t = y / H
        r = int(10 + 10 * t)
        g = int(2 + 3 * t)
        b = int(20 + 15 * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    now_ist = datetime.now(IST).strftime('%d May 2026 · %H:%M IST')

    try:
        f72 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 72)
        f60 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 60)
        f48 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 48)
        f36 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 36)
        f28 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 28)
        f22 = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
    except Exception:
        f72 = f60 = f48 = f36 = f28 = f22 = ImageFont.load_default()

    phase = data.get('phase', 'pre-counting')
    parties = data.get('parties', {})
    total_seats = data.get('totalSeats', 234)
    majority = total_seats // 2 + 1

    # ── Top section ──
    # Phase badge
    if phase == 'declared':
        badge, badge_color = '✅ RESULTS DECLARED', (34, 197, 94)
    elif phase == 'counting':
        badge, badge_color = '🔴  L I V E  C O U N T I N G', (239, 68, 68)
    else:
        badge, badge_color = '📊  EXIT POLLS', (251, 191, 36)

    draw.text((W//2, 90), badge, font=f36, fill=badge_color, anchor='mm')

    # Main title
    draw.text((W//2, 190), 'தமிழ்நாடு', font=f72, fill=(255, 255, 255), anchor='mm')
    draw.text((W//2, 275), 'சட்டமன்றத் தேர்தல் 2026', font=f48, fill=(200, 190, 220), anchor='mm')
    draw.text((W//2, 340), 'Tamil Nadu Assembly Election', font=f28, fill=(140, 120, 160), anchor='mm')

    # Timestamp
    draw.text((W//2, 390), now_ist, font=f22, fill=(100, 85, 120), anchor='mm')

    # Divider
    draw.line([(60, 420), (W-60, 420)], fill=(60, 30, 80), width=2)

    # Majority label at top of bars section
    draw.text((W//2, 450), f'Majority: {majority} seats out of {total_seats}', font=f28, fill=(160, 140, 180), anchor='mm')

    # ── Party cards ──
    sorted_parties = sorted(
        [(p, d) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1].get('won', 0) + x[1].get('leading', 0),
        reverse=True
    )

    card_h   = 270
    card_gap = 20
    y_start  = 480

    for rank, (pname, pdata) in enumerate(sorted_parties):
        _, color = PARTY_COLORS.get(pname, ('#ffffff', (255, 255, 255)))
        dim = tuple(max(c // 7, 8) for c in color)

        won     = pdata.get('won', 0)
        leading = pdata.get('leading', 0)
        total   = won + leading
        leader  = pdata.get('leader', '')
        has_majority = total >= majority

        y = y_start + rank * (card_h + card_gap)

        # Card bg
        outline_width = 3 if has_majority else 1
        draw.rounded_rectangle([50, y, W-50, y+card_h], radius=20, fill=dim, outline=color, width=outline_width)

        # Rank badge
        rank_colors = [(212, 175, 55), (192, 192, 192), (205, 127, 50)]
        rbc = rank_colors[rank] if rank < 3 else (100, 100, 100)
        draw.ellipse([62, y+12, 110, y+60], fill=rbc)
        draw.text((86, y+36), str(rank+1), font=f28, fill=(0, 0, 0), anchor='mm')

        # Party name
        draw.text((130, y+30), pname, font=f60, fill=color)

        # Leader name
        draw.text((130, y+100), leader, font=f28, fill=(180, 160, 200))

        # Total seats — big number on right
        draw.text((W-80, y+25), str(total), font=f72, fill=color, anchor='ra')

        # Won / Leading breakdown
        draw.text((W-80, y+100), f'{won} Won', font=f28, fill=color, anchor='ra')
        draw.text((W-80, y+135), f'{leading} Leading', font=f22, fill=(160, 140, 180), anchor='ra')

        # Majority crown
        if has_majority:
            draw.text((W//2, y+30), '🏆 MAJORITY', font=f36, fill=(251, 191, 36), anchor='mm')

        # Progress bar
        bar_x, bar_y = 80, y + card_h - 50
        bar_w, bar_h = W - 160, 28
        pct = min(total / total_seats, 1.0)
        fill_w = int(bar_w * pct)

        draw.rounded_rectangle([bar_x, bar_y, bar_x+bar_w, bar_y+bar_h], radius=14, fill=(30, 15, 45))
        if fill_w > 0:
            draw.rounded_rectangle([bar_x, bar_y, bar_x+fill_w, bar_y+bar_h], radius=14, fill=color)

        # Majority line on bar
        maj_bar_x = bar_x + int(bar_w * majority / total_seats)
        draw.line([(maj_bar_x, bar_y-5), (maj_bar_x, bar_y+bar_h+5)], fill=(255, 255, 255), width=2)

    # ── Bottom section ──
    y_foot = y_start + len(sorted_parties) * (card_h + card_gap) + 20

    # Others row (compact)
    others = parties.get('Others', {})
    if others:
        others_total = others.get('won', 0) + others.get('leading', 0)
        draw.text((W//2, y_foot), f'Others / Independents: {others_total} seats', font=f28, fill=(140, 120, 160), anchor='mm')
        y_foot += 45

    draw.line([(60, y_foot + 10), (W-60, y_foot + 10)], fill=(60, 30, 80), width=2)

    draw.text((W//2, y_foot + 50), '📡 nammatamil.live/tn-election-2026', font=f36, fill=(251, 191, 36), anchor='mm')
    draw.text((W//2, y_foot + 100), 'SUBSCRIBE @NammaTVK for live updates', font=f28, fill=(160, 140, 180), anchor='mm')
    draw.text((W//2, y_foot + 145), '#TNElection2026  #TVK  #DMK  #AIADMK', font=f22, fill=(100, 80, 120), anchor='mm')

    img.save(OUT_IMAGE)
    print(f'[card] Saved → {OUT_IMAGE}')
    return OUT_IMAGE


# ── Convert to video ──────────────────────────────────────────────────────────

def make_video(image_path: Path, duration_secs: int = 180) -> Path:
    """3-minute video from static card — stays pinned all day."""
    cmd = [
        'ffmpeg', '-y',
        '-loop', '1',
        '-i', str(image_path),
        '-c:v', 'libx264',
        '-t', str(duration_secs),
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1080:1920',
        '-r', '30',
        # Slow zoom-in pulse effect (optional, makes it feel live)
        str(OUT_VIDEO),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'[warn] ffmpeg stderr: {result.stderr[:500]}')
        print('[warn] ffmpeg failed, will upload image directly')
        return image_path
    print(f'[video] Saved → {OUT_VIDEO}')
    return OUT_VIDEO


# ── YouTube client ────────────────────────────────────────────────────────────

def get_yt():
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request

    if not TOKEN_FILE.exists():
        print('[error] token_nammatvk.pickle not found. Re-authenticate first.')
        sys.exit(1)

    with open(TOKEN_FILE, 'rb') as f:
        creds = pickle.load(f)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)

    return build('youtube', 'v3', credentials=creds)


# ── Build video title / description ──────────────────────────────────────────

def build_video_description(data: dict) -> str:
    parties     = data.get('parties', {})
    phase       = data.get('phase', 'counting')
    total_seats = data.get('totalSeats', 234)
    majority    = total_seats // 2 + 1
    now_ist     = datetime.now(IST).strftime('%H:%M IST · %d May 2026')

    sorted_parties = sorted(
        [(p, d) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1].get('won', 0) + x[1].get('leading', 0),
        reverse=True
    )

    lines = []
    for pname, pdata in sorted_parties:
        won     = pdata.get('won', 0)
        leading = pdata.get('leading', 0)
        total   = won + leading
        bar     = '█' * min(int(total / total_seats * 20), 20)
        maj_tag = ' ← MAJORITY 🏆' if total >= majority else ''
        lines.append(f'{pname:8s}  {total:3d} seats  [{bar:<20s}]{maj_tag}')
        lines.append(f'         Won: {won}  |  Leading: {leading}')

    others = parties.get('Others', {})
    if others:
        ot = others.get('won', 0) + others.get('leading', 0)
        lines.append(f'Others    {ot:3d} seats')

    top = sorted_parties[0] if sorted_parties else ('?', {})
    top_name  = top[0]
    top_total = top[1].get('won', 0) + top[1].get('leading', 0)

    if phase == 'declared':
        status_line = f'🏆 WINNER: {top_name} with {top_total} seats!'
    elif top_total >= majority:
        status_line = f'🏆 {top_name} has crossed the majority mark ({majority} seats)!'
    else:
        status_line = f'📌 {top_name} leads with {top_total} seats. Majority needed: {majority}.'

    desc = textwrap.dedent(f"""
        🗳️ Tamil Nadu Assembly Election 2026 — LIVE Results
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ⏱️ Last Updated: {now_ist}

        {status_line}

        📊 Current Scoreboard:
        ━━━━━━━━━━━━━━━━━━━━
        {chr(10).join(lines)}
        ━━━━━━━━━━━━━━━━━━━━
        Total Seats: {total_seats}  |  Majority: {majority}

        🔔 SUBSCRIBE to @NammaTVK for:
        ✅ Live seat-by-seat updates (updated every 15 min)
        ✅ Constituency-wise results
        ✅ Tamil Nadu political analysis
        ✅ TVK / Vijay Thalapathy latest news

        📡 Full interactive live tracker:
        https://nammatamil.live/tn-election-2026

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        #TNElection2026 #TamilNaduElection #TVK #DMK #AIADMK
        #VijayThalapathy #TamilNadu2026 #ElectionResults
        #NammaTVK #LiveResults #TNElectionResults
    """).strip()

    return desc


def build_title(data: dict) -> str:
    parties     = data.get('parties', {})
    phase       = data.get('phase', 'counting')
    total_seats = data.get('totalSeats', 234)
    majority    = total_seats // 2 + 1

    sorted_parties = sorted(
        [(p, d) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1].get('won', 0) + x[1].get('leading', 0),
        reverse=True
    )

    if not sorted_parties:
        return '🔴 Tamil Nadu Election 2026 LIVE Results | NammaTVK'

    top_name  = sorted_parties[0][0]
    top_total = sorted_parties[0][1].get('won', 0) + sorted_parties[0][1].get('leading', 0)

    if phase == 'declared':
        title = f'🏆 {top_name} WINS Tamil Nadu 2026! Final Results | NammaTVK'
    elif top_total >= majority:
        title = f'🔴 {top_name} crosses MAJORITY! TN Election 2026 LIVE Results'
    else:
        title = f'🔴 TN Election 2026 LIVE | {top_name} leads {top_total} seats | NammaTVK'

    return title[:100]


# ── Upload main video ─────────────────────────────────────────────────────────

def upload_main_video(data: dict):
    from googleapiclient.http import MediaFileUpload

    card  = make_scoreboard(data)
    video = make_video(card, duration_secs=180)  # 3 minutes

    title = build_title(data)
    desc  = build_video_description(data)

    if DRY_RUN:
        print(f'\n[dry-run] Would upload: {title}')
        print(f'[dry-run] Description:\n{desc[:400]}...')
        return

    yt = get_yt()

    tags = [
        'Tamil Nadu Election 2026', 'TN Election Results', 'TVK', 'DMK', 'AIADMK',
        'Vijay Thalapathy', 'Tamil Nadu 2026', 'TN Election Live', 'NammaTVK',
        'Election Live 2026', 'Tamil Politics', 'MK Stalin', 'Edappadi',
        'TN Counting Day', 'Tamil Nadu Counting', 'தேர்தல் முடிவு',
    ]

    body = {
        'snippet': {
            'title':           title,
            'description':     desc,
            'tags':            tags,
            'categoryId':      '25',  # News & Politics
            'defaultLanguage': 'ta',
        },
        'status': {
            'privacyStatus':           'public',
            'selfDeclaredMadeForKids': False,
        },
    }

    suffix = str(video).lower()
    mime   = 'video/mp4' if suffix.endswith('.mp4') else 'image/png'
    media  = MediaFileUpload(str(video), mimetype=mime, resumable=True)
    req    = yt.videos().insert(part='snippet,status', body=body, media_body=media)

    print(f'[upload] Uploading main election video: {title}')
    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            print(f'  {int(status.progress() * 100)}%')

    vid_id = response.get('id', '?')
    print(f'[done] https://youtu.be/{vid_id}')

    # Save video ID for later description updates
    VIDEO_ID_FILE.write_text(vid_id)
    print(f'[saved] Video ID saved to {VIDEO_ID_FILE}')
    return vid_id


# ── Update existing video description ────────────────────────────────────────

def update_description(video_id: str, data: dict):
    title = build_title(data)
    desc  = build_video_description(data)
    now   = datetime.now(IST).strftime('%H:%M IST')

    if DRY_RUN:
        print(f'\n[dry-run] Would update video {video_id}')
        print(f'New title: {title}')
        print(f'Description (first 300 chars):\n{desc[:300]}...')
        return

    yt = get_yt()

    # Fetch current snippet first (required to update)
    resp = yt.videos().list(part='snippet', id=video_id).execute()
    items = resp.get('items', [])
    if not items:
        print(f'[error] Video {video_id} not found')
        return

    snippet = items[0]['snippet']
    snippet['title']       = title
    snippet['description'] = desc

    yt.videos().update(
        part='snippet',
        body={'id': video_id, 'snippet': snippet},
    ).execute()

    print(f'[{now}] Description updated → https://youtu.be/{video_id}')


# ── Watch loop ────────────────────────────────────────────────────────────────

def watch_loop(interval_minutes: int = 15):
    if not VIDEO_ID_FILE.exists():
        print('[error] No video ID file found. Run --upload first.')
        sys.exit(1)

    video_id  = VIDEO_ID_FILE.read_text().strip()
    last_hash = None

    print(f'[watch] Watching results, updating video {video_id} every {interval_minutes} min')
    print('[watch] Press Ctrl+C to stop\n')

    while True:
        try:
            now_ist = datetime.now(IST).strftime('%H:%M IST')
            print(f'[{now_ist}] Fetching results...')

            data = fetch_results()
            if not data:
                print('[warn] No data, retrying in 5 min...')
                time.sleep(300)
                continue

            phase   = data.get('phase', 'unknown')
            parties = data.get('parties', {})

            print(f'  Phase: {phase}')
            for p, d in parties.items():
                if p != 'Others':
                    won, leading = d.get('won', 0), d.get('leading', 0)
                    print(f'  {p}: {won+leading} ({won}W + {leading}L)')

            data_hash = json.dumps(parties, sort_keys=True)

            if data_hash == last_hash:
                print('  [skip] No change')
            else:
                update_description(video_id, data)
                last_hash = data_hash

            if phase == 'declared':
                print('\n[watch] Results declared — final update done. Stopping.')
                break

            print(f'  Next check in {interval_minutes} min...')
            time.sleep(interval_minutes * 60)

        except KeyboardInterrupt:
            print('\n[watch] Stopped.')
            break
        except Exception as e:
            print(f'[error] {e}')
            time.sleep(60)


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f'\n=== NammaTVK Election Day · {datetime.now(IST).strftime("%H:%M IST")} ===\n')

    if '--upload' in sys.argv:
        data = fetch_results()
        if not data:
            print('[error] No data from API')
            sys.exit(1)
        upload_main_video(data)

    elif '--watch' in sys.argv:
        watch_loop(interval_minutes=15)

    elif '--update-now' in sys.argv:
        if not VIDEO_ID_FILE.exists():
            print('[error] No video ID saved. Run --upload first.')
            sys.exit(1)
        video_id = VIDEO_ID_FILE.read_text().strip()
        data = fetch_results()
        if not data:
            print('[error] No data')
            sys.exit(1)
        update_description(video_id, data)

    else:
        print(__doc__)
        print('\nOptions:')
        print('  --upload      Upload the main election video (do once at start of day)')
        print('  --watch       Keep updating description every 15 min (run all day)')
        print('  --update-now  Update description once right now')
        print('  --dry-run     Preview without uploading/updating')

if __name__ == '__main__':
    main()
