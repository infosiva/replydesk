#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# NEW PROJECT VALIDATOR — run before building anything
# Usage: ./new-project-check.sh "AI Meal Planner"
# ═══════════════════════════════════════════════════════════════
# Checks:
#  1. Does this already exist in your portfolio?
#  2. Is the domain available?
#  3. Does a better competitor already own this space?
#  4. Market size + willingness to pay estimate
#  5. Go / No-Go recommendation
# ═══════════════════════════════════════════════════════════════

set -e

PROJECT_NAME="${1:-}"
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./new-project-check.sh \"Project Name or idea\""
  exit 1
fi

AGENTS_DIR="$(dirname "$0")"
SLUG=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  NEW PROJECT VALIDATOR                               ║"
echo "║  Checking: $PROJECT_NAME"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── 1. Portfolio duplicate check ────────────────────────────
echo "▶ 1/5  Checking your existing portfolio..."
EXISTING=$(ls "$AGENTS_DIR" | grep -i "$SLUG" 2>/dev/null | head -3)
if [ -n "$EXISTING" ]; then
  echo "   ⚠️  POSSIBLE DUPLICATE: $EXISTING"
  echo "   → You may already have something similar. Review before building."
else
  echo "   ✓  Not found in your portfolio — proceeding"
fi
echo ""

# ─── 2. Domain availability check ────────────────────────────
echo "▶ 2/5  Checking domain availability..."
DOMAINS=(
  "${SLUG}.app"
  "${SLUG}.ai"
  "${SLUG}ai.app"
  "get${SLUG}.app"
  "${SLUG}io.app"
  "${SLUG}hq.app"
)

AVAILABLE_DOMAINS=()
for domain in "${DOMAINS[@]}"; do
  taken=$(whois "$domain" 2>/dev/null | grep -i "domain name:" | head -1)
  if [ -z "$taken" ]; then
    AVAILABLE_DOMAINS+=("$domain")
    echo "   ✓  AVAILABLE: $domain  (~\$14/yr at Porkbun)"
  else
    echo "   ✗  taken:     $domain"
  fi
done

if [ ${#AVAILABLE_DOMAINS[@]} -eq 0 ]; then
  echo "   ⚠️  No obvious domains available — consider a different name"
fi
echo ""

# ─── 3. Quick competitor scan ─────────────────────────────────
echo "▶ 3/5  Competitor landscape (manual check needed)..."
echo "   Run this search to assess competition:"
echo "   → Google: \"best AI $PROJECT_NAME 2026\""
echo "   → ProductHunt: producthunt.com/search?q=$SLUG"
echo "   → Check if top result charges >$15/mo (opportunity gap)"
echo ""
echo "   Key questions:"
echo "   □ Does the top competitor have a free tier?"
echo "   □ Is their UX complex / overwhelming?"
echo "   □ Are they B2B only (leaving consumers underserved)?"
echo "   □ Can you build this in <2 weeks with Claude AI?"
echo ""

# ─── 4. Market viability scoring ─────────────────────────────
echo "▶ 4/5  Market viability checklist..."
echo ""
echo "   Score each question 0 (no) or 1 (yes):"
echo ""
echo "   [ ] Problem is painful (people pay to solve it)"
echo "   [ ] Users can see value in first 60 seconds"
echo "   [ ] Willingness to pay: \$5–20/mo"
echo "   [ ] Search volume exists (people actively looking)"
echo "   [ ] AI makes this 10x faster than manual"
echo "   [ ] Can be built solo in <2 weeks"
echo "   [ ] Doesn't require proprietary data you don't have"
echo ""
echo "   → Score 6+/7: BUILD IT"
echo "   → Score 4-5:  BUILD MVP only, validate first"
echo "   → Score <4:   SKIP — market too small or too hard"
echo ""

# ─── 5. Tech stack recommendation ────────────────────────────
echo "▶ 5/5  Recommended stack (based on your portfolio)..."
echo ""
echo "   Framework:  Next.js 15 (App Router) — same as all your projects"
echo "   AI:         Groq → Gemini → Claude fallback (minimise API cost)"
echo "   Styling:    Tailwind + theme.config.ts (flexible swap)"
echo "   DB:         Supabase (already know it)"
echo "   Deploy:     Vercel (auto from GitHub push)"
echo "   Rate limit: localStorage-based (no backend needed)"
echo ""
echo "   Template to copy:"
echo "   → cp -r $AGENTS_DIR/ai-travel-planner $AGENTS_DIR/$SLUG"
echo "   → Edit: src/theme.config.ts, src/app/api/*/route.ts, src/app/page.tsx"
echo ""

# ─── Summary ─────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════"
echo "  SUMMARY for: $PROJECT_NAME"
echo "═══════════════════════════════════════════════════════"
if [ ${#AVAILABLE_DOMAINS[@]} -gt 0 ]; then
  echo "  Best domain: ${AVAILABLE_DOMAINS[0]}"
fi
echo "  Portfolio clash: $([ -n "$EXISTING" ] && echo "YES — review" || echo "none")"
echo ""
echo "  Next steps:"
echo "  1. Complete the manual competitor check (step 3)"
echo "  2. Score the market viability (step 4)"
echo "  3. If score ≥6: copy template and start building"
echo "  4. Buy domain only AFTER MVP is live and tested"
echo "═══════════════════════════════════════════════════════"
echo ""
