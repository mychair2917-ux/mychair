#!/usr/bin/env bash
# Optional Render deploy via Deploy Hook.
#
# Required for deploy:
#   RENDER_DEPLOY_HOOK_URL  — Deploy Hook URL from Render dashboard
# Optional:
#   RENDER_DEPLOY=true      — must be "true" to actually trigger (safety gate)
#   RENDER_SERVICE_NAME     — logged for clarity only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/_common.sh
source "${SCRIPT_DIR}/_common.sh"

log_banner "RENDER DEPLOYMENT"

if [[ "${RENDER_DEPLOY:-false}" != "true" ]]; then
  log_info "RENDER_DEPLOY is not 'true' — skipping deploy (build-only run)"
  log_banner "RENDER DEPLOYMENT SKIPPED"
  exit 0
fi

if [[ -z "${RENDER_DEPLOY_HOOK_URL:-}" ]]; then
  log_error "RENDER_DEPLOY=true but RENDER_DEPLOY_HOOK_URL is empty"
  exit 1
fi

SERVICE_LABEL="${RENDER_SERVICE_NAME:-mychair-api}"
log_info "Triggering Render deploy hook for: ${SERVICE_LABEL}"
log_info "POST (URL redacted) ..."

HTTP_CODE="$(curl -sS -o /tmp/render-deploy-response.txt -w '%{http_code}' \
  -X POST \
  "${RENDER_DEPLOY_HOOK_URL}")"

if [[ "${HTTP_CODE}" =~ ^2 ]]; then
  log_success "Render deploy hook accepted (HTTP ${HTTP_CODE})"
  log_banner "RENDER DEPLOYMENT TRIGGERED"
  exit 0
fi

log_error "Render deploy hook failed (HTTP ${HTTP_CODE})"
if [[ -f /tmp/render-deploy-response.txt ]]; then
  # Response body should not contain secrets; still truncate
  head -c 500 /tmp/render-deploy-response.txt >&2 || true
  echo "" >&2
fi
exit 1
