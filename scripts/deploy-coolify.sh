#!/usr/bin/env bash
set -euo pipefail

: "${COOLIFY_URL:?COOLIFY_URL is required}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is required}"
: "${COOLIFY_APP_UUID:?COOLIFY_APP_UUID is required}"
: "${IMAGE_DIGEST:?IMAGE_DIGEST is required}"
: "${RELEASE_SHA:?RELEASE_SHA is required}"
: "${XCHAT_IMAGE_REPOSITORY:?XCHAT_IMAGE_REPOSITORY is required}"
: "${EXPECTED_ENVIRONMENT:?EXPECTED_ENVIRONMENT is required}"

case "$EXPECTED_ENVIRONMENT" in
  integration|production) ;;
  *) printf 'Unsupported deployment environment: %s\n' "$EXPECTED_ENVIRONMENT" >&2; exit 64 ;;
esac

case "$IMAGE_DIGEST" in
  sha256:*) ;;
  *) printf 'IMAGE_DIGEST must be a sha256 digest\n' >&2; exit 64 ;;
esac

image="${XCHAT_IMAGE_REPOSITORY}@${IMAGE_DIGEST}"

curl --fail-with-body --silent --show-error \
  -X PATCH \
  "${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n \
    --arg image "$XCHAT_IMAGE_REPOSITORY" \
    --arg tag "$IMAGE_DIGEST" \
    '{build_pack: "dockerimage", docker_registry_image_name: $image, docker_registry_image_tag: $tag, ports_exposes: "8080", health_check_enabled: true, health_check_port: "8080", health_check_path: "/index.html"}')"

for item in "XCHAT_IMAGE=${image}" "XCHAT_RELEASE_SHA=${RELEASE_SHA}" "XCHAT_EXPECTED_ENVIRONMENT=${EXPECTED_ENVIRONMENT}"; do
  key=${item%%=*}
  value=${item#*=}
  curl --fail-with-body --silent --show-error \
    -X PATCH \
    "${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n --arg key "$key" --arg value "$value" '{key: $key, value: $value}')" \
  || curl --fail-with-body --silent --show-error \
    -X POST \
    "${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}/envs" \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n --arg key "$key" --arg value "$value" '{key: $key, value: $value}')"
done

curl --fail-with-body --silent --show-error \
  -X POST \
  "${COOLIFY_URL}/api/v1/deploy?uuid=${COOLIFY_APP_UUID}&force=false" \
  -H "Authorization: Bearer ${COOLIFY_TOKEN}"

for attempt in {1..60}; do
  service_state=$(curl --fail-with-body --silent --show-error \
    -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
    "${COOLIFY_URL}/api/v1/applications/${COOLIFY_APP_UUID}" | jq -r '.status // "unknown"')
  printf 'Coolify %s service status: %s\n' "$EXPECTED_ENVIRONMENT" "$service_state"
  if [ "$service_state" = 'running:healthy' ]; then
    exit 0
  fi
  if [[ "$service_state" == failed* || "$service_state" == 'unhealthy' ]]; then
    exit 1
  fi
  sleep 10
done

printf 'Coolify %s deployment did not become healthy in time\n' "$EXPECTED_ENVIRONMENT" >&2
exit 1
