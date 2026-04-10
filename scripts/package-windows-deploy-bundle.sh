#!/usr/bin/env sh
set -eu

bundle_root="dist/xchat-deploy"
bundle_version="${BUNDLE_VERSION:-}"
bundle_name="xchat-deploy"
if [ -n "$bundle_version" ]; then
  bundle_name="${bundle_name}-${bundle_version}"
fi
zip_path="dist/${bundle_name}.zip"

rm -rf "$bundle_root"
mkdir -p "$bundle_root/scripts/windows"

cp docker-compose.windows.yml "$bundle_root/"
cp .env.windows.example "$bundle_root/.env.windows.example"
cp .env.windows.supabase.example "$bundle_root/.env.windows.supabase.example"
cp scripts/windows/install-instructions.txt "$bundle_root/install-instructions.txt"
cp scripts/windows/install.ps1 "$bundle_root/scripts/windows/install.ps1"
cp scripts/windows/update.ps1 "$bundle_root/scripts/windows/update.ps1"

rm -f "$zip_path"
(
  cd dist
  zip -rq "${bundle_name}.zip" "xchat-deploy"
)

printf 'Created %s\n' "$zip_path"

