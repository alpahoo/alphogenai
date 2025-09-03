#!/usr/bin/env bash
set -euo pipefail
if [ -z "${RUNPOD_API_KEY:-}" ] || [ -z "${RUNPOD_TEMPLATE_ID:-}" ]; then
  echo "Missing RUNPOD_API_KEY or RUNPOD_TEMPLATE_ID"
  exit 0
fi
echo "Triggering Runpod template refresh (noop placeholder)"
curl -sS -X GET "https://api.runpod.io/v2/${RUNPOD_TEMPLATE_ID}/status" \
  -H "Authorization: Bearer ${RUNPOD_API_KEY}" || true
