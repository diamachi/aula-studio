$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    New-Item -ItemType Directory -Force dist | Out-Null
    $sourceFiles = @('src','scripts','docs','LICENSE','src-tauri/src','src-tauri/icons','src-tauri/capabilities','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs','src-tauri/tauri.conf.json','src-tauri/app-icon.svg','research/LICENSE.upstream','research/LICENSE.perkey','research/per-key-provenance.md','research/display-protocol.md','package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','README.md','.gitignore','.gitattributes','.github')
    tar -a -c -f dist/AULA-Studio-source.zip @sourceFiles
    if ($LASTEXITCODE -ne 0) { throw 'Source packaging failed' }
} finally { Pop-Location }
