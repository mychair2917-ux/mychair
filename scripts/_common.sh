#!/usr/bin/env bash
# Shared logging helpers for build/deploy scripts.
# Never echo secret values.

set -euo pipefail

log_banner() {
  echo ""
  echo "====================================="
  echo "$1"
  echo "====================================="
  echo ""
}

log_info() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO  $*"
}

log_warn() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN  $*" >&2
}

log_error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR $*" >&2
}

log_success() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK    $*"
}

# Resolve monorepo root from any script under scripts/
repo_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  cd "${here}/.." && pwd
}
