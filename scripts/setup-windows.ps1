param([switch]$InstallTools)
$ErrorActionPreference = 'Stop'
if ($InstallTools) {
    winget install --id OpenJS.NodeJS.LTS --exact --source winget
    winget install --id Rustlang.Rustup --exact --source winget
    winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --override '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
    Write-Host 'Reopen your terminal, then rerun this script without -InstallTools.'
    exit
}
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    node scripts/doctor.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Install the missing tools first (or use -InstallTools).' }
    node scripts/npm.mjs ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency setup failed' }
} finally { Pop-Location }
