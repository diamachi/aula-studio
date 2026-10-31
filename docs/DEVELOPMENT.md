# Development

AULA Studio uses React/TypeScript for the interface and Tauri 2/Rust with HIDAPI for native keyboard access. Build native packages on their target operating system.

## Setup

Install Node.js 22+, Rust stable and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). Windows needs Microsoft C++ Build Tools and WebView2. macOS needs Xcode command line tools.

Windows PowerShell:

```powershell
powershell -File scripts/setup-windows.ps1
```

Add `-InstallTools` to request missing tool installation, then reopen the terminal. This is not required when the prerequisites are already available.

Apple Silicon macOS:

```sh
sh scripts/setup-macos.sh
```

Check tools with `node scripts/doctor.mjs`. The repository does not bundle Node, Rust, C++ compilers, Xcode or dependency caches. `scripts/npm.mjs` uses the workspace npm bootstrap under `.tools/package` if present, otherwise the system npm. A copied source ZIP does not include that local bootstrap.

## Develop and verify

```sh
npm ci
npm run desktop
npm run test:ui
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

If npm is available only through the workspace wrapper, run the frontend build and UI test separately:

```sh
node scripts/npm.mjs run build
node scripts/test-ui.mjs
```

Rust tests and the production-DOM UI check use synthetic or mocked data; they do not send hardware commands. Desktop hardware behavior must be tested separately. A browser-only preview cannot access the Rust HID backend.

## Build

Windows portable executable:

```powershell
powershell -File scripts/build-windows.ps1
```

Output: `dist/AULA-Studio.exe`, with upstream notices beside it.

Apple Silicon app/DMG:

```sh
sh scripts/build-macos.sh
```

For a native build without packaging:

```sh
npm run tauri -- build --no-bundle
```

Native outputs are under `src-tauri/target/release`; installers and DMGs are under its `bundle` directory. The build uses the host architecture, so use an Apple Silicon host for the supported Mac package.

## Source archive

```powershell
powershell -File scripts/source-archive.ps1
```

Output: `dist/AULA-Studio-source.zip`. The script packages an explicit list of source, configuration, documentation and license files. It excludes private USB captures, vendor executables, toolchains, caches and generated dependencies. First-time dependency downloads require internet access.

## Documentation screenshots

The optional screenshot tool runs the built interface in a headless browser with a temporary profile. It mocks connection/battery data and image preparation; hardware-changing commands are disabled. It does not open the native app or capture the desktop.

```sh
npm install --prefix .tools/screenshots --no-package-lock playwright-core
npm run build
node scripts/capture-screenshots.mjs
```

The default browser path is Windows Edge. On another setup, set `BROWSER_PATH` to a compatible Chromium-based browser executable before running the script. Images are saved under `docs/screenshots/`. Playwright is local documentation tooling, not an application dependency.
