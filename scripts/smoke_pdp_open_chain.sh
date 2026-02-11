#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke] PDP open chain regression suite"
npm test -- src/test/recommendationsViewDetailsDeepScan.test.tsx
npm test -- src/test/pivotaShop.test.ts
echo "[smoke] PASS"
