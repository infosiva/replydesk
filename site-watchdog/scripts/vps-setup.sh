#!/bin/bash
# Site Watchdog - VPS Setup Script
# Run this ON your VPS: bash vps-setup.sh
#
# VPS: 31.97.56.148 (Ubuntu, Node v22.22.0)

set -e

echo "================================="
echo "Site Watchdog - VPS Setup"
echo "================================="

WATCHDOG_DIR="/root/site-watchdog"
AGENTS_DIR="/root/agents"

# 1. Check Node.js
echo ""
echo "1. Checking Node.js..."
node --version || { echo "ERROR: Node.js not found"; exit 1; }
npm --version

# 2. Install tsx, PM2 globally
if ! command -v tsx &>/dev/null; then npm install -g tsx; fi
if ! command -v pm2 &>/dev/null; then npm install -g pm2; fi
git --version || apt-get install -y git

# 3. Create directories
mkdir -p "$AGENTS_DIR" "$WATCHDOG_DIR/logs" "$WATCHDOG_DIR/logs/screenshots"

# 4. Install Chromium for screenshots
echo ""
echo "2. Installing Chromium (for before/after screenshots)..."
if ! command -v chromium-browser &>/dev/null && ! command -v chromium &>/dev/null; then
    apt-get update -qq
    apt-get install -y chromium-browser || apt-get install -y chromium
    echo "  Chromium installed: $(chromium-browser --version 2>/dev/null || chromium --version)"
else
    echo "  Chromium already installed"
fi

# 5. Install watchdog dependencies
echo ""
echo "3. Installing watchdog dependencies..."
cd "$WATCHDOG_DIR"
PUPPETEER_SKIP_DOWNLOAD=true npm install

# 6. Configure OpenClaw models (free tier first)
echo ""
echo "4. Configuring OpenClaw free model fallback..."
bash "$WATCHDOG_DIR/scripts/configure-openclaw-models.sh" || echo "  (OpenClaw config — run manually if needed)"

# 7. Set up cron jobs
echo ""
echo "5. Setting up cron jobs..."
EXISTING=$(crontab -l 2>/dev/null || true)
NEW_CRONS=""

# Site watchdog — daily at 8 AM
if ! echo "$EXISTING" | grep -q "site-watchdog/npm start"; then
    NEW_CRONS="${NEW_CRONS}\n# Site Watchdog — daily at 8 AM\n0 8 * * * cd $WATCHDOG_DIR && npm start >> $WATCHDOG_DIR/logs/cron.log 2>&1"
fi

# OpenClaw auto-update — every Sunday at 3 AM
if ! echo "$EXISTING" | grep -q "update-openclaw"; then
    NEW_CRONS="${NEW_CRONS}\n# OpenClaw auto-update — weekly Sunday 3 AM\n0 3 * * 0 bash $WATCHDOG_DIR/scripts/update-openclaw.sh >> $WATCHDOG_DIR/logs/openclaw-update.log 2>&1"
fi

if [ -n "$NEW_CRONS" ]; then
    (echo "$EXISTING"; echo -e "$NEW_CRONS") | crontab -
    echo "  Cron jobs added"
fi

echo ""
echo "Current crontab:"
crontab -l

# 8. Start dashboard with PM2
echo ""
echo "6. Starting Dashboard with PM2..."
pm2 delete site-watchdog-dashboard 2>/dev/null || true
pm2 start "npm run dashboard" --name "site-watchdog-dashboard" --cwd "$WATCHDOG_DIR"
pm2 save
pm2 startup 2>/dev/null || true

# 9. Open firewall port for dashboard
echo ""
echo "7. Opening port 3099 for dashboard..."
ufw allow 3099/tcp 2>/dev/null || iptables -I INPUT -p tcp --dport 3099 -j ACCEPT 2>/dev/null || true

echo ""
echo "================================="
echo "Setup complete!"
echo "================================="
echo ""
echo "Quick checks:"
echo "  npm run test-notify     → Test Telegram bot"
echo "  DRY_RUN=true npm start  → Test dry run (no deploy)"
echo "  npm run status          → Show next scheduled site"
echo ""
echo "Dashboard:  http://31.97.56.148:3099"
echo "Logs:       tail -f $WATCHDOG_DIR/logs/cron.log"
echo ""
echo "Runs daily at 8 AM UTC. Telegram notifications → @SivaMind_bot"
