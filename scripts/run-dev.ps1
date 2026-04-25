$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    throw "Missing .venv. Run scripts/setup.ps1 first."
}

$ApiCommand = "Set-Location '$RepoRoot'; & '$VenvPython' -m uvicorn app.main:app --reload --app-dir apps/api"
$WebCommand = "Set-Location '$RepoRoot\apps\web'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $ApiCommand
Start-Process powershell -ArgumentList "-NoExit", "-Command", $WebCommand

Write-Host "Started API at http://127.0.0.1:8000 and web at http://localhost:5173."
Write-Host "Keep Ollama running separately for live lesson generation."
