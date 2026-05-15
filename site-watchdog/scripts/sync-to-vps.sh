#!/bin/bash
# Sync site-watchdog + all website repos to VPS
# Run this from your Mac: bash scripts/sync-to-vps.sh
#
# VPS: 31.97.56.148

set -e

VPS_HOST="31.97.56.148"
VPS_USER="root"
VPS_PASS="Sivaprakasam@1981"
AGENTS_DIR="/Users/sivaprakasam/projects/agents"

SSH_CMD="sshpass -p '$VPS_PASS' ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_HOST"
RSYNC_CMD="sshpass -p '$VPS_PASS' rsync -avz --exclude='node_modules' --exclude='.next' --exclude='dist' --exclude='.git' -e 'ssh -o StrictHostKeyChecking=no'"

echo "================================="
echo "Syncing to VPS: $VPS_HOST"
echo "================================="

# 1. Sync site-watchdog
echo ""
echo "1. Syncing site-watchdog..."
eval "$RSYNC_CMD $AGENTS_DIR/site-watchdog/ $VPS_USER@$VPS_HOST:/root/site-watchdog/"

# 2. Sync website repos (without node_modules)
echo ""
echo "2. Syncing website repos..."

for site in clawdbotai quicktech quizbytesdaily worldtrends ai-jobs-portal; do
    if [ -d "$AGENTS_DIR/$site" ]; then
        echo "  Syncing $site..."
        eval "$RSYNC_CMD $AGENTS_DIR/$site/ $VPS_USER@$VPS_HOST:/root/agents/$site/"
    fi
done

# 3. Install dependencies on VPS
echo ""
echo "3. Installing dependencies on VPS..."
eval "$SSH_CMD 'cd /root/site-watchdog && npm install'"

echo ""
echo "================================="
echo "Sync complete!"
echo "================================="
echo ""
echo "Now SSH into VPS and run:"
echo "  bash scripts/sync-to-vps.sh   (first time: copies everything)"
echo "  Then on VPS:"
echo "    cd /root/site-watchdog"
echo "    npm run test-notify           # Test Telegram"
echo "    DRY_RUN=true npm start        # Test dry run"
echo "    bash scripts/vps-setup.sh     # Set up daily cron"
