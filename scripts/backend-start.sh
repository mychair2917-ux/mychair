#!/usr/bin/env bash
# Production-oriented API start (mirrors Docker/Render uvicorn command).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND="${ROOT}/Backend"
PORT="${PORT:-8000}"

log_banner "BACKEND START"

cd "${BACKEND}"

if [[ -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
elif [[ -f "venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi

if [[ ! -f ".env" && -f ".env.example" ]]; then
  log_warn "Backend/.env missing — copy from .env.example before production use"
fi

log_info "Starting uvicorn on 0.0.0.0:${PORT} (proxy-headers enabled)..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
