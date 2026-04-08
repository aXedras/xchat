#!/bin/sh
set -eu

quote_js() {
  value=${1:-}
  escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '"%s"' "$escaped"
}

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__XCHAT_RUNTIME_CONFIG__ = {
  apiBaseUrl: $(quote_js "${XCHAT_API_BASE_URL:-}"),
  apiMode: $(quote_js "${XCHAT_API_MODE:-}"),
  wsUrl: $(quote_js "${XCHAT_WS_URL:-}"),
  realtimeCarrier: $(quote_js "${XCHAT_REALTIME_CARRIER:-}"),
  realtimeChannel: $(quote_js "${XCHAT_REALTIME_CHANNEL:-}"),
  realtimeEvent: $(quote_js "${XCHAT_REALTIME_EVENT:-}"),
  supabaseUrl: $(quote_js "${XCHAT_SUPABASE_URL:-}"),
  supabasePublishableKey: $(quote_js "${XCHAT_SUPABASE_PUBLISHABLE_KEY:-}"),
  supabaseRedirectUrl: $(quote_js "${XCHAT_SUPABASE_AUTH_REDIRECT_URL:-}"),
  persistenceProvider: $(quote_js "${XCHAT_PERSISTENCE_PROVIDER:-}"),
  demoEmail: $(quote_js "${XCHAT_DEMO_EMAIL:-demo@axedras.com}"),
  demoPassword: $(quote_js "${XCHAT_DEMO_PASSWORD:-password}"),
  vendorAdminEmail: $(quote_js "${XCHAT_VENDOR_ADMIN_EMAIL:-admin@xchat.local}"),
  vendorAdminPassword: $(quote_js "${XCHAT_VENDOR_ADMIN_PASSWORD:-change-me-demo-admin}"),
  bilEnabled: $(quote_js "${XCHAT_BIL_ENABLED:-false}"),
  bilBaseUrl: $(quote_js "${XCHAT_BIL_BASE_URL:-}"),
  bilApiKey: $(quote_js "${XCHAT_BIL_API_KEY:-}"),
  bilNetwork: $(quote_js "${XCHAT_BIL_NETWORK:-}"),
  bilParticipantId: $(quote_js "${XCHAT_BIL_PARTICIPANT_ID:-}"),
  bilLedgerId: $(quote_js "${XCHAT_BIL_LEDGER_ID:-}")
};
EOF

exec nginx -g 'daemon off;'