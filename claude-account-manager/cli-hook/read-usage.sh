#!/usr/bin/env bash
# Reads ~/.claude/usage-log.jsonl and outputs summary JSON for the extension
# Extension polls this via a native messaging host (optional advanced setup)
# For basic use: pipe output to a web server on localhost:17432

LOG="$HOME/.claude/usage-log.jsonl"

if [ ! -f "$LOG" ]; then
  echo '{"error":"no usage log found","hint":"wire cli-hook/log-usage.sh first"}'
  exit 0
fi

# Today's stats
TODAY=$(date -u +"%Y-%m-%dT")
TODAY_LINES=$(grep "\"ts\":\"${TODAY}" "$LOG" 2>/dev/null || true)

TOTAL_IN=$(echo "$TODAY_LINES" | grep -o '"in":[0-9]*' | awk -F: '{s+=$2} END {print s+0}')
TOTAL_OUT=$(echo "$TODAY_LINES" | grep -o '"out":[0-9]*' | awk -F: '{s+=$2} END {print s+0}')
TOTAL_CACHE=$(echo "$TODAY_LINES" | grep -o '"cache_read":[0-9]*' | awk -F: '{s+=$2} END {print s+0}')
CALL_COUNT=$(echo "$TODAY_LINES" | grep -c '"ts"' || echo 0)

# Cost estimate (claude-sonnet-4-6 pricing: $3/Mtok in, $15/Mtok out, $0.30/Mtok cache)
COST=$(echo "scale=4; ($TOTAL_IN * 3 + $TOTAL_OUT * 15 + $TOTAL_CACHE * 0.3) / 1000000" | bc 2>/dev/null || echo "0")

printf '{"today":{"input_tokens":%d,"output_tokens":%d,"cache_read_tokens":%d,"calls":%d,"estimated_usd_cost":"%s"}}\n' \
  "$TOTAL_IN" "$TOTAL_OUT" "$TOTAL_CACHE" "$CALL_COUNT" "$COST"
