#!/bin/bash
# OpenClaw auto-update script
# Runs weekly via cron to keep openclaw up to date
# Also ensures free model config is set correctly
#
# Cron: 0 3 * * 0 /root/site-watchdog/scripts/update-openclaw.sh >> /root/site-watchdog/logs/openclaw-update.log 2>&1

set -e

echo "=============================="
echo "OpenClaw Update — $(date)"
echo "=============================="

# 1. Update openclaw to latest version
echo ""
echo "1. Updating openclaw..."
BEFORE=$(openclaw --version 2>/dev/null || echo "unknown")
npm install -g openclaw@latest 2>&1 | tail -3
AFTER=$(openclaw --version 2>/dev/null || echo "unknown")
echo "   Before: $BEFORE  →  After: $AFTER"

# 2. Restart gateway to pick up new version
echo ""
echo "2. Restarting openclaw gateway..."
openclaw gateway restart || systemctl restart openclaw-gateway 2>/dev/null || true
sleep 3

# 3. Verify health
echo ""
echo "3. Health check..."
openclaw health || echo "  WARNING: health check failed — check manually"

# 4. Show current model config
echo ""
echo "4. Current model config:"
openclaw models status 2>/dev/null || openclaw config get models 2>/dev/null || echo "  (models command not available)"

echo ""
echo "=============================="
echo "Update complete — $(date)"
echo "=============================="
