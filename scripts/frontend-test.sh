#!/usr/bin/env bash
# Frontend validation: lint always; unit tests only if a test script exists.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND="${ROOT}/Frontend"

log_banner "FRONTEND VALIDATION STARTED"

cd "${FRONTEND}"

export HUSKY=0

if [[ ! -d "node_modules" ]]; then
  log_info "node_modules missing — installing..."
  if [[ -f "package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
fi

log_info "Running ESLint (npm run lint)..."
npm run lint

if npm run | grep -qE '^[[:space:]]*test[[:space:]]'; then
  log_info "Running frontend tests (npm test)..."
  npm test
else
  log_info "No npm test script defined — skipping unit tests"
fi

log_success "Frontend validation completed"
log_banner "FRONTEND VALIDATION COMPLETED"
