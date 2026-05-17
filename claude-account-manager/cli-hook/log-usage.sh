#!/usr/bin/env bash
# Claude Code PostToolUse hook — logs token usage to ~/.claude/usage-log.jsonl
# Wire in ~/.claude/settings.json under hooks.PostToolUse

LOG="$HOME/.claude/usage-log.jsonl"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
MODEL="${CLAUDE_MODEL:-unknown}"
INPUT_TOKENS="${CLAUDE_INPUT_TOKENS:-0}"
OUTPUT_TOKENS="${CLAUDE_OUTPUT_TOKENS:-0}"
CACHE_READ="${CLAUDE_CACHE_READ_TOKENS:-0}"
TOOL="${CLAUDE_TOOL_NAME:-unknown}"
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append JSONL record
printf '{"ts":"%s","session":"%s","model":"%s","tool":"%s","in":%s,"out":%s,"cache_read":%s}\n' \
  "$TS" "$SESSION_ID" "$MODEL" "$TOOL" "$INPUT_TOKENS" "$OUTPUT_TOKENS" "$CACHE_READ" \
  >> "$LOG"

# Keep last 1000 lines only
if [ -f "$LOG" ]; then
  tail -1000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"
fi
