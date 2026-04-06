#!/bin/bash
# Setup script for Variant Confusion Detector for Ecwid
# Run: bash scripts/setup.sh

set -e

echo "=== Variant Confusion Detector for Ecwid ==="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 24 ]; then
  echo "❌ Node.js 24+ is required. Current: $(node -v 2>/dev/null || echo 'not installed')"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Set your Ecwid app ID in public/index.html or pass ?appId=..."
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
