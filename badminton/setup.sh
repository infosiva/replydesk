#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup.sh — One-time setup for the Badminton Booking Bot
# Run:  chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_NAME="com.badminton.booking"
PLIST_SRC="$DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Badminton Booking Bot — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create logs directory
mkdir -p "$DIR/logs"

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies…"
pip3 install -r "$DIR/requirements.txt"

# Install Playwright browser
echo ""
echo "🌐 Installing Playwright Chromium browser…"
python3 -m playwright install chromium

# Install macOS LaunchAgent (auto-start on login)
echo ""
echo "⚙️  Installing macOS LaunchAgent…"
mkdir -p "$HOME/Library/LaunchAgents"

# Generate plist with correct Python path
PYTHON_PATH="$(which python3)"
cat > "$PLIST_SRC" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.badminton.booking</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_PATH</string>
    <string>$DIR/scheduler.py</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$DIR/logs/booking.log</string>

  <key>StandardErrorPath</key>
  <string>$DIR/logs/booking_error.log</string>

  <key>WorkingDirectory</key>
  <string>$DIR</string>
</dict>
</plist>
EOF

cp "$PLIST_SRC" "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load   "$PLIST_DST"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "NEXT STEPS:"
echo ""
echo "  1. Create a Telegram bot:"
echo "     → Open Telegram → search @BotFather → /newbot → follow steps"
echo "     → Copy the token"
echo ""
echo "  2. Edit config.py:"
echo "     → Paste your token into TELEGRAM_BOT_TOKEN"
echo "     → Run:  python3 get_chat_id.py"
echo "     → Send any message to your bot in Telegram"
echo "     → Copy the printed chat ID into TELEGRAM_CHAT_ID"
echo ""
echo "  3. Test the bot:"
echo "     → python3 scheduler.py"
echo "     → Send /status to your bot"
echo "     → Send /booknow to test booking immediately"
echo ""
echo "  Logs: $DIR/logs/booking.log"
echo ""
