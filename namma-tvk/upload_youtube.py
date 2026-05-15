"""
YouTube Shorts uploader — targets @NammaTVK-2026 channel specifically.

HOW IT WORKS:
- Lists all channels/brand-accounts on your Google account
- Auto-selects NammaTVK-2026, saves a separate token for it
- Next runs use that saved token → always uploads to correct channel
"""

import os, sys, json, pickle, shutil
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
]
DIR     = Path(__file__).parent
SECRETS = DIR / 'client_secrets.json'
VIDEO   = DIR / 'tvk-reels-animated.mp4'

# Token files — one per channel
TOKEN_PERSONAL = DIR / 'token_personal.pickle'
TOKEN_NAMMATVK = DIR / 'token_nammatvk.pickle'

TITLE = 'TVK Projected to Win Tamil Nadu 2026 🎺 | Vijay Thalapathy CM | Exit Poll LIVE #Shorts'

DESCRIPTION = """🎺 TVK (Tamilaga Vettri Kazhagam) — Tamil Nadu Election 2026 LIVE Updates

📊 Exit Poll Projections:
• TVK (Vijay Thalapathy) — 98 to 120 seats
• DMK Alliance — ~101 seats
• AIADMK — ~27 seats
• Total seats: 234 | Majority: 118

🗳️ Counting Day: 4 May 2026 from 8 AM IST

🔔 SUBSCRIBE @NammaTVK-2026 for:
✅ Real-time counting updates on 4 May
✅ Constituency-wise live results
✅ TVK / Vijay Thalapathy news
✅ Tamil Nadu political analysis

📡 Data source: nammatamil.live

#TVK #VijayThalapathy #TamilNaduElection2026 #TNElection2026 #TamilagaVettriKazhagam
#ExitPoll2026 #NammaTVK #Shorts #TamilPolitics #CMVijay #TamilNadu2026
"""

TAGS = [
    'TVK', 'Vijay Thalapathy', 'Tamil Nadu Election 2026', 'TN Election 2026',
    'Tamilaga Vettri Kazhagam', 'Exit Poll 2026', 'NammaTVK', 'Tamil Nadu 2026',
    'CM Vijay', 'Tamil Politics', 'Counting Day', 'Election Results',
    'Shorts', 'Tamil News', 'Vijay CM'
]


def get_credentials(token_path):
    creds = None
    if token_path.exists():
        with open(token_path, 'rb') as f:
            creds = pickle.load(f)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_path, 'wb') as f:
            pickle.dump(creds, f)
        return creds
    # Need fresh login
    flow = InstalledAppFlow.from_client_secrets_file(str(SECRETS), SCOPES)
    creds = flow.run_local_server(port=8080, open_browser=True)
    with open(token_path, 'wb') as f:
        pickle.dump(creds, f)
    print(f'Token saved: {token_path}')
    return creds


def list_channels(yt):
    resp = yt.channels().list(part='snippet,id', mine=True, maxResults=50).execute()
    return resp.get('items', [])


def find_nammatvk_token():
    """
    YouTube Brand Accounts each need their own OAuth token.
    We authenticate once, list channels, then re-authenticate
    targeted at the Brand Account channel.

    For Brand Accounts, Google lets you pass ?authuser=X or use
    the account chooser. The simplest reliable approach:
    - We store a dedicated token for NammaTVK
    - First time: user selects NammaTVK in the browser login
    """
    if TOKEN_NAMMATVK.exists():
        # Verify it's still pointing to the right channel
        creds = get_credentials(TOKEN_NAMMATVK)
        yt = build('youtube', 'v3', credentials=creds)
        channels = list_channels(yt)
        for ch in channels:
            name = ch['snippet']['title']
            handle = ch['snippet'].get('customUrl', '')
            print(f'  Token channel: {name} ({handle})')
        return creds

    # First time — need to login specifically as NammaTVK brand account
    print("""
=================================================================
FIRST-TIME SETUP for @NammaTVK-2026
=================================================================
A browser will open. In the account picker:
  1. Click your Google account (info.siva@gmail.com)
  2. If asked which YouTube channel — select "NammaTVK-2026"
     (NOT your personal channel)
  3. Click Allow

If it goes to your personal channel, run again and the script
will detect and let you switch.
=================================================================
""")
    input('Press Enter to open browser...')
    creds = get_credentials(TOKEN_NAMMATVK)
    return creds


def upload():
    print(f'\nVideo: {VIDEO} ({VIDEO.stat().st_size / 1024 / 1024:.1f} MB)')

    creds = find_nammatvk_token()
    yt = build('youtube', 'v3', credentials=creds)

    # Confirm which channel we're uploading to
    channels = list_channels(yt)
    if channels:
        ch = channels[0]
        name   = ch['snippet']['title']
        handle = ch['snippet'].get('customUrl', '')
        ch_id  = ch['id']
        print(f'\nUploading to: {name} ({handle})  [{ch_id}]')

        is_nammatvk = 'nammatvk' in name.lower() or 'nammatvk' in handle.lower() or 'tvk' in handle.lower()
        if not is_nammatvk:
            print(f'\nWARNING: This looks like your personal channel, not NammaTVK-2026!')
            ans = input('Continue anyway? [y/N]: ').strip().lower()
            if ans != 'y':
                print('Aborted. Delete token_nammatvk.pickle and re-run to re-authenticate.')
                sys.exit(0)

    body = {
        'snippet': {
            'title': TITLE,
            'description': DESCRIPTION,
            'tags': TAGS,
            'categoryId': '25',  # News & Politics
            'defaultLanguage': 'ta',
            'defaultAudioLanguage': 'ta',
        },
        'status': {
            'privacyStatus': 'public',
            'selfDeclaredMadeForKids': False,
        }
    }

    media = MediaFileUpload(str(VIDEO), mimetype='video/mp4', resumable=True, chunksize=2*1024*1024)

    print('\nUploading...')
    req = yt.videos().insert(part='snippet,status', body=body, media_body=media)

    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            pct = int(status.progress() * 100)
            bar = '█' * (pct // 5) + '░' * (20 - pct // 5)
            print(f'  [{bar}] {pct}%', end='\r')

    vid_id = response['id']
    print(f'\n\n✅ Uploaded successfully!')
    print(f'   Short URL : https://www.youtube.com/shorts/{vid_id}')
    print(f'   Watch URL : https://youtu.be/{vid_id}')
    print(f'   Studio    : https://studio.youtube.com/video/{vid_id}/edit')


if __name__ == '__main__':
    upload()
