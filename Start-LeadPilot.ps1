$projectRoot = $PSScriptRoot
$localNode = Join-Path $projectRoot ".tools\node"
$npmCommand = Join-Path $localNode "npm.cmd"

if (-not (Test-Path -LiteralPath $npmCommand)) {
    Write-Error "Local Node.js runtime was not found at: $localNode"
    exit 1
}

$env:PATH = "$localNode;$env:PATH"
Set-Location -LiteralPath $projectRoot

Write-Host ""
Write-Host "Starting LeadPilot AI..." -ForegroundColor Cyan
Write-Host "Open http://localhost:3000 in your browser." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the application." -ForegroundColor DarkGray
Write-Host ""

& $npmCommand run dev
