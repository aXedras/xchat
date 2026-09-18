#!/usr/bin/env bash
set -euo pipefail

workflow=.github/workflows/docker-build.yml
compose=docker-compose.coolify.yml

grep -q 'workflow_dispatch:' "$workflow"
grep -q 'deploy_production' "$workflow"
grep -q 'image_digest' "$workflow"
grep -q 'concurrency:' "$workflow"
grep -q ':\${IMAGE_TAG}' scripts/deploy-coolify.sh
grep -q 'sha256:\*)' scripts/deploy-coolify.sh
grep -q '\${XCHAT_SUPABASE_URL:?XCHAT_SUPABASE_URL is required}' "$compose"
grep -q '\${XCHAT_SUPABASE_PUBLISHABLE_KEY:?XCHAT_SUPABASE_PUBLISHABLE_KEY is required}' "$compose"

if grep -R --line-number -- ':latest' "$workflow" "$compose" docker-compose.ghcr.yml docker-compose.windows.yml; then
  printf 'Mutable latest image references are not allowed in deployment files\n' >&2
  exit 1
fi

printf 'Deployment file validation passed\n'
