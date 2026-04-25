param(
    [string]$PythonCommand = "py -3"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

Set-Location $RepoRoot

if (-not (Test-Path $VenvPython)) {
    Invoke-Expression "$PythonCommand -m venv .venv"
}

& $VenvPython -m pip install -r "apps/api/requirements.txt"

Push-Location "apps/web"
try {
    npm install
}
finally {
    Pop-Location
}

Write-Host "Setup complete. Start Ollama separately, then run scripts/run-dev.ps1."
