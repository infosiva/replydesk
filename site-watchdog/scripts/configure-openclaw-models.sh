#!/bin/bash
# Configure OpenClaw to use free models with proper fallback chain
#
# Free tier priority:
#   1. google/gemini-2.5-flash       — free via OpenRouter, fast, capable
#   2. google/gemini-2.0-flash-lite  — free, lighter fallback
#   3. anthropic/claude-haiku-4-5    — cheap Anthropic fallback
#   4. anthropic/claude-sonnet-4-6   — full power (paid, last resort)
#
# Run: bash scripts/configure-openclaw-models.sh

echo "Configuring OpenClaw model fallback chain..."
echo ""

# Check current config
echo "Current config:"
cat /root/.openclaw/openclaw.json 2>/dev/null || echo "(config not found at /root/.openclaw/openclaw.json)"
echo ""

# Update primary model to Gemini Flash (free)
echo "Setting primary model → google/gemini-2.5-flash (free tier)..."
openclaw config set models.primary "google/gemini-2.5-flash" 2>/dev/null || \
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('/root/.openclaw/openclaw.json','utf8'));
    cfg.models = cfg.models || {};
    cfg.models.primary = 'google/gemini-2.5-flash';
    cfg.models.fallback = [
      'google/gemini-2.0-flash-lite',
      'anthropic/claude-haiku-4-5-20251001',
      'anthropic/claude-sonnet-4-6'
    ];
    fs.writeFileSync('/root/.openclaw/openclaw.json', JSON.stringify(cfg, null, 2));
    console.log('Config updated via direct file edit');
  " 2>/dev/null || echo "  Set manually — see instructions below"

echo ""
echo "Restarting gateway to apply changes..."
openclaw gateway restart 2>/dev/null || systemctl restart openclaw-gateway 2>/dev/null || true
sleep 2

echo ""
echo "Final model status:"
openclaw models status 2>/dev/null || true

echo ""
echo "Done! Model fallback chain:"
echo "  1. google/gemini-2.5-flash     (FREE - primary)"
echo "  2. google/gemini-2.0-flash-lite (FREE - fallback 1)"
echo "  3. claude-haiku-4-5             (cheap - fallback 2)"
echo "  4. claude-sonnet-4-6            (full power - last resort)"
