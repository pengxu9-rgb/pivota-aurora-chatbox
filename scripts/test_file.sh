#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: npm run test:file -- <test-file> [more files...]" >&2
  exit 1
fi

bash scripts/test_preflight.sh

for target in "$@"; do
  case "$target" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx)
      ;;
    *)
      echo "[test:file] ERROR: unsupported test filename: $target" >&2
      echo "[test:file] Supported: *.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx" >&2
      exit 1
      ;;
  esac
done

node ./node_modules/.bin/vitest run "$@"
