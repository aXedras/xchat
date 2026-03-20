#!/usr/bin/env sh
set -eu

if [ -x ./.venv/bin/semgrep ]; then
  SEMGREP_BIN=./.venv/bin/semgrep
elif command -v semgrep >/dev/null 2>&1; then
  SEMGREP_BIN=$(command -v semgrep)
else
  echo "Semgrep is not installed." >&2
  echo "Install it with: npm run semgrep:setup" >&2
  exit 1
fi

"$SEMGREP_BIN" scan "$@"