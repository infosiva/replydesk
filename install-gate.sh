#!/usr/bin/env bash
# install-gate.sh — installs shared auth gate into any Next.js project
# Usage: ./install-gate.sh <project-dir>
# Example: ./install-gate.sh ai-investment-tracker

set -e

AGENTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_SRC="$AGENTS_DIR/shared-ui/src"
TARGET="${1:?Usage: $0 <project-dir>}"

# Resolve target dir (absolute or relative to agents/)
if [[ "$TARGET" == /* ]]; then
  TARGET_DIR="$TARGET"
else
  TARGET_DIR="$AGENTS_DIR/$TARGET"
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "ERROR: $TARGET_DIR not found"
  exit 1
fi

# Detect src/ vs app/ layout
if [ -d "$TARGET_DIR/src" ]; then
  LIB_DIR="$TARGET_DIR/src/lib"
else
  LIB_DIR="$TARGET_DIR/lib"
fi

DEST="$LIB_DIR/shared"
mkdir -p "$DEST"

echo "Installing gate into: $DEST"

# Copy all shared files
cp "$SHARED_SRC/auth/useMagicAuth.ts"    "$DEST/useMagicAuth.ts"
cp "$SHARED_SRC/auth/MagicAuthModal.tsx" "$DEST/MagicAuthModal.tsx"
cp "$SHARED_SRC/ui/useGate.ts"           "$DEST/useGate.ts"
cp "$SHARED_SRC/ui/RegisterGate.tsx"     "$DEST/RegisterGate.tsx"
cp "$SHARED_SRC/ui/Toast.tsx"            "$DEST/Toast.tsx"
cp "$SHARED_SRC/ui/useToast.ts"          "$DEST/useToast.ts"

# Fix internal imports — shared-ui uses ../auth/ paths, but here all files are co-located
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s|from '../auth/MagicAuthModal'|from './MagicAuthModal'|g" "$DEST/RegisterGate.tsx"
  sed -i '' "s|from '../auth/useMagicAuth'|from './useMagicAuth'|g" "$DEST/RegisterGate.tsx"
  sed -i '' "s|from '../auth/useMagicAuth'|from './useMagicAuth'|g" "$DEST/useGate.ts"
  sed -i '' "s|from './useToast'|from './useToast'|g" "$DEST/Toast.tsx"
else
  sed -i "s|from '../auth/MagicAuthModal'|from './MagicAuthModal'|g" "$DEST/RegisterGate.tsx"
  sed -i "s|from '../auth/useMagicAuth'|from './useMagicAuth'|g" "$DEST/RegisterGate.tsx"
  sed -i "s|from '../auth/useMagicAuth'|from './useMagicAuth'|g" "$DEST/useGate.ts"
fi

echo "Files installed:"
ls -1 "$DEST"

# Check if @siva/shared-ui is in package.json, offer to remove it
PKG="$TARGET_DIR/package.json"
if grep -q "@siva/shared-ui" "$PKG" 2>/dev/null; then
  echo ""
  echo "Found @siva/shared-ui in $PKG — removing..."
  # Remove the line with @siva/shared-ui
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' '/"@siva\/shared-ui"/d' "$PKG"
  else
    sed -i '/"@siva\/shared-ui"/d' "$PKG"
  fi
  echo "Removed from package.json"
fi

echo ""
echo "Done! Now update your imports:"
echo "  useGate, RegisterGate  → from '@/lib/shared/useGate' and '@/lib/shared/RegisterGate'"
echo "  MagicAuthModal         → from '@/lib/shared/MagicAuthModal'"
echo "  useMagicAuth           → from '@/lib/shared/useMagicAuth'"
echo "  ToastProvider, Toast   → from '@/lib/shared/useToast' and '@/lib/shared/Toast'"
