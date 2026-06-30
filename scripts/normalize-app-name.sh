#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Replace any casing of "weatherb" with "weatherB" in file contents.
# Note: This is an aggressive replacement and will also affect package names
# or path strings that include "weatherb". Review changes before committing.

if [[ "${1:-}" == "--dry-run" ]]; then
  rg -l -S "(?i)weatherb"
  exit 0
fi

rg -l -S "(?i)weatherb" \
  --glob '!node_modules/**' \
  --glob '!**/.git/**' \
  --glob '!**/.next/**' \
  --glob '!**/dist/**' \
  --glob '!**/out/**' \
  --glob '!**/build/**' \
  --glob '!**/coverage/**' \
  | while IFS= read -r file; do
      perl -pi -e 's/weatherb/weatherB/ig' "$file"
    done
