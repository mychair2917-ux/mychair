#!/usr/bin/env bash
# Create venv (if needed) and install backend production dependencies.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND="${ROOT}/Backend"

log_banner "BACKEND BUILD STARTED"

cd "${BACKEND}"

if [[ ! -d ".venv" ]]; then
  log_info "Creating virtualenv at Backend/.venv ..."
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

log_info "Upgrading pip..."
python -m pip install --upgrade pip

log_info "Installing dependencies from requirements.txt..."
pip install -r requirements.txt

log_success "Backend dependencies installed"
log_banner "BACKEND BUILD COMPLETED"
