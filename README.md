# AULA Studio

A lightweight desktop configurator for the **AULA F75 Max**, built with Tauri 2,
React, TypeScript and Rust. Windows and macOS share the same source. No Python,
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
| **Per-key upload over 2.4 GHz** | **Not working on the user's keyboard; investigation paused** |
| macOS | Source/build scripts provided; not hardware-tested |
| TFT uploads, key remapping, Bluetooth configuration | Not implemented |

Receiver acknowledgment tests succeeded after initialization was added, but the
user reports that custom colors still do not appear. **Acknowledged USB packets
are not proof of a working lighting feature.** Do not rely on per-key upload yet.
A capture of the official software is needed before further protocol changes.

## Use

Plug in the USB receiver, switch the keyboard to 2.4G, close other driver apps,
and open AULA Studio. Choose an effect and color, then click **Apply lighting**.
The battery panel refreshes automatically while the window is visible.
Settings persist locally as editor preferences; they are not read from hardware.

The supported receiver is `05AC:024F`, vendor usage page `FF60`, with 32-byte
output reports (interface 3 on Windows). Interface 4 uses a different 64-byte
format and is excluded from Windows discovery. Other device batches and wired
configuration protocols are not assumed compatible.

The UI includes a saturation/value picker, hue slider, system color picker, hex
input, palette swatches, effect cards, and a styled dropdown with descriptions.
The preview is illustrative. Dark/light theme preference is saved locally.

The experimental per-key editor supports clicks, drag-box selection, additive
Shift/Ctrl/Command-drag, group presets, painting, turn-off, and undo. Its upload
is currently unresolved. Switching to Effects and applying a built-in effect
returns to ordinary lighting.

## Build from source

Requirements: Node.js 22+, Rust stable, and the
[Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/).
Windows needs Microsoft C++ Build Tools and WebView2. macOS needs Xcode command
line tools. Build native binaries on their target OS.

```sh
npm ci
npm run desktop
```

Validation and builds:

```sh
npm run build
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
Do not upload them in a public issue. Source control ignores packet captures.

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
