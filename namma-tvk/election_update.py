"""
NammaTVK — TN Election 2026 Live Update Uploader
=================================================
Run this script periodically today (May 4) to auto-post YouTube updates
as results come in from nammatamil.live/api/election-results.

Usage:
  python3 election_update.py           # upload full update video
  python3 election_update.py --dry-run # preview only, no upload
  python3 election_update.py --loop    # post Community updates every 15 min (no video)
  python3 election_update.py --community  # one Community post only

Schedule (run every ~2 hours):
  python3 election_update.py
"""

import os, sys, json, pickle, textwrap, requests, io, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont

IST = timezone(timedelta(hours=5, minutes=30))

DIR        = Path(__file__).parent
SECRETS    = DIR / 'client_secrets.json'
TOKEN_FILE = DIR / 'token_nammatvk.pickle'
OUT_IMAGE  = DIR / 'election_card.png'
OUT_VIDEO  = DIR / 'election_update_live.mp4'

RESULTS_API = 'https://nammatamil.live/api/election-results'
DRY_RUN     = '--dry-run' in sys.argv
LOOP_MODE   = '--loop' in sys.argv
COMMUNITY_ONLY = '--community' in sys.argv

# ── 1. Fetch live results ─────────────────────────────────────────────────────

def fetch_results():
    try:
        r = requests.get(RESULTS_API, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f'[warn] Could not fetch live results: {e}')
        return None

# ── 2. Generate result card image (1080×1920 for Shorts) ─────────────────────

PARTY_COLORS = {
    'TVK':    '#fbbf24',
    'DMK':    '#f87171',
    'AIADMK': '#4ade80',
    'BJP':    '#fb923c',
    'Others': '#94a3b8',
}

def make_card(data: dict) -> Path:
    W, H = 1080, 1920
    BG   = (7, 1, 15)

    img  = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Gradient overlay
    for y in range(H):
        alpha = int(20 * (1 - y / H))
        draw.line([(0, y), (W, y)], fill=(20, 5, 40))

    # Header
    now_ist = datetime.now(IST).strftime('%d %b %Y · %H:%M IST')

    try:
        font_xl  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 72)
        font_lg  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 54)
        font_md  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 42)
        font_sm  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 32)
        font_xs  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
    except Exception:
        font_xl = font_lg = font_md = font_sm = font_xs = ImageFont.load_default()

    # Live badge
    phase = data.get('phase', 'pre-counting')
    badge_text = '🔴 LIVE COUNTING' if phase == 'counting' else ('✅ RESULTS DECLARED' if phase == 'declared' else '📊 EXIT POLLS')
    draw.text((W//2, 110), badge_text, font=font_md, fill='#ef4444' if 'LIVE' in badge_text else '#fbbf24', anchor='mm')

    # Title
    draw.text((W//2, 200), 'Tamil Nadu Election 2026', font=font_xl, fill='#ffffff', anchor='mm')
    draw.text((W//2, 285), 'தமிழ்நாடு தேர்தல் முடிவுகள்', font=font_lg, fill='rgba(255,255,255,0.6)', anchor='mm')

    # Timestamp
    draw.text((W//2, 355), now_ist, font=font_xs, fill=(120, 100, 140), anchor='mm')

    # Divider
    draw.line([(80, 395), (W-80, 395)], fill=(60, 30, 80), width=2)

    # Party results
    parties = data.get('parties', {})
    y_start = 440
    majority = data.get('totalSeats', 234) // 2 + 1

    for i, (pname, pdata) in enumerate(parties.items()):
        if pname == 'Others':
            continue
        y = y_start + i * 290

        color_hex = PARTY_COLORS.get(pname, '#ffffff')
        r_int = int(color_hex[1:3], 16)
        g_int = int(color_hex[3:5], 16)
        b_int = int(color_hex[5:7], 16)
        color = (r_int, g_int, b_int)
        dim   = (r_int // 6, g_int // 6, b_int // 6)

        # Card background
        draw.rounded_rectangle([60, y, W-60, y+260], radius=24, fill=dim, outline=color, width=2)

        # Party name + leader
        leader = pdata.get('leader', '')
        draw.text((140, y+40), pname, font=font_xl, fill=color)
        draw.text((140, y+115), leader, font=font_sm, fill=(180, 160, 200))

        # Seat count
        won     = pdata.get('won', 0)
        leading = pdata.get('leading', 0)
        total   = won + leading

        draw.text((W-140, y+40), str(total), font=font_xl, fill=color, anchor='ra')
        draw.text((W-140, y+115), f'{won} won · {leading} leading', font=font_xs, fill=(160, 140, 180), anchor='ra')

        # Majority marker
        if total >= majority:
            draw.text((W-140, y+160), '🏆 MAJORITY', font=font_sm, fill='#fbbf24', anchor='ra')

        # Progress bar
        bar_w  = W - 180
        bar_x  = 90
        bar_y  = y + 210
        bar_h  = 24
        fill_w = min(int(bar_w * total / 234), bar_w)
        draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=12, fill=(40, 20, 60))
        if fill_w > 0:
            draw.rounded_rectangle([bar_x, bar_y, bar_x + fill_w, bar_y + bar_h], radius=12, fill=color)

    # Majority line label
    maj_x = 90 + int((W-180) * majority / 234)
    draw.line([(maj_x, 440), (maj_x, 440 + 3*290)], fill=(255, 255, 255, 60), width=2)
    draw.text((maj_x + 6, 445), f'118 majority', font=font_xs, fill=(180, 160, 200))

    # Footer
    draw.line([(80, H-200), (W-80, H-200)], fill=(60, 30, 80), width=2)
    draw.text((W//2, H-160), 'nammatamil.live', font=font_md, fill='#fbbf24', anchor='mm')
    draw.text((W//2, H-100), 'Subscribe @NammaTVK for live updates', font=font_sm, fill=(140, 120, 160), anchor='mm')
    draw.text((W//2, H-55), '#TNElection2026 #TVK #DMK #AIADMK', font=font_xs, fill=(100, 80, 120), anchor='mm')

    img.save(OUT_IMAGE)
    print(f'[card] Saved → {OUT_IMAGE}')
    return OUT_IMAGE

# ── 3. Convert image to video (ffmpeg) ───────────────────────────────────────

def make_video(image_path: Path, duration_secs: int = 30) -> Path:
    import subprocess
    cmd = [
        'ffmpeg', '-y',
        '-loop', '1',
        '-i', str(image_path),
        '-c:v', 'libx264',
        '-t', str(duration_secs),
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=1080:1920',
        '-r', '30',
        str(OUT_VIDEO),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print('[warn] ffmpeg failed, uploading image card instead')
        return image_path
    print(f'[video] Saved → {OUT_VIDEO}')
    return OUT_VIDEO

# ── 4. Build title + description ─────────────────────────────────────────────

def build_metadata(data: dict) -> tuple[str, str]:
    parties  = data.get('parties', {})
    phase    = data.get('phase', 'counting')
    now_ist  = datetime.now(IST).strftime('%H:%M IST · %d May 2026')

    # Find leader
    leader_party = max(
        [(p, (d.get('won', 0) + d.get('leading', 0))) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1], default=('TVK', 0)
    )

    lead_name, lead_total = leader_party
    lead_data = parties.get(lead_name, {})
    majority  = data.get('totalSeats', 234) // 2 + 1

    if phase == 'declared':
        title = f'🏆 {lead_name} WINS Tamil Nadu 2026! {lead_total} Seats | TN Election Results LIVE'
    elif lead_total >= majority:
        title = f'🔴 {lead_name} crosses MAJORITY! {lead_total}/{majority} seats | TN Election Live {now_ist}'
    else:
        title = f'🔴 TN Election LIVE {now_ist} | {lead_name} leading with {lead_total} seats'

    lines = []
    for pname, pdata in parties.items():
        if pname == 'Others':
            continue
        won     = pdata.get('won', 0)
        leading = pdata.get('leading', 0)
        lines.append(f'• {pname}: {won + leading} seats ({won} won, {leading} leading)')

    desc = textwrap.dedent(f"""
        🗳️ Tamil Nadu Assembly Election 2026 — LIVE Results Update

        📊 Current Seat Count ({now_ist}):
        {chr(10).join(lines)}

        Total Seats: 234 | Majority: {majority}

        🔔 SUBSCRIBE for:
        ✅ Real-time seat-by-seat counting updates
        ✅ Constituency-wise live results
        ✅ TVK / Vijay Thalapathy news
        ✅ Tamil Nadu political analysis

        📡 Full live tracker: https://nammatamil.live/tn-election-2026

        #TNElection2026 #TamilNaduElection #TVK #DMK #AIADMK #VijayThalapathy
        #TamilNadu2026 #ElectionResults #NammaTVK #Shorts #LiveResults
    """).strip()

    return title[:100], desc  # YouTube title max 100 chars

# ── 5. Upload to YouTube ──────────────────────────────────────────────────────

def get_youtube_client():
    from googleapiclient.discovery import build
    from google.auth.transport.requests import Request

    if not TOKEN_FILE.exists():
        print('[error] No YouTube token found. Run upload_youtube.py first to authenticate.')
        sys.exit(1)

    with open(TOKEN_FILE, 'rb') as f:
        creds = pickle.load(f)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_FILE, 'wb') as f:
            pickle.dump(creds, f)

    return build('youtube', 'v3', credentials=creds)

def upload(video_path: Path, title: str, description: str):
    from googleapiclient.http import MediaFileUpload

    yt = get_youtube_client()

    tags = [
        'Tamil Nadu Election 2026', 'TN Election Results', 'TVK', 'DMK', 'AIADMK',
        'Vijay Thalapathy', 'Tamil Nadu 2026', 'Election Live', 'NammaTVK', 'Shorts',
        'Tamil Politics', 'MK Stalin', 'Edappadi', 'TN Election Counting',
    ]

    body = {
        'snippet': {
            'title':       title,
            'description': description,
            'tags':        tags,
            'categoryId':  '25',  # News & Politics
            'defaultLanguage': 'ta',
        },
        'status': {
            'privacyStatus':           'public',
            'selfDeclaredMadeForKids': False,
        },
    }

    suffix = str(video_path).lower()
    mime   = 'video/mp4' if suffix.endswith('.mp4') else 'image/png'

    media = MediaFileUpload(str(video_path), mimetype=mime, resumable=True)
    req   = yt.videos().insert(part='snippet,status', body=body, media_body=media)

    print(f'[upload] Uploading: {title}')
    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            print(f'  {int(status.progress() * 100)}%')

    vid_id = response.get('id', '?')
    print(f'[done] https://youtu.be/{vid_id}')
    return vid_id

# ── 6. Community post (real-time text update) ─────────────────────────────────

def build_community_text(data: dict) -> str:
    """Build a concise, readable Community post with live seat tallies."""
    parties  = data.get('parties', {})
    phase    = data.get('phase', 'pre-counting')
    total_seats = data.get('totalSeats', 234)
    majority = total_seats // 2 + 1
    now_ist  = datetime.now(IST).strftime('%H:%M IST')

    # Sort by total seats descending
    sorted_parties = sorted(
        [(p, d) for p, d in parties.items() if p != 'Others'],
        key=lambda x: x[1].get('won', 0) + x[1].get('leading', 0),
        reverse=True
    )

    # Phase label
    if phase == 'declared':
        header = '✅ RESULTS DECLARED — Tamil Nadu Election 2026'
    elif phase == 'counting':
        header = f'🔴 LIVE COUNTING — Tamil Nadu Election 2026\nUpdated: {now_ist}'
    else:
        header = f'📊 Tamil Nadu Election 2026 — Exit Poll Update\nUpdated: {now_ist}'

    lines = [header, '']
    lines.append(f'📊 Seat Count (out of {total_seats} | Majority: {majority}):')
    lines.append('')

    emoji_map = {'TVK': '🟡', 'DMK': '🔴', 'AIADMK': '🟢', 'BJP': '🟠'}

    for pname, pdata in sorted_parties:
        won     = pdata.get('won', 0)
        leading = pdata.get('leading', 0)
        total   = won + leading
        leader  = pdata.get('leader', '')
        emoji   = emoji_map.get(pname, '⚪')
        bar     = '█' * min(int(total / 234 * 20), 20)

        majority_tag = ' 🏆 MAJORITY!' if total >= majority else ''
        lines.append(f'{emoji} {pname} ({leader}): {total} seats{majority_tag}')
        lines.append(f'   {bar}')
        lines.append(f'   Won: {won}  |  Leading: {leading}')
        lines.append('')

    # Winner call
    if sorted_parties:
        top_name, top_data = sorted_parties[0]
        top_total = top_data.get('won', 0) + top_data.get('leading', 0)
        if phase == 'declared':
            lines.append(f'🏆 {top_name} has WON Tamil Nadu 2026 with {top_total} seats!')
        elif top_total >= majority:
            lines.append(f'🏆 {top_name} has crossed the majority mark of {majority} seats!')
        else:
            lines.append(f'📌 {top_name} currently leads the count.')

    lines.append('')
    lines.append('📡 Full live tracker → nammatamil.live/tn-election-2026')
    lines.append('')
    lines.append('#TNElection2026 #TVK #DMK #AIADMK #TamilNadu2026 #ElectionResults')

    return '\n'.join(lines)


def post_community_update(data: dict) -> str | None:
    """Post a Community tab text update to the NammaTVK channel."""
    text = build_community_text(data)

    if DRY_RUN:
        print('\n[dry-run] Community post text:')
        print('─' * 60)
        print(text)
        print('─' * 60)
        return None

    try:
        yt = get_youtube_client()

        # YouTube Community posts use the communityPosts.insert endpoint
        # This requires the channel to have community posts enabled (1000+ subscribers)
        body = {
            'snippet': {
                'type': 'textPost',
                'textOriginal': text,
            }
        }

        response = yt.communityPosts().insert(
            part='snippet',
            body=body,
        ).execute()

        post_id = response.get('id', '?')
        print(f'[community] Posted → https://www.youtube.com/post/{post_id}')
        return post_id

    except Exception as e:
        print(f'[warn] Community post failed: {e}')
        print('[info] The YouTube Data API v3 communityPosts endpoint requires channel membership (1000+ subs)')
        print('[info] Falling back to printing the update text...')
        print('\n' + '─'*60)
        print('COPY THIS TO YOUTUBE COMMUNITY TAB MANUALLY:')
        print('─'*60)
        print(text)
        print('─'*60 + '\n')
        return None


# ── 7. Continuous loop mode ───────────────────────────────────────────────────

def run_loop(interval_minutes: int = 15):
    """Keep posting Community updates until results are declared."""
    print(f'[loop] Starting live update loop — posting every {interval_minutes} min')
    print('[loop] Press Ctrl+C to stop\n')

    last_hash = None

    while True:
        try:
            now_ist = datetime.now(IST).strftime('%H:%M IST')
            print(f'\n[{now_ist}] Fetching results...')

            data = fetch_results()
            if not data:
                print('[warn] No data, retrying in 5 min...')
                time.sleep(300)
                continue

            phase   = data.get('phase', 'unknown')
            parties = data.get('parties', {})

            # Print current state
            print(f'Phase: {phase}')
            for p, d in parties.items():
                if p != 'Others':
                    won, leading = d.get('won', 0), d.get('leading', 0)
                    print(f'  {p}: {won + leading} ({won}W + {leading}L)')

            # Only post if data changed
            data_hash = json.dumps(parties, sort_keys=True)
            if data_hash == last_hash:
                print('[skip] No change since last update')
            else:
                post_community_update(data)
                last_hash = data_hash

            # Stop when results are declared
            if phase == 'declared':
                print('\n[loop] Results declared! Final Community post sent. Stopping loop.')
                break

            print(f'[loop] Next check in {interval_minutes} minutes...')
            time.sleep(interval_minutes * 60)

        except KeyboardInterrupt:
            print('\n[loop] Stopped by user.')
            break
        except Exception as e:
            print(f'[error] Loop error: {e}')
            time.sleep(60)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f'\n=== NammaTVK Election Updater · {datetime.now(IST).strftime("%H:%M IST")} ===\n')

    # Community-only mode: just post a text update
    if COMMUNITY_ONLY or LOOP_MODE:
        if LOOP_MODE:
            run_loop(interval_minutes=15)
        else:
            data = fetch_results()
            if not data:
                print('[error] No data available.')
                sys.exit(1)
            post_community_update(data)
        return

    # 1. Fetch data
    data = fetch_results()
    if not data:
        print('[error] No data available. Check https://nammatamil.live/api/election-results')
        sys.exit(1)

    phase   = data.get('phase', 'unknown')
    parties = data.get('parties', {})

    print(f'Phase: {phase}')
    for p, d in parties.items():
        if p != 'Others':
            won, leading = d.get('won', 0), d.get('leading', 0)
            print(f'  {p}: {won + leading} ({won}W + {leading}L)')

    # 2. Build card image
    card = make_card(data)

    # 3. Build video (30s card)
    video = make_video(card, duration_secs=30)

    # 4. Build metadata
    title, desc = build_metadata(data)
    print(f'\nTitle: {title}')

    if DRY_RUN:
        print('\n[dry-run] Skipping upload. Card saved to:', OUT_IMAGE)
        print('Description preview:\n', desc[:300], '...')
        return

    # 5. Upload video to YouTube
    upload(video, title, desc)

    # 6. Also post a Community update
    print('\n[community] Posting Community update...')
    post_community_update(data)

if __name__ == '__main__':
    main()
