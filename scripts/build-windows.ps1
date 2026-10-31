$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    node scripts/npm.mjs ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
    node scripts/npm.mjs run tauri -- build --no-bundle
    if ($LASTEXITCODE -ne 0) { throw 'Tauri build failed' }
    New-Item -ItemType Directory -Force dist | Out-Null
    Copy-Item src-tauri/target/release/aula-studio.exe dist/AULA-Studio.exe -Force
    Copy-Item research/LICENSE.upstream dist/LICENSE.upstream -Force
    Copy-Item research/LICENSE.perkey dist/LICENSE.perkey -Force
} finally { Pop-Location }
