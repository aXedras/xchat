param(
    [ValidateSet("mock", "supabase")]
    [string]$Template = "mock"
)

$ErrorActionPreference = "Stop"

$composeFile = "docker-compose.windows.yml"
$envFile = ".env.windows"

$envTemplateMap = @{
    mock = ".env.windows.example"
    supabase = ".env.windows.supabase.example"
}

$envTemplate = $envTemplateMap[$Template]

if (-not (Test-Path $composeFile)) {
    throw "Missing $composeFile in the current directory."
}

if (-not (Test-Path $envTemplate)) {
    throw "Missing $envTemplate in the current directory."
}

if (-not (Test-Path $envFile)) {
    Copy-Item $envTemplate $envFile
    Write-Host "Created $envFile from template $envTemplate. Review credentials and backend settings before exposing the VM."
}

docker compose -f $composeFile pull
docker compose -f $composeFile up -d

Write-Host "xChat is starting on http://localhost:8080 using template mode '$Template'"
