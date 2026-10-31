# AULA Studio

A lightweight desktop configurator for the **AULA F75 Max**, built with Tauri 2,
React, TypeScript and Rust. Windows and Apple Silicon macOS share the same source. No Python,
Electron, account, cloud service, or bundled Node runtime is required to use it.

Unofficial community project; not affiliated with AULA or EPOMAKER.

## Current status

| Feature | Status |
| --- | --- |
| 2.4 GHz receiver discovery | Tested on Windows |
| Built-in RGB effects, color, brightness, speed and direction | Working on the user's Windows keyboard |
| Battery percentage and refresh | Working on Windows |
| Pastel light/dark themes and flat 2D preview | Implemented |
| Per-key editor, groups, rectangle selection and local saved layouts | Implemented in UI |
| Per-key upload over 2.4 GHz | Confirmed working on the user's Windows keyboard in 0.2.1 |
| macOS (Apple Silicon / M-series) | Native build provided; not hardware-tested |
| TFT uploads, key remapping, Bluetooth configuration | Not implemented |

Version 0.2.1 was checked against an official-app USB capture. The user confirmed
both the captured WASD-green sequence and the updated app's custom colors on the
physical keyboard. Other firmware batches and macOS still need hardware tests.

## Use

Plug in the USB receiver, switch the keyboard to 2.4G, close other driver apps,
and open AULA Studio. Choose an effect and color, then click **Apply lighting**.
The battery/receiver panel is at the top with readable status text. Battery
refreshes automatically while visible. Receiver presence is checked every five
seconds; the badge turns green only while the USB receiver is detected. This
does not assert that the wireless keyboard is awake.
Settings persist locally as editor preferences; they are not read from hardware.

The supported receiver is `05AC:024F`, vendor usage page `FF60`, with 32-byte
output reports (interface 3 on Windows). Interface 4 uses a different 64-byte
format and is excluded from Windows discovery. Other device batches and wired
configuration protocols are not assumed compatible.

The UI includes a saturation/value picker, hue slider, system color picker, hex
input, palette swatches, effect cards, and a styled dropdown with descriptions.
All seven palette slots are editable: choose a color, click **Save color**, then
click the slot to replace. Presets persist locally. The preview is illustrative.
Dark/light theme preference is saved locally. The active editor tab is outlined.

The per-key editor supports clicks, drag-box selection, additive
Shift/Ctrl/Command-drag, group presets, painting, turn-off, and undo. Changing
the picker automatically paints selected keys locally; Apply sends the full layout. Switching to Effects and applying a built-in effect
returns to ordinary lighting.

## Build from source

Requirements: Node.js 22+, Rust stable, and the
[Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).
Windows needs Microsoft C++ Build Tools and WebView2. macOS needs Xcode command
line tools. Build native binaries on their target OS. The release workflow targets Windows
x64 and Apple Silicon (M-series) macOS only; Intel macOS builds are excluded.

```sh
npm ci
npm run desktop
```

Validation and builds:

```sh
npm run test:ui
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --no-bundle
```

- Windows setup: `powershell -File scripts/setup-windows.ps1`
- Windows missing tool installation: add `-InstallTools`, then reopen the terminal.
- Windows portable EXE: `powershell -File scripts/build-windows.ps1`
- macOS setup: `sh scripts/setup-macos.sh`
- macOS app/DMG: `sh scripts/build-macos.sh`
- Tool check: `node scripts/doctor.mjs`
- Source ZIP: `powershell -File scripts/source-archive.ps1`

The source contains dependency lockfiles, icons, and platform setup/build scripts.
Toolchains, caches and generated dependencies are not bundled. Initial setup
requires Internet access. Signing and macOS notarization are not configured.
The GitHub Actions workflow builds Windows and macOS artifacts; a successful
build is not a hardware compatibility test.

## Help investigate custom lighting

Follow the [official-app USB recording guide](docs/CAPTURE-USB.md). Record USB
receiver traffic on Windows with Wireshark + USBPcap, starting before opening
the official app, and make one controlled color change at a time.

Keep captures private: they may include keystrokes or unrelated USB traffic.
Do not upload them in a public issue. Source control ignores packet captures. The user's capture is kept private;
only protocol facts and synthetic regression vectors are included in the source.

## Protocol and attribution

- Built-in wireless RGB and battery: [VitalyArt/Aula-F75-Max-Driver](https://github.com/VitalyArt/Aula-F75-Max-Driver).
- Experimental wireless per-key encoding: [thibaultmiclo/aula-driver](https://github.com/thibaultmiclo/aula-driver).
- Numeric key geometry/LED indices: EPOMAKER F75 Max driver layout data, with
  [provenance notes](research/per-key-provenance.md). No vendor executable,
  firmware, or artwork is distributed in this repository.

The backend validates endpoints and settings, serializes HID operations, checks
short writes, and waits for custom upload acknowledgments. A failed custom
transfer attempts to restore a built-in effect. Physical behavior remains the
final test; no firmware flashing commands are used.

MIT license. Retain the upstream notices in `research/LICENSE.upstream` and
`research/LICENSE.perkey` when redistributing derived code.

## 0.2.1 validation

Ten Rust tests and a production-DOM UI check pass. UI checks cover per-key color
selection and payload delivery, saved palette replacement, valid global-setting
persistence, top-panel order, battery display, and disabling Apply on disconnect.
The raw USB capture is not distributed.
