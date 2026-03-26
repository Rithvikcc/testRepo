#!/bin/bash

# ─────────────────────────────────────────────
#   Personal Library — One-Click Starter
# ─────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       📚  My Personal Library        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Node.js is installed
if ! command -v node &>/dev/null; then
  echo "❌  Node.js is not installed."
  echo "    Please install it from: https://nodejs.org"
  echo "    Then run this script again."
  exit 1
fi

echo "✅  Node.js found ($(node -v))"

# ── Install Backend ──────────────────────────
echo ""
echo "📦  Setting up backend..."
cd "$SCRIPT_DIR/backend"
npm install --silent
echo "✅  Backend ready"

# ── Install Frontend ─────────────────────────
echo ""
echo "📦  Setting up frontend..."
cd "$SCRIPT_DIR/frontend"
npm install --silent
echo "✅  Frontend ready"

# ── Start Backend ────────────────────────────
echo ""
echo "🚀  Starting backend on http://localhost:3001 ..."
cd "$SCRIPT_DIR/backend"
npm start &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

# ── Start Frontend ───────────────────────────
echo "🚀  Starting frontend..."
echo ""
echo "═══════════════════════════════════════════"
echo "   ✅  App is running!"
echo "   👉  Open your browser at:"
echo "       http://localhost:3000"
echo "═══════════════════════════════════════════"
echo ""
echo "   Press Ctrl+C to stop the app."
echo ""

cd "$SCRIPT_DIR/frontend"

# Kill backend when script exits
trap "echo ''; echo 'Shutting down...'; kill $BACKEND_PID 2>/dev/null; exit" INT TERM EXIT

npm start
