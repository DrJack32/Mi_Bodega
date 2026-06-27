#!/usr/bin/env bash
set -e

# Serves the prebuilt Expo web export (dist/) on $PORT with SPA fallback.
# To rebuild after code changes:
#   cd /app/artifacts/mi-bodega && \
#   EXPO_PUBLIC_DOMAIN=313fe69c-0ee6-4106-9924-e70da315f732.preview.emergentagent.com \
#   pnpm exec expo export --platform web --output-dir dist

DIST="/app/artifacts/mi-bodega/dist"

if [ ! -f "$DIST/index.html" ]; then
  echo "dist/ not found, building web export..."
  cd /app/artifacts/mi-bodega
  EXPO_PUBLIC_DOMAIN="313fe69c-0ee6-4106-9924-e70da315f732.preview.emergentagent.com" \
  EXPO_NO_TELEMETRY=1 \
  pnpm exec expo export --platform web --output-dir dist
fi

exec node /app/frontend/serve-static.js
