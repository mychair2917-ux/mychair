#!/usr/bin/env bash
# Lint (ruff) and run pytest for the backend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND="${ROOT}/Backend"

log_banner "BACKEND VALIDATION STARTED"

cd "${BACKEND}"

if [[ -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [[ -f "venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
else
  log_warn "No virtualenv found — using system Python"
fi

log_info "Installing dev dependencies (requirements-dev.txt)..."
pip install -r requirements-dev.txt

if command -v ruff >/dev/null 2>&1; then
  log_info "Running ruff check..."
  # Non-blocking style debt: report but do not fail CI on legacy violations
  # unless RUFF_STRICT=1 is set.
  if [[ "${RUFF_STRICT:-0}" == "1" ]]; then
    ruff check app tests
  else
    ruff check app tests || log_warn "Ruff reported issues (set RUFF_STRICT=1 to fail)"
  fi
else
  log_warn "ruff not available — skipping lint"
fi

log_info "Running pytest..."
pytest -q

log_success "Backend validation completed"
log_banner "BACKEND VALIDATION COMPLETED"
