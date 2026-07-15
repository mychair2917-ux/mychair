#!/usr/bin/env bash
# Install frontend dependencies and produce the production build (Frontend/dist).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND="${ROOT}/Frontend"

log_banner "FRONTEND BUILD STARTED"

cd "${FRONTEND}"

export HUSKY=0

if [[ -f "package-lock.json" ]]; then
  log_info "Installing dependencies with npm ci..."
  npm ci
else
  log_info "Installing dependencies with npm install..."
  npm install
fi

log_info "Running production build (npm run build)..."
npm run build

log_success "Frontend build artifacts ready in Frontend/dist"
log_banner "FRONTEND BUILD COMPLETED"
