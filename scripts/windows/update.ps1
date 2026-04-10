$ErrorActionPreference = "Stop"

$composeFile = "docker-compose.windows.yml"

if (-not (Test-Path $composeFile)) {
    throw "Missing $composeFile in the current directory."
}

docker compose -f $composeFile pull
docker compose -f $composeFile up -d

Write-Host "xChat has been updated and restarted."
