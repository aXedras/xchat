#!/bin/sh
# Provision the three closed-group-messaging E2E users via the Supabase Admin API.
#
# Deterministic and fail-closed: a fresh user is created. An existing user is
# recognized only via the proven duplicate-user error (HTTP 422 with
# error_code "email_exists") and is then force-updated to the password,
# email_confirm and metadata defined below, so repeated runs never tolerate
# drift. Any other admin API failure aborts the script with a non-zero exit.
#
# Environment:
#   E2E_SUPABASE_URL               default http://127.0.0.1:54321
#   E2E_SUPABASE_SERVICE_ROLE_KEY  required (local dev: see `supabase status -o env`)
set -eu

SUPABASE_URL="${E2E_SUPABASE_URL:-http://127.0.0.1:54321}"
SERVICE_ROLE_KEY="${E2E_SUPABASE_SERVICE_ROLE_KEY:?E2E_SUPABASE_SERVICE_ROLE_KEY is required}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command '$1' not found" >&2
    exit 1
  }
}
require_cmd curl
require_cmd jq

urlencode() {
  jq -rn --arg v "$1" '$v|@uri'
}

# Performs an admin API request and prints "<body>\n<http_status>".
admin_request() {
  method="$1"
  path="$2"
  body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -w '\n%{http_code}' -X "$method" "${SUPABASE_URL}${path}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -s -w '\n%{http_code}' -X "$method" "${SUPABASE_URL}${path}" \
      -H "apikey: ${SERVICE_ROLE_KEY}" \
      -H "Authorization: Bearer ${SERVICE_ROLE_KEY}"
  fi
}

# Splits the "<body>\n<http_status>" shape from admin_request into
# RESP_BODY / RESP_STATUS globals.
split_status() {
  RESP_STATUS=$(printf '%s' "$1" | tail -n1)
  RESP_BODY=$(printf '%s' "$1" | sed '$d')
}

find_user_id_by_email() {
  email="$1"
  encoded=$(urlencode "$email")

  raw=$(admin_request GET "/auth/v1/admin/users?filter=${encoded}")
  split_status "$raw"
  if [ "$RESP_STATUS" != "200" ]; then
    echo "Looking up existing user for ${email} failed with HTTP ${RESP_STATUS}" >&2
    exit 1
  fi

  match_count=$(printf '%s' "$RESP_BODY" | jq --arg email "$email" '[.users[] | select(.email == $email)] | length')
  if [ "$match_count" != "1" ]; then
    echo "Expected exactly one existing user for ${email}, found ${match_count}" >&2
    exit 1
  fi

  printf '%s' "$RESP_BODY" | jq -r --arg email "$email" '.users[] | select(.email == $email) | .id'
}

provision() {
  email="$1"
  password="$2"
  full_name="$3"

  create_body=$(jq -n --arg email "$email" --arg password "$password" --arg full_name "$full_name" \
    '{email: $email, password: $password, email_confirm: true, user_metadata: {full_name: $full_name}}')

  raw=$(admin_request POST "/auth/v1/admin/users" "$create_body")
  split_status "$raw"

  case "$RESP_STATUS" in
    200 | 201)
      echo "Created ${email}."
      return 0
      ;;
  esac

  error_code=$(printf '%s' "$RESP_BODY" | jq -r '.error_code // empty')
  if [ "$RESP_STATUS" != "422" ] || [ "$error_code" != "email_exists" ]; then
    echo "Provisioning ${email} failed with HTTP ${RESP_STATUS} (error_code=${error_code:-none})" >&2
    exit 1
  fi

  user_id=$(find_user_id_by_email "$email")

  update_body=$(jq -n --arg password "$password" --arg full_name "$full_name" \
    '{password: $password, email_confirm: true, user_metadata: {full_name: $full_name}}')

  raw=$(admin_request PUT "/auth/v1/admin/users/${user_id}" "$update_body")
  split_status "$raw"
  if [ "$RESP_STATUS" != "200" ]; then
    echo "Updating existing user ${email} failed with HTTP ${RESP_STATUS}" >&2
    exit 1
  fi

  echo "Updated existing user ${email} to the expected password and metadata."
}

provision "alice@xchat.test.local" "Al1ce-Test-Pw" "Alice Metal"
provision "bob@xchat.test.local" "B0b-Test-Pw" "Bob Trader"
provision "carol@xchat.test.local" "Car0l-Test-Pw" "Carol Ops"

echo "E2E users provisioned."
