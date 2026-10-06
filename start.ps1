param([switch]$Preview)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.12+ to run Cascading Castles.' }
if (-not (Test-Path -LiteralPath "$PSScriptRoot\node_modules")) { & npm.cmd ci; if ($LASTEXITCODE) { throw 'Dependency installation failed.' } }
if ($Preview) { & npm.cmd run preview } else { & npm.cmd run dev }
