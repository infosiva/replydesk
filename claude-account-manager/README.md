# Claude Account Manager

Chrome extension to monitor and manage multiple Claude accounts.

## Features

| Feature | What it does |
|---------|-------------|
| **Usage dashboard** | 4-account progress bars, % used, days to reset |
| **80% alert** | Desktop notification when any account crosses threshold |
| **Smart recommendation** | Always shows lowest-usage account to switch to |
| **Rate limit detector** | Auto-detects Claude rate-limit UI, notifies you |
| **Conversation log** | Captures all conversation titles + timestamps |
| **7-day sparkline** | Per-account usage trend chart |
| **Quick switcher** | One-click opens correct claude.ai tab |
| **CLI usage stats** | Wires to Claude Code PostToolUse hook → shows today's token spend + cost estimate |
| **Tips panel** | 10 actionable tips for using Claude efficiently |

## Install (Chrome)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder
4. Generate icons: open `generate-icons.html` in browser, save the 3 PNG files to `public/`

## Setup accounts

1. Click extension icon
2. Click **Edit** on each account → enter your email, plan, billing day
3. Visit `claude.ai/settings/usage` on each account → extension scrapes usage automatically

## Wire Claude Code CLI hook (optional but powerful)

Adds real-time token counting and cost estimation:

```bash
# 1. Install the hook
chmod +x cli-hook/log-usage.sh
cp cli-hook/log-usage.sh ~/.claude/hooks/post-tool-use.sh

# 2. Add to ~/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      { "command": "bash ~/.claude/hooks/post-tool-use.sh" }
    ]
  }
}

# 3. Start the mini usage server (runs on localhost:17432)
node cli-hook/mini-server.js &
# Or with pm2: pm2 start cli-hook/mini-server.js --name claude-usage-server
```

Extension polls `localhost:17432/usage` and shows today's token count + cost in the popup.

## Using multiple accounts

- Use **separate Chrome profiles** (one per Claude account) for clean session isolation
- Set the **Profile URL** in each account's Edit modal to the Chrome profile shortcut URL
- The **Smart recommendation** tab always tells you which account to use next

## Tips for best Claude Code efficiency

See the **Tips** tab in the extension for 10 actionable tricks.
