Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$requirements = Join-Path $PSScriptRoot "requirements.txt"

if (-not (Test-Path $pythonExe)) {
    throw "Python executable was not found: $pythonExe"
}

Write-Host "[py-setup] python: $pythonExe"
& $pythonExe --version

Write-Host "[py-setup] installing requirements from: $requirements"
& $pythonExe -m pip install -r $requirements

Write-Host "[py-setup] done"
