#!/usr/bin/env bash
# install-hooks.sh
# Installs a smart pre-push hook into every git project under agents/
# Detects project type and runs appropriate checks before any push lands on Vercel.
# Usage: bash install-hooks.sh
# Re-run anytime to update hooks across all projects.

set -euo pipefail

AGENTS_DIR="$(cd "$(dirname "$0")" && pwd)"

# The hook script — embedded here, written into each project's .git/hooks/pre-push
read -r -d '' HOOK_CONTENT << 'HOOK_EOF' || true
#!/usr/bin/env bash
# pre-push hook — managed by agents/install-hooks.sh (do not edit manually)
# Runs project-type-appropriate checks before push. Blocks on errors.

set -uo pipefail

ERRORS=0

# ── Helper ──────────────────────────────────────────────────────────────────
run_check() {
  local label="$1"; shift
  echo "🔍 $label..."
  if ! "$@" 2>&1; then
    echo "❌ $label FAILED"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ $label passed"
  fi
}

# ── Detect package manager ───────────────────────────────────────────────────
if [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
  PM="bun"
  EXEC="bunx"
elif [ -f "pnpm-lock.yaml" ]; then
  PM="pnpm"
  EXEC="pnpm exec"
elif [ -f "yarn.lock" ]; then
  PM="yarn"
  EXEC="yarn"
else
  PM="npm"
  EXEC="npx"
fi

# ── TypeScript projects ──────────────────────────────────────────────────────
if [ -f "tsconfig.json" ]; then
  run_check "TypeScript (tsc --noEmit)" $EXEC tsc --noEmit
fi

# ── ESLint (warn-only — Vercel doesn't fail on ESLint, only TS errors do) ────
# ESLint output is shown for visibility but does NOT block the push.
if [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.cjs" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
  LINT_DIR=""
  [ -d "src" ] && LINT_DIR="src"
  [ -d "app" ] && LINT_DIR="${LINT_DIR:+$LINT_DIR }app"
  if [ -n "$LINT_DIR" ]; then
    echo "🔍 ESLint (informational — won't block push)..."
    $EXEC eslint $LINT_DIR --quiet 2>&1 || echo "⚠️  ESLint warnings above — not blocking (fix when you can)"
  fi
fi

# ── Python projects ──────────────────────────────────────────────────────────
if [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
  if command -v ruff >/dev/null 2>&1; then
    run_check "Ruff (Python lint)" ruff check .
  fi
  if command -v mypy >/dev/null 2>&1 && [ -f "pyproject.toml" ]; then
    run_check "mypy (Python types)" mypy . --ignore-missing-imports
  fi
fi

# ── Next.js build sanity (optional — uncomment for full build check, slow) ──
# if [ -f "next.config.js" ] || [ -f "next.config.ts" ] || [ -f "next.config.mjs" ]; then
#   run_check "next build" $PM run build
# fi

# ── Result ───────────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "🚫 $ERRORS check(s) failed — push blocked. Fix above errors, then push again."
  echo "   To bypass in emergency: git push --no-verify"
  exit 1
fi

echo "🚀 All checks passed — pushing."
exit 0
HOOK_EOF

INSTALLED=0
SKIPPED=0
FAILED=0

for dir in "$AGENTS_DIR"/*/; do
  # Must be a git repo
  [ -d "$dir/.git" ] || continue

  # Must look like a code project (TS, JS, or Python)
  HAS_CODE=0
  [ -f "$dir/tsconfig.json" ] && HAS_CODE=1
  [ -f "$dir/package.json" ] && HAS_CODE=1
  [ -f "$dir/pyproject.toml" ] && HAS_CODE=1
  [ -f "$dir/requirements.txt" ] && HAS_CODE=1

  if [ "$HAS_CODE" -eq 0 ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  HOOK_PATH="$dir/.git/hooks/pre-push"

  if printf '%s\n' "$HOOK_CONTENT" > "$HOOK_PATH" && chmod +x "$HOOK_PATH"; then
    echo "✅ $(basename "$dir")"
    INSTALLED=$((INSTALLED + 1))
  else
    echo "❌ $(basename "$dir") — failed"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "Done. Installed: $INSTALLED | Skipped (no code): $SKIPPED | Failed: $FAILED"
echo ""
echo "Hook runs on every 'git push'. Emergency bypass: git push --no-verify"
